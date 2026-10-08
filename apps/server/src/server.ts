import { createHash, randomBytes, randomUUID } from "node:crypto";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { DatabaseSync } from "node:sqlite";
import { isIP } from "node:net";
import { kakaoIdentity, type KakaoConfig } from "./kakao.ts";
import { createReports, ReportError } from "./reports.ts";
import {
  INVITE_TTL_MS,
  REMOVED_CHARACTERS,
  ONLINE_TIMEOUT_MS,
  WAVE_COOLDOWN_MS,
  WAVE_TTL_MS,
  CHAT_COOLDOWN_MS,
  CHAT_HISTORY_LIMIT,
  CHAT_TTL_MS,
  isRecord,
  parseChatText,
  parseChatMessageIds,
  parseChatReportInput,
  parseProfile,
  type ApiErrorBody,
  type Output,
  type Profile,
  type Route,
  type Wave,
  type ChatMessage,
  type BlockedProfile,
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
const KAKAO_LOGIN_TTL_MS = 10 * 60_000;

interface KakaoAttempt {
  expiresAt: number;
  browserHash?: string;
  processing?: boolean;
  identity?: { id: string; name: string };
  error?: string;
}

function loginPage(res: ServerResponse, status: number, message: string) {
  res.writeHead(status, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
    "Referrer-Policy": "no-referrer",
    "Content-Security-Policy":
      "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
    "X-Content-Type-Options": "nosniff",
  });
  // Only fixed application messages, never provider responses or query parameters.
  res.end(
    `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Wappy 카카오 로그인</title><body><h1>Wappy 카카오 로그인</h1><p>${message}</p><p>이 창을 닫고 Wappy로 돌아가 주세요.</p></body></html>`,
  );
}

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
  trustProxy?: boolean;
  now?: () => number;
  kakao?: KakaoConfig;
  kakaoFetch?: typeof fetch;
  reportsEnabled?: boolean;
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
    CREATE TABLE IF NOT EXISTS profile_blocks (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      blocked_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL, character TEXT NOT NULL,
      PRIMARY KEY (user_id, blocked_id), CHECK (user_id <> blocked_id)
    ) STRICT;
    CREATE INDEX IF NOT EXISTS blocks_target ON profile_blocks(blocked_id);
    CREATE TABLE IF NOT EXISTS blocking_settings (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      revision INTEGER NOT NULL CHECK (revision >= 1)
    ) STRICT;
    CREATE TABLE IF NOT EXISTS invites (
      code_hash TEXT PRIMARY KEY, owner_id TEXT NOT NULL UNIQUE REFERENCES users(id),
      expires_at INTEGER NOT NULL
    ) STRICT;
    CREATE TABLE IF NOT EXISTS recovery_codes (
      code_hash TEXT PRIMARY KEY, owner_id TEXT NOT NULL UNIQUE REFERENCES users(id)
    ) STRICT;
    CREATE TABLE IF NOT EXISTS kakao_accounts (
      kakao_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE
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
    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      recipient_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      text TEXT NOT NULL, sent_at INTEGER NOT NULL
    ) STRICT;
    CREATE INDEX IF NOT EXISTS chat_sender ON chat_messages(sender_id, id DESC);
    CREATE INDEX IF NOT EXISTS chat_expiry ON chat_messages(sent_at);
    CREATE TABLE IF NOT EXISTS chat_recipients (
      message_id INTEGER NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL, friend_id TEXT NOT NULL,
      acknowledged INTEGER NOT NULL DEFAULT 0 CHECK (acknowledged IN (0, 1)),
      PRIMARY KEY (message_id, user_id, friend_id),
      FOREIGN KEY (user_id, friend_id) REFERENCES friendships(user_id, friend_id) ON DELETE CASCADE
    ) STRICT;
    CREATE INDEX IF NOT EXISTS friendships_friend ON friendships(friend_id, user_id);
    CREATE INDEX IF NOT EXISTS recipients_user ON chat_recipients(user_id, message_id);
    CREATE INDEX IF NOT EXISTS recipients_friend ON chat_recipients(friend_id, message_id);
  `);
  if (
    !db
      .prepare("PRAGMA table_info(chat_messages)")
      .all()
      .some((column) => column.name === "recipient_id")
  )
    db.exec(
      "ALTER TABLE chat_messages ADD COLUMN recipient_id TEXT REFERENCES users(id) ON DELETE CASCADE",
    );
  if (
    !db
      .prepare("PRAGMA table_info(chat_recipients)")
      .all()
      .some((column) => column.name === "acknowledged")
  )
    db.exec(
      "ALTER TABLE chat_recipients ADD COLUMN acknowledged INTEGER NOT NULL DEFAULT 0 CHECK (acknowledged IN (0, 1))",
    );
  for (const table of ["users", "profile_blocks"]) {
    db.prepare(
      `UPDATE ${table} SET character = 'chiikawa'
       WHERE character IN (${REMOVED_CHARACTERS.map(() => "?").join(",")})`,
    ).run(...REMOVED_CHARACTERS);
  }
  const now = options.now ?? Date.now;
  const reports = createReports(db, now);
  // ponytail: single-process presence; use shared TTL storage before running replicas.
  const lastSeen = new Map<string, number>();
  let presenceRevision = 0;
  // Keep only small validators, never per-profile JSON bodies. The fixed cap
  // bounds memory even if many different profiles poll between cleanups.
  // ponytail: writes invalidate all validators; use per-profile revisions if write-heavy traffic warrants it.
  const validators = new Map<
    string,
    {
      etag: string;
      changes: number;
      dataVersion: number;
      presenceRevision: number;
      createdAt: number;
      validUntil: number;
    }
  >();
  const limits = new Map<string, { count: number; until: number }>();
  // ponytail: pending logins share this single server process; use shared TTL storage before replicas.
  const kakaoAttempts = new Map<string, KakaoAttempt>();
  const origins = new Set([
    "tauri://localhost",
    "http://tauri.localhost",
    "https://tauri.localhost",
    "http://localhost:1420",
    "http://127.0.0.1:1420",
    ...(options.origins ?? []),
  ]);
  // Reuse the hot statements rather than allocating native SQL resources per poll.
  const selectProfile = db.prepare(
    "SELECT id, name, character, status FROM users WHERE id = ?",
  );
  const authenticate = db.prepare(
    "SELECT id, name, character, status FROM users WHERE token_hash = ?",
  );
  const selectFriends = db.prepare(`
    SELECT u.id, u.name, u.character, u.status, w.id AS wave_id, w.sent_at AS wave_sent_at,
      COALESCE(p.sharing, 1) AS sharing
    FROM friendships f
    JOIN users u ON u.id = CASE WHEN f.user_id = ? THEN f.friend_id ELSE f.user_id END
    LEFT JOIN presence_settings p ON p.user_id = u.id
    LEFT JOIN waves w ON w.user_id = f.user_id AND w.friend_id = f.friend_id
      AND w.sender_id = u.id AND w.acknowledged = 0 AND w.sent_at > ?
    WHERE f.user_id = ? OR f.friend_id = ? ORDER BY u.name, u.id
  `);
  const selectPresence = db.prepare(
    "SELECT sharing, revision FROM presence_settings WHERE user_id = ?",
  );
  const selectBlocks = db.prepare(
    "SELECT blocked_id AS id, name, character FROM profile_blocks WHERE user_id = ? ORDER BY name, blocked_id",
  );
  const selectBlockingRevision = db.prepare(
    "SELECT revision FROM blocking_settings WHERE user_id = ?",
  );
  const advanceBlocking =
    db.prepare(`INSERT INTO blocking_settings VALUES (?, 1)
    ON CONFLICT(user_id) DO UPDATE SET revision = blocking_settings.revision + 1`);
  const blockedPair = db.prepare(`SELECT 1 FROM profile_blocks
    WHERE (user_id = ? AND blocked_id = ?) OR (user_id = ? AND blocked_id = ?)`);
  const blocking = (id: string) => ({
    revision: Number(selectBlockingRevision.get(id)?.revision ?? 0),
    profiles: selectBlocks.all(id) as unknown as BlockedProfile[],
  });
  const selectMessages = db.prepare(`
    SELECT id, sender_id AS senderId, recipient_id AS recipientId, text, sent_at AS sentAt,
      sender_id <> ? AND EXISTS (
        SELECT 1 FROM chat_recipients r WHERE r.message_id = chat_messages.id
          AND (r.user_id = ? OR r.friend_id = ?) AND r.acknowledged = 0
      ) AS unread
    FROM chat_messages
    WHERE id IN (
      SELECT id FROM chat_messages WHERE sender_id = ?
      UNION ALL SELECT message_id FROM chat_recipients WHERE user_id = ?
      UNION ALL SELECT message_id FROM chat_recipients WHERE friend_id = ?
    ) AND sent_at > ? ORDER BY id DESC LIMIT ?
  `);
  const acknowledgeChat = db.prepare(`
    UPDATE chat_recipients SET acknowledged = 1
    WHERE message_id = ? AND (user_id = ? OR friend_id = ?)
      AND EXISTS (SELECT 1 FROM chat_messages WHERE id = chat_recipients.message_id
        AND sender_id <> ? AND sent_at > ?)
  `);
  const selectChanges = db.prepare("SELECT total_changes() AS changes");
  const selectDataVersion = db.prepare("PRAGMA data_version");
  const profile = (id: string) => selectProfile.get(id) as unknown as Profile;
  const housekeeping = setInterval(() => {
    const time = now();
    reports.prune();
    for (const [id, validator] of validators)
      if (validator.validUntil <= time) validators.delete(id);
    for (const [id, seen] of lastSeen)
      if (time - seen >= ONLINE_TIMEOUT_MS) lastSeen.delete(id);
    for (const [ip, limit] of limits)
      if (limit.until <= time) limits.delete(ip);
    for (const [state, attempt] of kakaoAttempts)
      if (attempt.expiresAt <= time) kakaoAttempts.delete(state);
    db.prepare("DELETE FROM invites WHERE expires_at <= ?").run(time);
    db.prepare("DELETE FROM waves WHERE sent_at <= ?").run(time - WAVE_TTL_MS);
    db.prepare("DELETE FROM chat_messages WHERE sent_at <= ?").run(
      time - CHAT_TTL_MS,
    );
  }, 60_000);
  housekeeping.unref();

  const server = createServer(async (req, res) => {
    let kakaoBrowser = false;
    try {
      const url = URL.parse(req.url ?? "/", "http://localhost");
      if (!url) throw new HttpError(400, "올바른 요청 주소가 아닙니다.");
      const route = `${req.method} ${url.pathname}`;
      kakaoBrowser =
        route === "GET /auth/kakao/authorize" ||
        route === "GET /auth/kakao/callback";
      const origin = req.headers.origin;
      if (origin && !origins.has(origin))
        throw new HttpError(403, "허용되지 않은 앱 주소입니다.");
      if (origin) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Access-Control-Expose-Headers", "ETag");
        res.setHeader("Vary", "Origin");
      }
      if (req.method === "OPTIONS") {
        res.writeHead(204, {
          "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
          "Access-Control-Allow-Headers":
            "Content-Type, Authorization, If-None-Match",
          "Access-Control-Max-Age": "600",
        });
        res.end();
        return;
      }
      if (route === "GET /health") {
        json(res, 200, { ok: true });
        return;
      }
      const publicSession =
        route === "POST /session" ||
        route === "POST /session/recover" ||
        route === "POST /auth/kakao/start";
      const publicPreview = route === "POST /invites/preview";
      const kakaoPoll =
        route === "POST /auth/kakao/poll" ||
        route === "POST /auth/kakao/cancel";
      if (req.method !== "GET") {
        // Opt in only behind one trusted proxy with no direct access to this port.
        // Its appended, rightmost address wins over any client-supplied prefix.
        const forwarded = req.headers["x-forwarded-for"];
        const address =
          options.trustProxy && typeof forwarded === "string"
            ? forwarded.split(",").at(-1)?.trim()
            : undefined;
        const ip =
          address && isIP(address) ? address : req.socket.remoteAddress;
        const key = `${ip}:${publicSession ? "session" : publicPreview ? "preview" : kakaoPoll ? "kakao" : "write"}`;
        const limit = limits.get(key);
        const current =
          limit && limit.until > now()
            ? limit
            : { count: 0, until: now() + 60_000 };
        limits.set(key, current);
        if (++current.count > (publicSession ? 10 : kakaoPoll ? 120 : 60)) {
          res.setHeader("Retry-After", "60");
          throw new HttpError(
            429,
            "요청이 많습니다. 잠시 후 다시 시도해 주세요.",
          );
        }
      }
      if (kakaoBrowser) {
        const config = options.kakao;
        if (!config)
          throw new HttpError(
            503,
            "이 서버는 아직 카카오 로그인을 설정하지 않았습니다.",
          );
        const state = url.searchParams.get("state") ?? "";
        const attempt = kakaoAttempts.get(state);
        if (!attempt || attempt.expiresAt <= now() || attempt.processing)
          throw new HttpError(
            400,
            "로그인 요청이 만료되었거나 이미 처리되었습니다. 앱에서 다시 시작해 주세요.",
          );
        const cookieName = `wappy_kakao_${state}`;
        const cookieOptions = `Path=/auth/kakao; HttpOnly; SameSite=Lax${config.redirectUri.startsWith("https:") ? "; Secure" : ""}`;
        const browserCookie = req.headers.cookie
          ?.split(";")
          .map((cookie) => cookie.trim())
          .find((cookie) => cookie.startsWith(`${cookieName}=`))
          ?.slice(cookieName.length + 1);
        if (route === "GET /auth/kakao/authorize") {
          if (
            attempt.browserHash &&
            (!browserCookie || hash(browserCookie) !== attempt.browserHash)
          )
            throw new HttpError(
              400,
              "이미 열린 로그인 요청입니다. 앱에서 다시 시작해 주세요.",
            );
          // A reload in the initiating browser must retain the same binding.
          const browserSecret = attempt.browserHash ? browserCookie! : secret();
          attempt.browserHash = hash(browserSecret);
          const destination = new URL(
            "https://kauth.kakao.com/oauth/authorize",
          );
          destination.search = new URLSearchParams({
            client_id: config.restApiKey,
            redirect_uri: config.redirectUri,
            response_type: "code",
            state,
          }).toString();
          res.writeHead(302, {
            Location: destination.href,
            "Set-Cookie": `${cookieName}=${browserSecret}; Max-Age=600; ${cookieOptions}`,
            "Cache-Control": "no-store",
            "Referrer-Policy": "no-referrer",
          });
          res.end();
          return;
        }
        if (
          !browserCookie ||
          !attempt.browserHash ||
          hash(browserCookie) !== attempt.browserHash
        )
          throw new HttpError(
            400,
            "로그인을 시작한 브라우저를 확인하지 못했습니다. 앱에서 다시 시작해 주세요.",
          );
        attempt.processing = true; // Claim before awaiting Kakao; callbacks are single use.
        res.setHeader(
          "Set-Cookie",
          `${cookieName}=; Max-Age=0; ${cookieOptions}`,
        );
        const code = url.searchParams.get("code");
        if (url.searchParams.has("error") || !code || code.length > 2048) {
          attempt.error =
            "카카오 로그인이 취소되었거나 승인되지 않았습니다. 다시 시도해 주세요.";
        } else {
          try {
            attempt.identity = await kakaoIdentity(
              config,
              code,
              options.kakaoFetch,
            );
          } catch {
            attempt.error =
              "카카오 인증을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.";
          }
        }
        if (attempt.expiresAt <= now() || kakaoAttempts.get(state) !== attempt)
          throw new HttpError(
            400,
            "로그인 요청이 만료되었거나 취소되었습니다. 앱에서 다시 시작해 주세요.",
          );
        loginPage(
          res,
          attempt.error ? 400 : 200,
          attempt.error ??
            "인증을 완료했습니다. Wappy에서 로그인을 마무리하고 있어요.",
        );
        return;
      }
      const body = req.method === "GET" ? undefined : await readBody(req);
      // Authenticate after the last await so recovery also revokes in-flight writes.
      let self: Profile | undefined;
      if (!publicSession && !publicPreview && !kakaoPoll) {
        const token = req.headers.authorization?.match(
          /^Bearer ([A-Za-z0-9_-]{43})$/,
        )?.[1];
        const user = token && authenticate.get(hash(token));
        if (!user)
          throw new HttpError(
            401,
            "프로필 인증에 실패했습니다. 서버 주소를 확인해 주세요.",
          );
        self = user as unknown as Profile;
      }
      switch (route) {
        case "POST /auth/kakao/start": {
          if (!options.kakao)
            throw new HttpError(
              503,
              "이 서버는 아직 카카오 로그인을 설정하지 않았습니다.",
            );
          if (kakaoAttempts.size >= 1000)
            throw new HttpError(
              503,
              "로그인 요청이 많습니다. 잠시 후 다시 시도해 주세요.",
            );
          const loginToken = secret();
          const state = hash(loginToken);
          const expiresAt = now() + KAKAO_LOGIN_TTL_MS;
          kakaoAttempts.set(state, { expiresAt });
          const authorizationUrl = new URL(
            "/auth/kakao/authorize",
            options.kakao.redirectUri,
          );
          authorizationUrl.searchParams.set("state", state);
          reply(res, route, {
            loginToken,
            authorizationUrl: authorizationUrl.href,
            expiresAt,
          });
          break;
        }
        case "POST /auth/kakao/cancel":
        case "POST /auth/kakao/poll": {
          const loginToken = field(body, "loginToken");
          if (!/^[A-Za-z0-9_-]{43}$/.test(loginToken))
            throw new HttpError(400, "잘못된 로그인 요청입니다.");
          const state = hash(loginToken);
          const attempt = kakaoAttempts.get(state);
          if (route === "POST /auth/kakao/cancel") {
            kakaoAttempts.delete(state);
            reply(res, route, { ok: true });
            break;
          }
          if (!attempt || attempt.expiresAt <= now()) {
            kakaoAttempts.delete(state);
            throw new HttpError(
              410,
              "로그인 요청이 만료되었습니다. 다시 시작해 주세요.",
            );
          }
          if (attempt.error) {
            kakaoAttempts.delete(state);
            throw new HttpError(400, attempt.error);
          }
          if (!attempt.identity) {
            reply(res, route, { status: "pending" });
            break;
          }
          const identity = attempt.identity;
          const token = secret();
          let user: Profile;
          db.exec("BEGIN IMMEDIATE");
          try {
            const account = db
              .prepare("SELECT user_id FROM kakao_accounts WHERE kakao_id = ?")
              .get(identity.id);
            if (account) {
              user = profile(account.user_id as string);
              db.prepare("UPDATE users SET token_hash = ? WHERE id = ?").run(
                hash(token),
                user.id,
              );
            } else {
              user = {
                id: randomUUID(),
                name: identity.name,
                character: "chiikawa",
                status: "",
              };
              db.prepare("INSERT INTO users VALUES (?, ?, ?, ?, ?)").run(
                user.id,
                hash(token),
                user.name,
                user.character,
                user.status,
              );
              db.prepare("INSERT INTO kakao_accounts VALUES (?, ?)").run(
                identity.id,
                user.id,
              );
            }
            db.exec("COMMIT");
          } catch (error) {
            db.exec("ROLLBACK");
            throw error;
          }
          kakaoAttempts.delete(state);
          lastSeen.set(user.id, now());
          reply(res, route, {
            status: "complete",
            session: { token, profile: user },
          });
          break;
        }
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
          if (
            !lastSeen.has(self!.id) ||
            time - lastSeen.get(self!.id)! >= ONLINE_TIMEOUT_MS
          )
            presenceRevision++;
          lastSeen.set(self!.id, time);
          const changes = Number(selectChanges.get()!.changes);
          const dataVersion = Number(selectDataVersion.get()!.data_version);
          const matches = (etag: string) =>
            req.headers["if-none-match"]
              ?.split(",")
              .some((tag) => [etag, `W/${etag}`, "*"].includes(tag.trim()));
          const cached = validators.get(self!.id);
          if (
            cached &&
            cached.changes === changes &&
            cached.dataVersion === dataVersion &&
            cached.presenceRevision === presenceRevision &&
            time >= cached.createdAt &&
            time < cached.validUntil &&
            matches(cached.etag)
          ) {
            res.writeHead(304, {
              "Cache-Control": "private, no-store",
              ETag: cached.etag,
            });
            res.end();
            break;
          }
          const rows = selectFriends.all(
            self!.id,
            time - WAVE_TTL_MS,
            self!.id,
            self!.id,
          ) as unknown as (Profile & {
            wave_id: string | null;
            wave_sent_at: number | null;
            sharing: number;
          })[];
          const presence = selectPresence.get(self!.id);
          const messages = (
            selectMessages.all(
              self!.id,
              self!.id,
              self!.id,
              self!.id,
              self!.id,
              self!.id,
              time - CHAT_TTL_MS,
              CHAT_HISTORY_LIMIT,
            ) as unknown as (Omit<ChatMessage, "recipientId"> & {
              recipientId: string | null;
              unread: number;
            })[]
          ).reverse();
          const state: Output<"GET /state"> = {
            self: self!,
            blocking: blocking(self!.id),
            directChat: true,
            chatReporting: options.reportsEnabled === true,
            messages: messages.map(({ recipientId, unread, ...message }) => ({
              ...message,
              ...(recipientId === null ? {} : { recipientId }),
            })),
            unreadChatIds: messages
              .filter((message) => message.unread === 1)
              .map((message) => message.id),
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
          };
          const body = JSON.stringify(state);
          const etag = `"${hash(body)}"`;
          let validUntil = time + ONLINE_TIMEOUT_MS;
          for (const friend of state.friends) {
            if (friend.online)
              validUntil = Math.min(
                validUntil,
                lastSeen.get(friend.id)! + ONLINE_TIMEOUT_MS,
              );
            if (friend.wave)
              validUntil = Math.min(
                validUntil,
                friend.wave.sentAt + WAVE_TTL_MS,
              );
          }
          for (const message of state.messages!)
            validUntil = Math.min(validUntil, message.sentAt + CHAT_TTL_MS);
          if (!validators.has(self!.id) && validators.size >= 1024)
            validators.delete(validators.keys().next().value!);
          validators.set(self!.id, {
            etag,
            changes,
            dataVersion,
            presenceRevision,
            createdAt: time,
            validUntil,
          });
          // Authenticate and refresh presence before validating. Hash the current
          // representation so TTL/offline transitions cannot leave a stale cache.
          const unchanged = matches(etag);
          res.writeHead(unchanged ? 304 : 200, {
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "private, no-store",
            ETag: etag,
          });
          res.end(unchanged ? undefined : body);
          break;
        }
        case "POST /chat":
        case "POST /chat/direct": {
          let text;
          try {
            text = parseChatText(isRecord(body) ? body.text : undefined);
          } catch (error) {
            throw new HttpError(400, (error as Error).message);
          }
          const recipientId =
            route === "POST /chat/direct" ? field(body, "friendId") : undefined;
          if (
            route === "POST /chat" &&
            isRecord(body) &&
            ("friendId" in body || "recipientId" in body)
          )
            throw new HttpError(400, "1:1 채팅 전송 경로를 사용해 주세요.");
          const pair = recipientId ? [self!.id, recipientId].sort() : undefined;
          if (
            pair &&
            !db
              .prepare(
                "SELECT 1 FROM friendships WHERE user_id = ? AND friend_id = ?",
              )
              .get(pair[0]!, pair[1]!)
          )
            throw new HttpError(
              404,
              "연결된 친구에게만 1:1 메시지를 보낼 수 있어요.",
            );
          const time = now();
          const last = db
            .prepare(
              "SELECT sent_at FROM chat_messages WHERE sender_id = ? ORDER BY id DESC LIMIT 1",
            )
            .get(self!.id);
          if (last && time - Number(last.sent_at) < CHAT_COOLDOWN_MS) {
            res.setHeader("Retry-After", "1");
            throw new HttpError(429, "메시지는 1초에 한 번 보낼 수 있어요.");
          }
          db.exec("BEGIN IMMEDIATE");
          let id: number;
          try {
            id = Number(
              db
                .prepare(
                  "INSERT INTO chat_messages (sender_id, recipient_id, text, sent_at) VALUES (?, ?, ?, ?)",
                )
                .run(self!.id, recipientId ?? null, text, time).lastInsertRowid,
            );
            // Snapshot the audience. New/reconnected friends cannot read earlier messages.
            if (pair) {
              db.prepare(
                "INSERT INTO chat_recipients (message_id, user_id, friend_id) VALUES (?, ?, ?)",
              ).run(id, pair[0]!, pair[1]!);
            } else
              db.prepare(
                `INSERT INTO chat_recipients (message_id, user_id, friend_id)
              SELECT ?, user_id, friend_id FROM friendships WHERE user_id = ? OR friend_id = ?
            `,
              ).run(id, self!.id, self!.id);
            db.prepare(
              `DELETE FROM chat_messages WHERE sender_id = ? AND id NOT IN (
              SELECT id FROM chat_messages WHERE sender_id = ? ORDER BY id DESC LIMIT ?
            )`,
            ).run(self!.id, self!.id, CHAT_HISTORY_LIMIT);
            db.exec("COMMIT");
          } catch (error) {
            db.exec("ROLLBACK");
            throw error;
          }
          reply(
            res,
            route,
            {
              id,
              senderId: self!.id,
              ...(recipientId ? { recipientId } : {}),
              text,
              sentAt: time,
            },
            201,
          );
          break;
        }
        case "GET /chat/reports": {
          reply(res, route, reports.receipts(self!.id));
          break;
        }
        case "POST /chat/report": {
          if (!options.reportsEnabled)
            throw new HttpError(
              503,
              "이 서버는 현재 새 메시지 신고를 받지 않아요. 불편한 친구는 차단할 수 있어요.",
            );
          let input;
          try {
            input = parseChatReportInput(body);
          } catch (error) {
            throw new HttpError(400, (error as Error).message);
          }
          reply(res, route, reports.submit(self!.id, input));
          break;
        }
        case "POST /chat/read": {
          let messageIds: number[];
          try {
            messageIds = parseChatMessageIds(
              isRecord(body) ? body.messageIds : undefined,
            );
          } catch (error) {
            throw new HttpError(400, (error as Error).message);
          }
          db.exec("BEGIN IMMEDIATE");
          try {
            const cutoff = now() - CHAT_TTL_MS;
            for (const id of messageIds) {
              const result = acknowledgeChat.run(
                id,
                self!.id,
                self!.id,
                self!.id,
                cutoff,
              );
              if (!result.changes)
                throw new HttpError(
                  404,
                  "메시지를 확인할 수 없어요. 최신 대화 목록을 확인해 주세요.",
                );
            }
            db.exec("COMMIT");
          } catch (error) {
            db.exec("ROLLBACK");
            throw error;
          }
          reply(res, route, { messageIds });
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
            db.prepare(
              `UPDATE blocking_settings SET revision = revision + 1
              WHERE user_id IN (SELECT user_id FROM profile_blocks WHERE blocked_id = ?)`,
            ).run(self!.id);
            db.prepare("DELETE FROM users WHERE id = ?").run(self!.id);
            db.exec("COMMIT");
          } catch (error) {
            db.exec("ROLLBACK");
            throw error;
          }
          lastSeen.delete(self!.id);
          validators.delete(self!.id);
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
            if (blockedPair.get(self!.id, friendId, friendId, self!.id))
              throw new HttpError(
                409,
                "이 초대장으로는 친구를 연결할 수 없어요.",
              );
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
        case "POST /friends/remove":
        case "POST /friends/block": {
          const friendId = field(body, "friendId");
          if (route === "POST /friends/block" && friendId === self!.id)
            throw new HttpError(400, "내 프로필은 차단할 수 없어요.");
          const pair = [self!.id, friendId].sort();
          db.exec("BEGIN IMMEDIATE");
          try {
            if (route === "POST /friends/block") {
              if (!profile(friendId))
                throw new HttpError(404, "프로필을 찾을 수 없어요.");
              const result = db
                .prepare(
                  `INSERT OR IGNORE INTO profile_blocks (user_id, blocked_id, name, character)
                SELECT ?, id, name, character FROM users WHERE id = ?`,
                )
                .run(self!.id, friendId);
              if (result.changes) advanceBlocking.run(self!.id);
            }
            db.prepare(
              `DELETE FROM chat_messages
              WHERE (sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?)`,
            ).run(pair[0]!, pair[1]!, pair[1]!, pair[0]!);
            db.prepare(
              "DELETE FROM friendships WHERE user_id = ? AND friend_id = ?",
            ).run(pair[0]!, pair[1]!);
            db.exec("COMMIT");
          } catch (error) {
            db.exec("ROLLBACK");
            throw error;
          }
          if (route === "POST /friends/block")
            reply(res, route, blocking(self!.id));
          else reply(res, route, { ok: true });
          break;
        }
        case "POST /friends/unblock": {
          const friendId = field(body, "friendId");
          db.exec("BEGIN IMMEDIATE");
          try {
            const result = db
              .prepare(
                "DELETE FROM profile_blocks WHERE user_id = ? AND blocked_id = ?",
              )
              .run(self!.id, friendId);
            if (result.changes) advanceBlocking.run(self!.id);
            db.exec("COMMIT");
          } catch (error) {
            db.exec("ROLLBACK");
            throw error;
          }
          reply(res, route, blocking(self!.id));
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
      const known = error instanceof HttpError || error instanceof ReportError;
      const status = known ? error.status : 500;
      if (status === 500) console.error("Request failed:", error);
      const body: ApiErrorBody = {
        error: known ? error.message : "서버 오류가 발생했습니다.",
      };
      if (!res.headersSent && !res.destroyed) {
        if (kakaoBrowser) loginPage(res, status, body.error);
        else json(res, status, body);
      }
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
