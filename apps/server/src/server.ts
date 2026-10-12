import { createHash, randomBytes, randomInt, randomUUID } from "node:crypto";
import { createServer, type ServerResponse } from "node:http";
import { isIP } from "node:net";
import { HttpError, field, json, readBody, reply } from "./http.ts";
import { openDatabase, transaction } from "./database.ts";
import { kakaoIdentity, type KakaoConfig } from "./kakao.ts";
import {
  ONLINE_TIMEOUT_MS,
  ATTACK_COOLDOWN_MS,
  ATTACK_TTL_MS,
  ATTACK_HISTORY_LIMIT,
  type AttackEvent,
  CHAT_COOLDOWN_MS,
  CHAT_HISTORY_LIMIT,
  CHAT_TTL_MS,
  isRecord,
  parseChatText,
  parseProfile,
  type ApiErrorBody,
  type Output,
  type Profile,
  type ChatMessage,
  type BlockedProfile,
} from "@wappy/api";

const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const secret = () => randomBytes(32).toString("base64url");
const INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
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

function inviteCode(body: unknown): string {
  const code = field(body, "code");
  // Older 43-character invitations remain case-sensitive.
  return code.length === 5 ? code.toUpperCase() : code;
}

export function createApp(options: {
  databasePath: string;
  origins?: string[];
  trustProxy?: boolean;
  now?: () => number;
  kakao?: KakaoConfig;
  kakaoFetch?: typeof fetch;
}) {
  const db = openDatabase(options.databasePath);
  const now = options.now ?? Date.now;
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
    "SELECT id, name, character FROM users WHERE id = ?",
  );
  const authenticate = db.prepare(
    "SELECT id, name, character FROM users WHERE token_hash = ?",
  );
  const selectFriends = db.prepare(`
    SELECT u.id, u.name, u.character,
      COALESCE(p.sharing, 1) AS sharing
    FROM friendships f
    JOIN users u ON u.id = CASE WHEN f.user_id = ? THEN f.friend_id ELSE f.user_id END
    LEFT JOIN presence_settings p ON p.user_id = u.id
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
  // Keep legacy private rows out of the broadcast feed.
  const selectMessages = db.prepare(`
    SELECT id, sender_id AS senderId, text, sent_at AS sentAt
    FROM chat_messages
    WHERE id IN (
      SELECT id FROM chat_messages WHERE sender_id = ?
      UNION ALL SELECT message_id FROM chat_recipients WHERE user_id = ?
      UNION ALL SELECT message_id FROM chat_recipients WHERE friend_id = ?
    ) AND recipient_id IS NULL AND sent_at > ? ORDER BY id DESC LIMIT ?
  `);
  const selectAttacks =
    db.prepare(`SELECT id, attacker_id AS attackerId, target_id AS targetId, sent_at AS sentAt
    FROM attack_events WHERE (attacker_id = ? OR target_id = ?) AND sent_at > ?
    ORDER BY id DESC LIMIT ?`);
  const selectChanges = db.prepare("SELECT total_changes() AS changes");
  const selectDataVersion = db.prepare("PRAGMA data_version");
  const profile = (id: string) => selectProfile.get(id) as unknown as Profile;
  const housekeeping = setInterval(() => {
    const time = now();
    for (const [id, validator] of validators)
      if (validator.validUntil <= time) validators.delete(id);
    for (const [id, seen] of lastSeen)
      if (time - seen >= ONLINE_TIMEOUT_MS) lastSeen.delete(id);
    for (const [ip, limit] of limits)
      if (limit.until <= time) limits.delete(ip);
    for (const [state, attempt] of kakaoAttempts)
      if (attempt.expiresAt <= time) kakaoAttempts.delete(state);
    db.prepare("DELETE FROM attack_events WHERE sent_at <= ?").run(
      time - ATTACK_TTL_MS,
    );
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
        route === "POST /session" || route === "POST /auth/kakao/start";
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
      // Authenticate after the last await so revoked sessions cannot complete in-flight writes.
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
          const user = transaction(db, () => {
            let user: Profile;
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
              };
              db.prepare("INSERT INTO users VALUES (?, ?, ?, ?)").run(
                user.id,
                hash(token),
                user.name,
                user.character,
              );
              db.prepare("INSERT INTO kakao_accounts VALUES (?, ?)").run(
                identity.id,
                user.id,
              );
            }
            return user;
          });
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
          db.prepare("INSERT INTO users VALUES (?, ?, ?, ?)").run(
            user.id,
            hash(token),
            user.name,
            user.character,
          );
          lastSeen.set(user.id, now());
          reply(res, route, { token, profile: user }, 201);
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
            self!.id,
            self!.id,
          ) as unknown as (Profile & {
            sharing: number;
          })[];
          const presence = selectPresence.get(self!.id);
          const messages = (
            selectMessages.all(
              self!.id,
              self!.id,
              self!.id,
              time - CHAT_TTL_MS,
              CHAT_HISTORY_LIMIT,
            ) as unknown as ChatMessage[]
          ).reverse();
          const state: Output<"GET /state"> = {
            self: self!,
            attacks: (
              selectAttacks.all(
                self!.id,
                self!.id,
                time - ATTACK_TTL_MS,
                ATTACK_HISTORY_LIMIT,
              ) as unknown as AttackEvent[]
            ).reverse(),
            blocking: blocking(self!.id),
            messages,
            presence: {
              sharing: presence ? presence.sharing === 1 : true,
              revision: presence ? Number(presence.revision) : 0,
            },
            friends: rows.map(({ sharing, ...friend }) => ({
              ...friend,
              online:
                sharing === 1 &&
                lastSeen.has(friend.id) &&
                time - lastSeen.get(friend.id)! < ONLINE_TIMEOUT_MS,
            })),
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
          }
          for (const message of state.messages!)
            validUntil = Math.min(validUntil, message.sentAt + CHAT_TTL_MS);
          for (const attack of state.attacks!)
            validUntil = Math.min(validUntil, attack.sentAt + ATTACK_TTL_MS);
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
        case "POST /chat": {
          let text;
          try {
            text = parseChatText(isRecord(body) ? body.text : undefined);
          } catch (error) {
            throw new HttpError(400, (error as Error).message);
          }
          if (isRecord(body) && ("friendId" in body || "recipientId" in body))
            throw new HttpError(400, "개인 채팅은 지원하지 않아요.");
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
          const id = transaction(db, () => {
            const id = Number(
              db
                .prepare(
                  "INSERT INTO chat_messages (sender_id, text, sent_at) VALUES (?, ?, ?)",
                )
                .run(self!.id, text, time).lastInsertRowid,
            );
            // Snapshot the audience. New/reconnected friends cannot read earlier messages.
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
            return id;
          });
          reply(
            res,
            route,
            {
              id,
              senderId: self!.id,
              text,
              sentAt: time,
            },
            201,
          );
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
            "UPDATE users SET name = ?, character = ? WHERE id = ?",
          ).run(input.name, input.character, self!.id);
          reply(res, route, { ...input, id: self!.id });
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
          // Reserve atomically: a collision must never replace another invitation
          // or reuse this owner's previous code, including across server processes.
          const issue = db.prepare(
            `INSERT INTO invites SELECT ?, ?
            WHERE NOT EXISTS (SELECT 1 FROM invites WHERE code_hash = ?)
            ON CONFLICT(owner_id)
            DO UPDATE SET code_hash = excluded.code_hash`,
          );
          let invitation: Output<"POST /invites"> | undefined;
          for (let attempt = 0; attempt < 10; attempt++) {
            const code = Array.from(
              { length: 5 },
              () => INVITE_ALPHABET[randomInt(INVITE_ALPHABET.length)],
            ).join("");
            const digest = hash(code);
            if (issue.run(digest, self!.id, digest).changes) {
              invitation = { code };
              break;
            }
          }
          if (!invitation)
            throw new HttpError(
              503,
              "초대 코드를 만들지 못했어요. 다시 시도해 주세요.",
            );
          reply(res, route, invitation, 201);
          break;
        }
        case "POST /invites/preview": {
          const invite = db
            .prepare(
              `SELECT users.name, users.character
               FROM invites JOIN users ON users.id = invites.owner_id
               WHERE invites.code_hash = ?`,
            )
            .get(hash(inviteCode(body)));
          if (!invite)
            throw new HttpError(404, "유효하지 않은 초대 코드입니다.");
          reply(res, route, {
            name: invite.name as string,
            character: invite.character as Profile["character"],
          });
          break;
        }
        case "POST /invites/accept": {
          const code = inviteCode(body);
          // Keep validation and friendship creation atomic across server processes.
          const friendId = transaction(db, () => {
            const invite = db
              .prepare("SELECT owner_id FROM invites WHERE code_hash = ?")
              .get(hash(code));
            if (!invite)
              throw new HttpError(404, "유효하지 않은 초대 코드입니다.");
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
            return friendId;
          });
          reply(res, route, profile(friendId));
          break;
        }
        case "POST /friends/remove":
        case "POST /friends/block": {
          const friendId = field(body, "friendId");
          if (route === "POST /friends/block" && friendId === self!.id)
            throw new HttpError(400, "내 프로필은 차단할 수 없어요.");
          const pair = [self!.id, friendId].sort();
          transaction(db, () => {
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
          });
          if (route === "POST /friends/block")
            reply(res, route, blocking(self!.id));
          else reply(res, route, { ok: true });
          break;
        }
        case "POST /friends/unblock": {
          const friendId = field(body, "friendId");
          transaction(db, () => {
            const result = db
              .prepare(
                "DELETE FROM profile_blocks WHERE user_id = ? AND blocked_id = ?",
              )
              .run(self!.id, friendId);
            if (result.changes) advanceBlocking.run(self!.id);
          });
          reply(res, route, blocking(self!.id));
          break;
        }
        case "POST /friends/attack": {
          const friendId = field(body, "friendId");
          const pair = [self!.id, friendId].sort();
          if (
            blockedPair.get(self!.id, friendId, friendId, self!.id) ||
            !db
              .prepare(
                "SELECT 1 FROM friendships WHERE user_id = ? AND friend_id = ?",
              )
              .get(pair[0]!, pair[1]!)
          )
            throw new HttpError(404, "연결된 친구에게만 공격할 수 있어요.");
          const time = now();
          for (const id of [self!.id, friendId]) {
            if (
              selectPresence.get(id)?.sharing === 0 ||
              !lastSeen.has(id) ||
              time - lastSeen.get(id)! >= ONLINE_TIMEOUT_MS
            )
              throw new HttpError(
                409,
                "두 캐릭터가 접속 상태를 공개하고 온라인일 때 공격할 수 있어요.",
              );
          }
          // A single guarded insert enforces the sender cooldown across all targets and restarts.
          const attack = db
            .prepare(
              `INSERT INTO attack_events (user_id, friend_id, attacker_id, target_id, sent_at)
            SELECT user_id, friend_id, ?, ?, ? FROM friendships WHERE user_id = ? AND friend_id = ?
            AND NOT EXISTS (SELECT 1 FROM attack_events WHERE attacker_id = ? AND sent_at > ?)
            RETURNING id, attacker_id AS attackerId, target_id AS targetId, sent_at AS sentAt`,
            )
            .get(
              self!.id,
              friendId,
              time,
              pair[0]!,
              pair[1]!,
              self!.id,
              time - ATTACK_COOLDOWN_MS,
            ) as unknown as AttackEvent | undefined;
          if (!attack) {
            res.setHeader("Retry-After", String(ATTACK_COOLDOWN_MS / 1000));
            throw new HttpError(429, "공격은 2초에 한 번 보낼 수 있어요.");
          }
          reply(res, route, attack, 201);
          break;
        }
        default:
          throw new HttpError(404, "API 경로를 찾을 수 없습니다.");
      }
    } catch (error) {
      const known = error instanceof HttpError;
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
