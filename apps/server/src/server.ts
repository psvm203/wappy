import { createHash, randomBytes, randomUUID } from "node:crypto";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { DatabaseSync } from "node:sqlite";
import {
  INVITE_TTL_MS,
  ONLINE_TIMEOUT_MS,
  WAVE_COOLDOWN_MS,
  WAVE_TTL_MS,
  isRecord,
  parseProfile,
  type ApiErrorBody,
  type Output,
  type Profile,
  type Route,
  type Wave,
} from "@wappy/api";

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const secret = () => randomBytes(32).toString("base64url");

async function readBody(req: IncomingMessage): Promise<unknown> {
  if (
    req.headers["content-type"]?.split(";")[0]?.trim() !== "application/json"
  ) {
    throw new HttpError(415, "JSON 형식으로 요청해 주세요.");
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 4096) throw new HttpError(413, "요청이 너무 큽니다.");
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString());
  } catch {
    throw new HttpError(400, "올바른 JSON이 아닙니다.");
  }
}

function field(body: unknown, key: string): string {
  if (
    !isRecord(body) ||
    typeof body[key] !== "string" ||
    !body[key].trim() ||
    body[key].length > 128
  ) {
    throw new HttpError(400, "입력값을 확인해 주세요.");
  }
  return body[key].trim();
}

function json(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(body));
}
function reply<R extends Route>(
  res: ServerResponse,
  _route: R,
  body: Output<R>,
  status = 200,
) {
  json(res, status, body);
}

export function createApp(options: {
  databasePath: string;
  origins?: string[];
  now?: () => number;
}) {
  const db = new DatabaseSync(options.databasePath);
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL, character TEXT NOT NULL, status TEXT NOT NULL
    ) STRICT;
    CREATE TABLE IF NOT EXISTS friendships (
      user_id TEXT NOT NULL REFERENCES users(id),
      friend_id TEXT NOT NULL REFERENCES users(id),
      PRIMARY KEY (user_id, friend_id), CHECK (user_id < friend_id)
    ) STRICT;
    CREATE TABLE IF NOT EXISTS invites (
      code_hash TEXT PRIMARY KEY, owner_id TEXT NOT NULL UNIQUE REFERENCES users(id),
      expires_at INTEGER NOT NULL
    ) STRICT;
    CREATE TABLE IF NOT EXISTS recovery_codes (
      code_hash TEXT PRIMARY KEY, owner_id TEXT NOT NULL UNIQUE REFERENCES users(id)
    ) STRICT;
    CREATE TABLE IF NOT EXISTS presence_settings (
      user_id TEXT PRIMARY KEY REFERENCES users(id),
      sharing INTEGER NOT NULL CHECK (sharing IN (0, 1)),
      revision INTEGER NOT NULL CHECK (revision >= 1)
    ) STRICT;
    CREATE TABLE IF NOT EXISTS waves (
      id TEXT NOT NULL UNIQUE,
      user_id TEXT NOT NULL, friend_id TEXT NOT NULL, sender_id TEXT NOT NULL,
      sent_at INTEGER NOT NULL, acknowledged INTEGER NOT NULL CHECK (acknowledged IN (0, 1)),
      PRIMARY KEY (user_id, friend_id, sender_id),
      CHECK (sender_id = user_id OR sender_id = friend_id),
      FOREIGN KEY (user_id, friend_id) REFERENCES friendships(user_id, friend_id) ON DELETE CASCADE
    ) STRICT;
  `);
  const now = options.now ?? Date.now;
  // ponytail: single-process presence; use shared TTL storage before running replicas.
  const lastSeen = new Map<string, number>();
  const limits = new Map<string, { count: number; until: number }>();
  const origins = new Set([
    "tauri://localhost",
    "http://tauri.localhost",
    "https://tauri.localhost",
    "http://localhost:1420",
    "http://127.0.0.1:1420",
    ...(options.origins ?? []),
  ]);
  const profile = (id: string) =>
    db
      .prepare("SELECT id, name, character, status FROM users WHERE id = ?")
      .get(id) as unknown as Profile;
  const housekeeping = setInterval(() => {
    const time = now();
    for (const [id, seen] of lastSeen)
      if (time - seen >= ONLINE_TIMEOUT_MS) lastSeen.delete(id);
    for (const [ip, limit] of limits)
      if (limit.until <= time) limits.delete(ip);
    db.prepare("DELETE FROM invites WHERE expires_at <= ?").run(time);
    db.prepare("DELETE FROM waves WHERE sent_at <= ?").run(time - WAVE_TTL_MS);
  }, 60_000);
  housekeeping.unref();

  const server = createServer(async (req, res) => {
    try {
      const origin = req.headers.origin;
      if (origin && !origins.has(origin))
        throw new HttpError(403, "허용되지 않은 앱 주소입니다.");
      if (origin) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Vary", "Origin");
      }
      if (req.method === "OPTIONS") {
        res.writeHead(204, {
          "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Max-Age": "600",
        });
        res.end();
        return;
      }
      const route = `${req.method} ${req.url}`;
      if (route === "GET /health") {
        json(res, 200, { ok: true });
        return;
      }
      const publicSession =
        route === "POST /session" || route === "POST /session/recover";
      const publicPreview = route === "POST /invites/preview";
      if (req.method !== "GET") {
        const key = `${req.socket.remoteAddress}:${publicSession ? "session" : publicPreview ? "preview" : "write"}`;
        const limit = limits.get(key);
        const current =
          limit && limit.until > now()
            ? limit
            : { count: 0, until: now() + 60_000 };
        limits.set(key, current);
        if (++current.count > (publicSession ? 10 : 60)) {
          res.setHeader("Retry-After", "60");
          throw new HttpError(
            429,
            "요청이 많습니다. 잠시 후 다시 시도해 주세요.",
          );
        }
      }
      const body = req.method === "GET" ? undefined : await readBody(req);
      // Authenticate after the last await so recovery also revokes in-flight writes.
      let self: Profile | undefined;
      if (!publicSession && !publicPreview) {
        const token = req.headers.authorization?.match(
          /^Bearer ([A-Za-z0-9_-]{43})$/,
        )?.[1];
        const user =
          token &&
          db
            .prepare("SELECT id FROM users WHERE token_hash = ?")
            .get(hash(token));
        if (!user)
          throw new HttpError(
            401,
            "프로필 인증에 실패했습니다. 서버 주소를 확인해 주세요.",
          );
        self = profile(user.id as string);
      }
      switch (route) {
        case "POST /session": {
          let input;
          try {
            input = parseProfile(body);
          } catch (error) {
            throw new HttpError(400, (error as Error).message);
          }
          const token = secret();
          const user = { id: randomUUID(), ...input };
          db.prepare("INSERT INTO users VALUES (?, ?, ?, ?, ?)").run(
            user.id,
            hash(token),
            user.name,
            user.character,
            user.status,
          );
          lastSeen.set(user.id, now());
          reply(res, route, { token, profile: user }, 201);
          break;
        }
        case "POST /session/recover": {
          const code = field(body, "code");
          if (!/^wappy-recovery-[A-Za-z0-9_-]{43}$/.test(code))
            throw new HttpError(400, "올바른 복구 코드를 입력해 주세요.");
          const token = secret();
          // One atomic statement preserves the profile and revokes the old session.
          // Keep the recovery key valid: a lost response must remain retryable.
          const user = db
            .prepare(
              `UPDATE users SET token_hash = ?
               WHERE id = (SELECT owner_id FROM recovery_codes WHERE code_hash = ?)
               RETURNING id, name, character, status`,
            )
            .get(hash(token), hash(code)) as unknown as Profile | undefined;
          if (!user)
            throw new HttpError(401, "복구 코드와 서버 주소를 확인해 주세요.");
          lastSeen.set(user.id, now());
          reply(res, route, { token, profile: user });
          break;
        }
        case "POST /recovery-code": {
          const code = `wappy-recovery-${secret()}`;
          db.prepare(
            `INSERT INTO recovery_codes VALUES (?, ?) ON CONFLICT(owner_id)
             DO UPDATE SET code_hash = excluded.code_hash`,
          ).run(hash(code), self!.id);
          reply(res, route, { code }, 201);
          break;
        }
        case "GET /state": {
          const time = now();
          lastSeen.set(self!.id, time);
          const rows = db
            .prepare(
              `SELECT u.id, u.name, u.character, u.status, w.id AS wave_id, w.sent_at AS wave_sent_at,
              COALESCE(p.sharing, 1) AS sharing
            FROM friendships f
            JOIN users u ON u.id = CASE WHEN f.user_id = ? THEN f.friend_id ELSE f.user_id END
            LEFT JOIN presence_settings p ON p.user_id = u.id
            LEFT JOIN waves w ON w.user_id = f.user_id AND w.friend_id = f.friend_id
              AND w.sender_id = u.id AND w.acknowledged = 0 AND w.sent_at > ?
            WHERE f.user_id = ? OR f.friend_id = ? ORDER BY u.name, u.id`,
            )
            .all(
              self!.id,
              time - WAVE_TTL_MS,
              self!.id,
              self!.id,
            ) as unknown as (Profile & {
            wave_id: string | null;
            wave_sent_at: number | null;
            sharing: number;
          })[];
          const presence = db
            .prepare(
              "SELECT sharing, revision FROM presence_settings WHERE user_id = ?",
            )
            .get(self!.id);
          reply(res, route, {
            self: self!,
            presence: {
              sharing: presence ? presence.sharing === 1 : true,
              revision: presence ? Number(presence.revision) : 0,
            },
            friends: rows.map(
              ({ wave_id, wave_sent_at, sharing, ...friend }) => ({
                ...friend,
                online:
                  sharing === 1 &&
                  lastSeen.has(friend.id) &&
                  time - lastSeen.get(friend.id)! < ONLINE_TIMEOUT_MS,
                ...(wave_id && wave_sent_at !== null
                  ? { wave: { id: wave_id, sentAt: wave_sent_at } }
                  : {}),
              }),
            ),
          });
          break;
        }
        case "PATCH /profile": {
          let input;
          try {
            input = parseProfile(body);
          } catch (error) {
            throw new HttpError(400, (error as Error).message);
          }
          db.prepare(
            "UPDATE users SET name = ?, character = ?, status = ? WHERE id = ?",
          ).run(input.name, input.character, input.status, self!.id);
          reply(res, route, { ...input, id: self!.id });
          break;
        }
        case "POST /profile/delete": {
          if (field(body, "profileId") !== self!.id)
            throw new HttpError(409, "삭제할 프로필을 다시 확인해 주세요.");
          // Existing databases use restrictive user foreign keys. Keep removal atomic
          // without rebuilding their tables; waves already cascade with friendships.
          db.exec("BEGIN IMMEDIATE");
          try {
            db.prepare(
              "DELETE FROM friendships WHERE user_id = ? OR friend_id = ?",
            ).run(self!.id, self!.id);
            db.prepare("DELETE FROM invites WHERE owner_id = ?").run(self!.id);
            db.prepare("DELETE FROM recovery_codes WHERE owner_id = ?").run(
              self!.id,
            );
            db.prepare("DELETE FROM presence_settings WHERE user_id = ?").run(
              self!.id,
            );
            db.prepare("DELETE FROM users WHERE id = ?").run(self!.id);
            db.exec("COMMIT");
          } catch (error) {
            db.exec("ROLLBACK");
            throw error;
          }
          lastSeen.delete(self!.id);
          reply(res, route, { ok: true });
          break;
        }
        case "PATCH /presence": {
          if (!isRecord(body) || typeof body.sharing !== "boolean")
            throw new HttpError(400, "접속 공개 여부를 확인해 주세요.");
          const setting = db
            .prepare(
              `
            INSERT INTO presence_settings (user_id, sharing, revision) VALUES (?, ?, 1)
            ON CONFLICT(user_id) DO UPDATE SET sharing = excluded.sharing,
              revision = presence_settings.revision + 1
            RETURNING sharing, revision
          `,
            )
            .get(self!.id, Number(body.sharing))!;
          lastSeen.set(self!.id, now());
          reply(res, route, {
            sharing: setting.sharing === 1,
            revision: Number(setting.revision),
          });
          break;
        }
        case "POST /invites": {
          const code = secret();
          const expiresAt = now() + INVITE_TTL_MS;
          db.prepare(
            `INSERT INTO invites VALUES (?, ?, ?) ON CONFLICT(owner_id)
            DO UPDATE SET code_hash = excluded.code_hash, expires_at = excluded.expires_at`,
          ).run(hash(code), self!.id, expiresAt);
          reply(res, route, { code, expiresAt }, 201);
          break;
        }
        case "POST /invites/preview": {
          const invite = db
            .prepare(
              `SELECT users.name, users.character, invites.expires_at AS expiresAt
               FROM invites JOIN users ON users.id = invites.owner_id
               WHERE invites.code_hash = ? AND invites.expires_at > ?`,
            )
            .get(hash(field(body, "code")), now());
          if (!invite)
            throw new HttpError(404, "초대 코드가 없거나 만료되었습니다.");
          reply(res, route, {
            name: invite.name as string,
            character: invite.character as Profile["character"],
            expiresAt: invite.expiresAt as number,
          });
          break;
        }
        case "POST /invites/accept": {
          const code = field(body, "code");
          // The transaction consumes a code exactly once, even across server processes.
          db.exec("BEGIN IMMEDIATE");
          try {
            const invite = db
              .prepare(
                "SELECT owner_id FROM invites WHERE code_hash = ? AND expires_at > ?",
              )
              .get(hash(code), now());
            if (!invite)
              throw new HttpError(404, "초대 코드가 없거나 만료되었습니다.");
            if (invite.owner_id === self!.id)
              throw new HttpError(
                400,
                "자신의 초대 코드는 사용할 수 없습니다.",
              );
            const friendId = invite.owner_id as string;
            const pair = [self!.id, friendId].sort();
            const result = db
              .prepare("INSERT OR IGNORE INTO friendships VALUES (?, ?)")
              .run(pair[0]!, pair[1]!);
            if (!result.changes)
              throw new HttpError(409, "이미 연결된 친구입니다.");
            db.prepare("DELETE FROM invites WHERE code_hash = ?").run(
              hash(code),
            );
            db.exec("COMMIT");
            reply(res, route, profile(friendId));
          } catch (error) {
            db.exec("ROLLBACK");
            throw error;
          }
          break;
        }
        case "POST /friends/remove": {
          const pair = [self!.id, field(body, "friendId")].sort();
          db.prepare(
            "DELETE FROM friendships WHERE user_id = ? AND friend_id = ?",
          ).run(pair[0]!, pair[1]!);
          reply(res, route, { ok: true });
          break;
        }
        case "POST /friends/wave": {
          const pair = [self!.id, field(body, "friendId")].sort();
          const time = now();
          // One row per direction keeps only the latest greeting. The guarded upsert
          // also enforces cooldown across restarts and simultaneous requests.
          const wave = db
            .prepare(
              `
            INSERT INTO waves (id, user_id, friend_id, sender_id, sent_at, acknowledged)
            SELECT ?, user_id, friend_id, ?, ?, 0 FROM friendships
            WHERE user_id = ? AND friend_id = ?
            ON CONFLICT(user_id, friend_id, sender_id) DO UPDATE SET
              id = excluded.id, sent_at = excluded.sent_at, acknowledged = 0
            WHERE waves.sent_at <= ?
            RETURNING id, sent_at AS sentAt
          `,
            )
            .get(
              randomUUID(),
              self!.id,
              time,
              pair[0]!,
              pair[1]!,
              time - WAVE_COOLDOWN_MS,
            ) as unknown as Wave | undefined;
          if (!wave) {
            if (
              !db
                .prepare(
                  "SELECT 1 FROM friendships WHERE user_id = ? AND friend_id = ?",
                )
                .get(pair[0]!, pair[1]!)
            )
              throw new HttpError(
                404,
                "연결된 친구에게만 인사를 보낼 수 있어요.",
              );
            res.setHeader("Retry-After", String(WAVE_COOLDOWN_MS / 1000));
            throw new HttpError(
              429,
              "방금 인사를 보냈어요. 같은 친구에게는 30초에 한 번 보낼 수 있어요.",
            );
          }
          reply(res, route, wave, 201);
          break;
        }
        case "POST /waves/read": {
          // Match the exact greeting: a late acknowledgement must not hide a newer one.
          // Only the recipient may acknowledge it; retries and stale ids are safe no-ops.
          db.prepare(
            `UPDATE waves SET acknowledged = 1 WHERE id = ?
            AND sender_id != ? AND (user_id = ? OR friend_id = ?)`,
          ).run(field(body, "waveId"), self!.id, self!.id, self!.id);
          reply(res, route, { ok: true });
          break;
        }
        default:
          throw new HttpError(404, "API 경로를 찾을 수 없습니다.");
      }
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 500;
      if (status === 500) console.error("Request failed:", error);
      const body: ApiErrorBody = {
        error:
          error instanceof HttpError
            ? error.message
            : "서버 오류가 발생했습니다.",
      };
      if (!res.headersSent && !res.destroyed) json(res, status, body);
    }
  });
  server.requestTimeout = 10_000;
  server.headersTimeout = 10_000;
  server.on("close", () => {
    clearInterval(housekeeping);
    db.close();
  });
  return server;
}
