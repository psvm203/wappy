import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createServer, type ServerResponse } from "node:http";
import { isIP } from "node:net";
import { kakaoIdentity, type KakaoConfig } from "./kakao.ts";
import { HttpError, field, json, readBody, reply } from "./http.ts";
import { createRoom, openDatabase, transaction } from "./database.ts";
import {
  ONLINE_TIMEOUT_MS,
  HEARTBEAT_INTERVAL_MS,
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
} from "@wappy/api";

const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const secret = () => randomBytes(32).toString("base64url");

const KAKAO_LOGIN_TTL_MS = 10 * 60_000;

interface KakaoAttempt {
  expiresAt: number;
  profileTokenHash?: string;
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
  // ponytail: login attempts live in one process; use shared TTL storage before replicas.
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
    `SELECT u.id, u.name, u.character FROM sessions s
     JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`,
  );
  const insertSession = db.prepare(
    "INSERT INTO sessions (token_hash, user_id) VALUES (?, ?)",
  );
  const selectSession = db.prepare(
    "SELECT 1 FROM sessions WHERE user_id = ? LIMIT 1",
  );
  const selectAccount = db.prepare(
    "SELECT 1 FROM kakao_accounts WHERE user_id = ?",
  );
  const selectFriends = db.prepare(`
    SELECT u.id, u.name, u.character,
      COALESCE(p.sharing, 1) AS sharing
    FROM friendships f
    JOIN users u ON u.id = CASE WHEN f.user_id = ? THEN f.friend_id ELSE f.user_id END
    LEFT JOIN presence_settings p ON p.user_id = u.id
    WHERE f.user_id = ? OR f.friend_id = ? ORDER BY u.name, u.id
  `);
  const selectRoom = db.prepare(`
    SELECT r.id, r.name, r.invite_code AS inviteCode
    FROM room_members m JOIN rooms r ON r.id = m.room_id
    WHERE m.user_id = ?
  `);
  const selectInviteProfile = db.prepare(`
    SELECT users.id, users.name, users.character
    FROM invites JOIN users ON users.id = invites.owner_id
    WHERE invites.code_hash = ?
  `);
  const selectPresence = db.prepare(
    "SELECT sharing, revision FROM presence_settings WHERE user_id = ?",
  );
  const selectSleepHits = db.prepare(
    "SELECT last_count FROM sleep_hit_counts WHERE user_id = ?",
  );
  const recordSleepHit = db.prepare(`
    INSERT INTO sleep_hit_counts (user_id, pending_count) VALUES (?, 1)
    ON CONFLICT(user_id) DO UPDATE SET pending_count = pending_count + 1
  `);
  const finishSleep = db.prepare(`
    UPDATE sleep_hit_counts SET last_count = pending_count, pending_count = 0
    WHERE user_id = ? AND (pending_count != 0 OR last_count != 0)
  `);
  function isOnline(id: string, time: number) {
    const seen = lastSeen.get(id);
    return seen !== undefined && time - seen < ONLINE_TIMEOUT_MS;
  }
  function markSeen(id: string, time: number) {
    if (!isOnline(id, time)) {
      // Retain this absence's result throughout the connection, including repeated polls.
      finishSleep.run(id);
      presenceRevision++;
      publish();
    }
    lastSeen.set(id, time);
  }
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
  // Both participants must be visible to this room member.
  const selectAttacks = db.prepare(`
    WITH visible(id) AS (
      SELECT ?
      UNION SELECT friend_id FROM friendships WHERE user_id = ?
      UNION SELECT user_id FROM friendships WHERE friend_id = ?
    )
    SELECT id, attacker_id AS attackerId, target_id AS targetId, sent_at AS sentAt
    FROM attack_events WHERE attacker_id IN (SELECT id FROM visible)
      AND target_id IN (SELECT id FROM visible) AND sent_at > ?
    ORDER BY id DESC LIMIT ?`);
  const selectChanges = db.prepare("SELECT total_changes() AS changes");
  const selectDataVersion = db.prepare("PRAGMA data_version");
  const profile = (id: string) => selectProfile.get(id) as unknown as Profile;
  function snapshot(self: Profile, time: number, previous?: string) {
    const changes = Number(selectChanges.get()!.changes);
    const dataVersion = Number(selectDataVersion.get()!.data_version);
    const cached = validators.get(self.id);
    if (
      cached &&
      cached.etag === previous &&
      cached.changes === changes &&
      cached.dataVersion === dataVersion &&
      cached.presenceRevision === presenceRevision &&
      time >= cached.createdAt &&
      time < cached.validUntil
    )
      return { etag: cached.etag, validUntil: cached.validUntil };
    const rows = selectFriends.all(
      self.id,
      self.id,
      self.id,
    ) as unknown as (Profile & {
      sharing: number;
    })[];
    const presence = selectPresence.get(self.id);
    const messages = (
      selectMessages.all(
        self.id,
        self.id,
        self.id,
        time - CHAT_TTL_MS,
        CHAT_HISTORY_LIMIT,
      ) as unknown as ChatMessage[]
    ).reverse();
    const room = selectRoom.get(
      self.id,
    ) as unknown as Output<"GET /state">["room"];
    // The permanent code keeps the room's owner stable across name changes.
    if (room?.inviteCode) {
      const owner = selectInviteProfile.get(hash(room.inviteCode));
      if (owner) {
        room.name = `${owner.name}의 방`;
        room.ownerId = owner.id as string;
      }
    }
    const state: Output<"GET /state"> = {
      self,
      account: {
        kakao: !!selectAccount.get(self.id),
      },
      sleepHitCount: Number(selectSleepHits.get(self.id)?.last_count ?? 0),
      room,
      attacks: (
        selectAttacks.all(
          self.id,
          self.id,
          self.id,
          time - ATTACK_TTL_MS,
          ATTACK_HISTORY_LIMIT,
        ) as unknown as AttackEvent[]
      ).reverse(),
      messages,
      presence: {
        sharing: presence ? presence.sharing === 1 : true,
        revision: presence ? Number(presence.revision) : 0,
      },
      friends: rows.map(({ sharing, ...friend }) => ({
        ...friend,
        online: sharing === 1 && isOnline(friend.id, time),
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
    if (!validators.has(self.id) && validators.size >= 1024)
      validators.delete(validators.keys().next().value!);
    validators.set(self.id, {
      etag,
      changes,
      dataVersion,
      presenceRevision,
      createdAt: time,
      validUntil,
    });
    return { etag, validUntil, body: etag === previous ? undefined : body };
  }

  type StateStream = {
    res: ServerResponse;
    tokenHash: string;
    etag?: string;
    validUntil: number;
    keepaliveAt: number;
  };
  const streams = new Set<StateStream>();
  function writeStream(stream: { res: ServerResponse }, data: string) {
    // Keep at most one pending frame for a slow reader. Reconnecting gets a fresh snapshot.
    if (
      stream.res.destroyed ||
      stream.res.writableEnded ||
      stream.res.writableNeedDrain
    ) {
      stream.res.destroy();
      return;
    }
    stream.res.write(data);
  }
  function updateStream(stream: StateStream, time: number) {
    try {
      const user = authenticate.get(stream.tokenHash) as unknown as
        | Profile
        | undefined;
      if (!user) {
        writeStream(stream, "event: unauthorized\ndata: {}\n\n");
        stream.res.end();
        return;
      }
      const next = snapshot(user, time, stream.etag);
      stream.etag = next.etag;
      stream.validUntil = next.validUntil;
      if (next.body !== undefined)
        writeStream(stream, `event: state\ndata: ${next.body}\n\n`);
      if (time >= stream.keepaliveAt) {
        // These comments keep the transport active, but never refresh lastSeen.
        if (next.body === undefined) writeStream(stream, ": keepalive\n\n");
        stream.keepaliveAt = time + HEARTBEAT_INTERVAL_MS;
      }
    } catch (error) {
      console.error("State stream failed:", error);
      stream.res.destroy();
    }
  }
  let pendingPush: ReturnType<typeof setImmediate> | undefined;
  function publish() {
    if (!streams.size || pendingPush) return;
    // ponytail: scan active subscribers after writes; target affected rooms if fan-out becomes costly.
    pendingPush = setImmediate(() => {
      pendingPush = undefined;
      const time = now();
      for (const stream of streams) updateStream(stream, time);
    });
  }
  // Expire presence and events even when nobody writes. Idle connections only send comments.
  const streaming = setInterval(() => {
    const time = now();
    for (const stream of streams)
      if (time >= stream.validUntil || time >= stream.keepaliveAt)
        updateStream(stream, time);
  }, 1000);
  streaming.unref();

  const housekeeping = setInterval(() => {
    const time = now();
    for (const [id, validator] of validators)
      if (validator.validUntil <= time) validators.delete(id);
    for (const [id, seen] of lastSeen)
      if (time - seen >= ONLINE_TIMEOUT_MS) lastSeen.delete(id);
    for (const [state, attempt] of kakaoAttempts)
      if (attempt.expiresAt <= time) kakaoAttempts.delete(state);
    for (const [ip, limit] of limits)
      if (limit.until <= time) limits.delete(ip);
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
      const kakaoStart = route === "POST /auth/kakao/start";
      const kakaoPoll =
        route === "POST /auth/kakao/poll" ||
        route === "POST /auth/kakao/cancel";
      const publicSession = route === "POST /session" || kakaoStart;
      const publicPreview = route === "POST /invites/preview";
      if (req.method !== "GET" && route !== "POST /heartbeat") {
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
      let tokenHash = "";
      if (
        (!publicSession && !publicPreview && !kakaoPoll) ||
        (kakaoStart && req.headers.authorization !== undefined)
      ) {
        const token = req.headers.authorization?.match(
          /^Bearer ([A-Za-z0-9_-]{43})$/,
        )?.[1];
        tokenHash = token ? hash(token) : "";
        const user = token && authenticate.get(tokenHash);
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
          kakaoAttempts.set(state, {
            expiresAt,
            ...(self ? { profileTokenHash: tokenHash } : {}),
          });
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
            const current = attempt.profileTokenHash
              ? (authenticate.get(attempt.profileTokenHash) as unknown as
                  | Profile
                  | undefined)
              : undefined;
            if (attempt.profileTokenHash && !current)
              throw new HttpError(
                401,
                "프로필이 바뀌었어요. 다시 로그인해 주세요.",
              );
            const account = db
              .prepare("SELECT user_id FROM kakao_accounts WHERE kakao_id = ?")
              .get(identity.id);
            let user: Profile;
            if (account) user = profile(account.user_id as string);
            else if (current) {
              if (
                db
                  .prepare("SELECT 1 FROM kakao_accounts WHERE user_id = ?")
                  .get(current.id)
              )
                throw new HttpError(
                  409,
                  "이미 다른 카카오 계정과 연결된 프로필입니다. 로그아웃한 뒤 다시 시도해 주세요.",
                );
              user = current;
              db.prepare("INSERT INTO kakao_accounts VALUES (?, ?)").run(
                identity.id,
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
              createRoom(db, user);
              db.prepare("INSERT INTO kakao_accounts VALUES (?, ?)").run(
                identity.id,
                user.id,
              );
            }
            insertSession.run(hash(token), user.id);
            return user;
          });
          kakaoAttempts.delete(state);
          markSeen(user.id, now());
          reply(res, route, {
            status: "complete",
            session: { token, profile: user },
          });
          break;
        }
        case "POST /session/logout": {
          // Revoke only this device; other sessions keep their presence and streams.
          db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(
            tokenHash,
          );
          if (!selectSession.get(self!.id)) {
            lastSeen.delete(self!.id);
            presenceRevision++;
          }
          reply(res, route, { ok: true });
          break;
        }

        case "POST /heartbeat": {
          const time = now();
          const key = `heartbeat:${self!.id}`;
          const previous = limits.get(key);
          const limit =
            previous && previous.until > time
              ? previous
              : { count: 0, until: time + 60_000 };
          limits.set(key, limit);
          if (++limit.count > 60)
            throw new HttpError(429, "접속 확인 요청이 너무 많습니다.");
          markSeen(self!.id, time);
          res.writeHead(204, { "Cache-Control": "no-store" });
          res.end();
          break;
        }
        case "GET /events": {
          if (
            streams.size >= 1024 ||
            [...streams].filter((stream) => stream.tokenHash === tokenHash)
              .length >= 4
          )
            throw new HttpError(
              429,
              "연결이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
            );
          const time = now();
          markSeen(self!.id, time);
          res.writeHead(200, {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "private, no-store, no-transform",
          });
          res.flushHeaders();
          const stream = {
            res,
            tokenHash,
            validUntil: time,
            keepaliveAt: time + HEARTBEAT_INTERVAL_MS,
          };
          streams.add(stream);
          res.once("close", () => streams.delete(stream));
          updateStream(stream, time);
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
          transaction(db, () => {
            db.prepare("INSERT INTO users VALUES (?, ?, ?, ?)").run(
              user.id,
              hash(token),
              user.name,
              user.character,
            );
            insertSession.run(hash(token), user.id);
            createRoom(db, user);
          });
          markSeen(user.id, now());
          reply(res, route, { token, profile: user }, 201);
          break;
        }
        case "GET /state": {
          const time = now();
          markSeen(self!.id, time);
          const previous = req.headers["if-none-match"]
            ?.split(",")
            .map((tag) => tag.trim().replace(/^W\//, ""));
          const cached = validators.get(self!.id);
          const next = snapshot(
            self!,
            time,
            cached &&
              (previous?.includes(cached.etag) || previous?.includes("*"))
              ? cached.etag
              : undefined,
          );
          const { etag, body } = next;
          // Authenticate and refresh presence before validating. Hash the current
          // representation so TTL/offline transitions cannot leave a stale cache.
          const unchanged = previous?.includes(etag) || previous?.includes("*");
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
          markSeen(self!.id, now());
          reply(res, route, {
            sharing: setting.sharing === 1,
            revision: Number(setting.revision),
          });
          break;
        }
        case "POST /invites": {
          // Older clients can retrieve the room's code, but cannot replace it.
          const room = selectRoom.get(self!.id)!;
          reply(res, route, { code: room.inviteCode as string });
          break;
        }
        case "POST /invites/preview": {
          const invite = selectInviteProfile.get(hash(inviteCode(body)));
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
          // Keep joining and all member connections atomic across server processes.
          const friendId = transaction(db, () => {
            const invite = db
              .prepare(
                "SELECT owner_id, room_id FROM invites WHERE code_hash = ?",
              )
              .get(hash(code));
            if (!invite)
              throw new HttpError(404, "유효하지 않은 초대 코드입니다.");
            const roomId = invite.room_id as string;
            const currentRoom = selectRoom.get(self!.id)?.id;
            const friendId = invite.owner_id as string;
            if (currentRoom !== roomId) {
              db.prepare(
                "DELETE FROM friendships WHERE user_id = ? OR friend_id = ?",
              ).run(self!.id, self!.id);
              db.prepare(
                "DELETE FROM chat_messages WHERE recipient_id IS NOT NULL AND (sender_id = ? OR recipient_id = ?)",
              ).run(self!.id, self!.id);
              db.prepare("DELETE FROM room_members WHERE user_id = ?").run(
                self!.id,
              );
            }
            const membership = db
              .prepare("INSERT OR IGNORE INTO room_members VALUES (?, ?)")
              .run(roomId, self!.id);
            // Materialize only this participant's links. This keeps existing chat
            // snapshots/removals intact and never pulls in friends from other rooms.
            // ponytail: pairs use O(n²) room storage; query memberships if large rooms become common.
            const connections = db
              .prepare(
                `INSERT OR IGNORE INTO friendships
              SELECT MIN(?, m.user_id), MAX(?, m.user_id) FROM room_members m
              WHERE m.room_id = ? AND m.user_id <> ?`,
              )
              .run(self!.id, self!.id, roomId, self!.id);
            if (!membership.changes && !connections.changes)
              throw new HttpError(409, "이미 참여 중인 방입니다.");
            return friendId;
          });
          reply(res, route, profile(friendId));
          break;
        }
        case "POST /rooms/leave": {
          transaction(db, () => {
            const room = selectRoom.get(self!.id) as
              | { id: string; inviteCode: string }
              | undefined;
            if (!room)
              throw new HttpError(404, "참여 중인 방을 찾을 수 없어요.");
            const ownerId = selectInviteProfile.get(hash(room.inviteCode))?.id;
            if (ownerId === self!.id) {
              const members = db
                .prepare(
                  `SELECT u.id, u.name FROM room_members m
                  JOIN users u ON u.id = m.user_id WHERE m.room_id = ?`,
                )
                .all(room.id) as unknown as Pick<Profile, "id" | "name">[];
              db.prepare(
                `DELETE FROM friendships WHERE
                user_id IN (SELECT user_id FROM room_members WHERE room_id = ?) OR
                friend_id IN (SELECT user_id FROM room_members WHERE room_id = ?)`,
              ).run(room.id, room.id);
              db.prepare("DELETE FROM rooms WHERE id = ?").run(room.id);
              for (const member of members) createRoom(db, member);
            } else {
              db.prepare(
                "DELETE FROM friendships WHERE user_id = ? OR friend_id = ?",
              ).run(self!.id, self!.id);
              db.prepare("DELETE FROM room_members WHERE user_id = ?").run(
                self!.id,
              );
              createRoom(db, self!);
            }
          });
          reply(res, route, { ok: true });
          break;
        }
        case "POST /friends/remove": {
          const friendId = field(body, "friendId");
          if (friendId === self!.id)
            throw new HttpError(400, "자신을 추방할 수 없어요.");
          transaction(db, () => {
            const room = selectRoom.get(self!.id);
            if (
              !room ||
              selectInviteProfile.get(hash(room.inviteCode as string))?.id !==
                self!.id
            )
              throw new HttpError(403, "방장만 친구를 추방할 수 있어요.");
            if (selectRoom.get(friendId)?.id !== room.id)
              throw new HttpError(404, "같은 방의 친구를 찾을 수 없어요.");
            // Cascading deletes revoke chat delivery and attacks for every room member.
            db.prepare(
              "DELETE FROM friendships WHERE user_id = ? OR friend_id = ?",
            ).run(friendId, friendId);
            db.prepare(
              "DELETE FROM chat_messages WHERE recipient_id IS NOT NULL AND (sender_id = ? OR recipient_id = ?)",
            ).run(friendId, friendId);
            db.prepare("DELETE FROM room_members WHERE user_id = ?").run(
              friendId,
            );
            createRoom(db, profile(friendId));
          });
          reply(res, route, { ok: true });
          break;
        }
        case "POST /friends/attack": {
          const friendId = field(body, "friendId");
          const pair = [self!.id, friendId].sort();
          if (
            !db
              .prepare(
                "SELECT 1 FROM friendships WHERE user_id = ? AND friend_id = ?",
              )
              .get(pair[0]!, pair[1]!)
          )
            throw new HttpError(404, "연결된 친구에게만 공격할 수 있어요.");
          const time = now();
          if (
            selectPresence.get(self!.id)?.sharing === 0 ||
            !isOnline(self!.id, time)
          )
            throw new HttpError(
              409,
              "접속 상태를 공개하고 온라인일 때 공격할 수 있어요.",
            );
          // A single guarded insert enforces the sender cooldown across all targets and restarts.
          const attack = transaction(db, () => {
            const event = db
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
            // Hidden presence is cosmetic: only a missing heartbeat counts as sleep.
            if (event && !isOnline(friendId, time))
              recordSleepHit.run(friendId);
            return event;
          });
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
      // Committed writes must reach subscribers even if the sender loses its response.
      if (req.method !== "GET" && route !== "POST /heartbeat") publish();
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
    clearInterval(streaming);
    clearImmediate(pendingPush);
    streams.clear();
    db.close();
  });
  return server;
}
