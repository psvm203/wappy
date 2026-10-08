import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { createApp } from "./server.ts";
import { kakaoConfig, type KakaoConfig } from "./kakao.ts";

const config: KakaoConfig = {
  restApiKey: "test-rest-key",
  clientSecret: "test-client-secret",
  redirectUri: "http://localhost:3001/auth/kakao/callback",
};

test("Kakao configuration is optional, complete, and restricted to safe callback URLs", () => {
  assert.equal(kakaoConfig({}), undefined);
  const env = {
    KAKAO_REST_API_KEY: config.restApiKey,
    KAKAO_CLIENT_SECRET: config.clientSecret,
    KAKAO_REDIRECT_URI: config.redirectUri,
  };
  assert.deepEqual(kakaoConfig(env), config);
  assert.throws(() => kakaoConfig({ KAKAO_REST_API_KEY: "partial" }));
  for (const url of [
    "https://api.example/auth/kakao/callback",
    "http://127.0.0.1:3001/auth/kakao/callback",
    "http://[::1]:3001/auth/kakao/callback",
  ])
    assert.ok(kakaoConfig({ ...env, KAKAO_REDIRECT_URI: url }));
  for (const url of [
    "http://api.example/auth/kakao/callback",
    "https://api.example/elsewhere",
    "https://user:pass@api.example/auth/kakao/callback",
    "https://api.example/auth/kakao/callback?next=evil",
    "javascript:alert(1)",
  ])
    assert.throws(() => kakaoConfig({ ...env, KAKAO_REDIRECT_URI: url }));
});

test("Kakao OAuth validates the browser and exchanges codes only on the server; accounts survive restart", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "wappy-kakao-"));
  const databasePath = join(directory, "db.sqlite");
  let now = Date.now();
  let providerMode = "success";
  let providerCalls = 0;
  let nickname = "카카오 이름";
  const kakaoFetch: typeof fetch = async (input, init) => {
    providerCalls++;
    assert.equal(init?.redirect, "error");
    assert.ok(init?.signal);
    if (providerMode === "network")
      throw new Error("provider-sensitive-details");
    if (String(input) === "https://kauth.kakao.com/oauth/token") {
      const body = new URLSearchParams(String(init?.body));
      assert.equal(init?.method, "POST");
      assert.equal(body.get("grant_type"), "authorization_code");
      assert.equal(body.get("client_id"), config.restApiKey);
      assert.equal(body.get("client_secret"), config.clientSecret);
      assert.equal(body.get("redirect_uri"), config.redirectUri);
      assert.equal(body.get("code"), "provider-code");
      if (providerMode === "token-error")
        return Response.json(
          { error: "provider-sensitive-details" },
          { status: 400 },
        );
      if (providerMode === "bad-token")
        return Response.json({ access_token: null });
      return Response.json({
        access_token: "provider-access-token",
        refresh_token: "provider-refresh-token",
      });
    }
    assert.equal(String(input), "https://kapi.kakao.com/v2/user/me");
    assert.equal(
      new Headers(init?.headers).get("Authorization"),
      "Bearer provider-access-token",
    );
    if (providerMode === "user-error")
      return Response.json({}, { status: 401 });
    if (providerMode === "bad-user")
      return Response.json({ id: "untrusted-id" });
    return Response.json({
      id: 123456789,
      kakao_account: { profile: { nickname } },
    });
  };
  const options = { databasePath, kakao: config, kakaoFetch, now: () => now };
  let server = createApp(options);
  let base = "";
  async function listen() {
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    base = `http://127.0.0.1:${address.port}`;
  }
  async function close() {
    const closed = once(server, "close");
    server.close();
    server.closeAllConnections();
    await closed;
  }
  await listen();
  t.after(async () => {
    await close();
    rmSync(directory, { recursive: true, force: true });
  });
  async function call(path: string, body?: unknown, token?: string) {
    const response = await fetch(base + path, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  }
  async function start() {
    const response = await call("/auth/kakao/start", {});
    assert.equal(response.status, 200);
    const { loginToken, authorizationUrl } = response.body;
    assert.match(loginToken, /^[\w-]{43}$/);
    assert.ok(!authorizationUrl.includes(loginToken));
    assert.ok(!JSON.stringify(response.body).includes(config.clientSecret));
    const url = new URL(authorizationUrl);
    const state = url.searchParams.get("state");
    const authorization = await fetch(base + url.pathname + url.search, {
      redirect: "manual",
    });
    assert.equal(authorization.status, 302);
    const destination = new URL(authorization.headers.get("location")!);
    assert.equal(destination.origin, "https://kauth.kakao.com");
    assert.equal(destination.searchParams.get("client_id"), config.restApiKey);
    assert.equal(
      destination.searchParams.get("redirect_uri"),
      config.redirectUri,
    );
    assert.equal(destination.searchParams.get("state"), state);
    assert.equal(destination.searchParams.get("client_secret"), null);
    const setCookie = authorization.headers.get("set-cookie")!;
    assert.match(setCookie, /HttpOnly; SameSite=Lax/);
    assert.equal(authorization.headers.get("referrer-policy"), "no-referrer");
    await authorization.body?.cancel();
    return { loginToken, state, cookie: setCookie.split(";")[0]! };
  }
  async function callback(
    attempt: Awaited<ReturnType<typeof start>>,
    params = "code=provider-code",
    cookie = attempt.cookie,
  ) {
    const response = await fetch(
      `${base}/auth/kakao/callback?state=${attempt.state}&${params}`,
      { headers: { Cookie: cookie } },
    );
    const body = await response.text();
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.match(
      response.headers.get("content-security-policy")!,
      /frame-ancestors 'none'/,
    );
    for (const secret of [
      config.clientSecret,
      "provider-code",
      "provider-access-token",
      "provider-refresh-token",
      "provider-sensitive-details",
    ])
      assert.ok(!body.includes(secret));
    return { status: response.status, body };
  }
  const poll = (attempt: Awaited<ReturnType<typeof start>>) =>
    call("/auth/kakao/poll", { loginToken: attempt.loginToken });

  const first = await start();
  for (const [cookie, status] of [
    [first.cookie, 302],
    ["", 400],
    [first.cookie + "tampered", 400],
  ] as const) {
    const reopened = await fetch(
      `${base}/auth/kakao/authorize?state=${first.state}`,
      {
        headers: { Cookie: cookie },
        redirect: "manual",
      },
    );
    assert.equal(reopened.status, status);
    if (status === 302)
      assert.equal(
        reopened.headers.get("set-cookie")?.split(";")[0],
        first.cookie,
      );
    await reopened.body?.cancel();
  }
  assert.equal((await poll(first)).body.status, "pending");
  assert.equal(
    (await call("/auth/kakao/poll", { loginToken: first.state })).status,
    400,
  );
  assert.equal((await callback(first, "code=provider-code", "")).status, 400);
  assert.equal(
    (await callback(first, "code=provider-code", first.cookie + "tampered"))
      .status,
    400,
  );
  assert.equal(providerCalls, 0);
  assert.equal((await callback({ ...first, state: "unknown" })).status, 400);
  assert.equal((await callback(first)).status, 200);
  assert.equal((await callback(first)).status, 400);
  assert.equal(providerCalls, 2);
  const completed = await poll(first);
  assert.equal(completed.body.status, "complete");
  const original = completed.body.session;
  assert.equal(original.profile.name, nickname);
  assert.equal((await poll(first)).status, 410);
  assert.equal((await call("/state", undefined, original.token)).status, 200);

  // Changes and friendships must survive a subsequent Kakao login and a server restart.
  const changed = await fetch(base + "/profile", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${original.token}`,
    },
    body: JSON.stringify({
      name: "내가 고른 이름",
      character: "shisa",
      status: "산책 중",
    }),
  });
  assert.equal(changed.status, 200);
  await changed.body?.cancel();
  const friend = (
    await call("/session", { name: "친구", character: "hachiware", status: "" })
  ).body;
  const invite = (await call("/invites", {}, friend.token)).body;
  assert.equal(
    (await call("/invites/accept", { code: invite.code }, original.token))
      .status,
    200,
  );
  const recovery = (await call("/recovery-code", {}, original.token)).body;
  await close();
  server = createApp(options);
  await listen();
  nickname = "바뀐 카카오 이름";
  const second = await start();
  assert.equal((await callback(second)).status, 200);
  // Existing credentials are rotated only when the initiating app claims the login.
  assert.equal((await call("/state", undefined, original.token)).status, 200);
  const renewed = (await poll(second)).body.session;
  assert.equal(renewed.profile.id, original.profile.id);
  assert.equal(renewed.profile.name, "내가 고른 이름");
  assert.equal(renewed.profile.character, "shisa");
  assert.equal((await call("/state", undefined, original.token)).status, 401);
  const state = (await call("/state", undefined, renewed.token)).body;
  assert.equal(state.friends[0].id, friend.profile.id);
  assert.ok(!JSON.stringify(state).includes("kakao_id"));
  const restored = (await call("/session/recover", recovery)).body;
  assert.equal(restored.profile.id, original.profile.id);

  // Provider denial and failures cannot create accounts or expose upstream secrets.
  now += 60_001;
  const denied = await start();
  const before = providerCalls;
  assert.equal(
    (
      await callback(
        denied,
        "error=access_denied&error_description=provider-sensitive-details",
      )
    ).status,
    400,
  );
  assert.equal(providerCalls, before);
  assert.equal((await poll(denied)).status, 400);
  for (providerMode of [
    "token-error",
    "bad-token",
    "user-error",
    "bad-user",
    "network",
  ]) {
    const failed = await start();
    assert.equal((await callback(failed)).status, 400);
    const result = await poll(failed);
    assert.equal(result.status, 400);
    assert.ok(!JSON.stringify(result).includes("provider-sensitive-details"));
  }
  providerMode = "success";
  const cancelled = await start();
  assert.equal(
    (await call("/auth/kakao/cancel", { loginToken: cancelled.loginToken }))
      .status,
    200,
  );
  assert.equal((await callback(cancelled)).status, 400);
  assert.equal((await poll(cancelled)).status, 410);
  const expired = await start();
  now += 10 * 60_000;
  assert.equal((await callback(expired)).status, 400);
  assert.equal((await poll(expired)).status, 410);

  // Deleting a profile also removes its account link; the next login creates a fresh profile.
  assert.equal(
    (
      await call(
        "/profile/delete",
        { profileId: restored.profile.id },
        restored.token,
      )
    ).status,
    200,
  );
  nickname = "";
  const fresh = await start();
  await callback(fresh);
  const freshSession = (await poll(fresh)).body.session;
  assert.notEqual(freshSession.profile.id, original.profile.id);
  assert.equal(freshSession.profile.name, "카카오 친구");
  const db = new DatabaseSync(databasePath);
  assert.equal(
    db.prepare("SELECT COUNT(*) AS count FROM kakao_accounts").get()!.count,
    1,
  );
  assert.equal(
    db.prepare("SELECT COUNT(*) AS count FROM users").get()!.count,
    2,
  );
  db.close();
});

test("unconfigured servers reject Kakao login and public starts retain rate limiting", async (t) => {
  const server = createApp({ databasePath: ":memory:" });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => {
    server.close();
    server.closeAllConnections();
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const url = `http://127.0.0.1:${address.port}/auth/kakao/start`;
  const forbidden = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://evil.example",
    },
    body: "{}",
  });
  assert.equal(forbidden.status, 403);
  await forbidden.body?.cancel();
  for (let i = 0; i < 11; i++) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    assert.equal(response.status, i < 10 ? 503 : 429);
    await response.body?.cancel();
  }
});

test("cancelling during the provider exchange prevents a late callback from issuing a session", async (t) => {
  let started!: () => void;
  let finish!: () => void;
  const exchanging = new Promise<void>((resolve) => {
    started = resolve;
  });
  const released = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const server = createApp({
    databasePath: ":memory:",
    kakao: {
      ...config,
      redirectUri: "https://api.example/auth/kakao/callback",
    },
    kakaoFetch: async (url) => {
      if (String(url).includes("/oauth/token")) {
        started();
        await released;
        return Response.json({ access_token: "mock-access" });
      }
      return Response.json({ id: 42 });
    },
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => {
    finish();
    server.close();
    server.closeAllConnections();
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  async function post(path: string, body: unknown) {
    return fetch(base + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }
  const attempt = await (await post("/auth/kakao/start", {})).json();
  const url = new URL(attempt.authorizationUrl);
  const authorization = await fetch(base + url.pathname + url.search, {
    redirect: "manual",
  });
  const cookie = authorization.headers.get("set-cookie")!;
  assert.match(cookie, /; Secure/);
  await authorization.body?.cancel();
  const callbackUrl = `${base}/auth/kakao/callback${url.search}&code=provider-code`;
  const headers = { Cookie: cookie.split(";")[0]! };
  const pending = fetch(callbackUrl, { headers });
  await exchanging;
  const duplicate = await fetch(callbackUrl, { headers });
  assert.equal(duplicate.status, 400);
  await duplicate.body?.cancel();
  const cancelled = await post("/auth/kakao/cancel", {
    loginToken: attempt.loginToken,
  });
  assert.equal(cancelled.status, 200);
  await cancelled.body?.cancel();
  finish();
  const late = await pending;
  assert.equal(late.status, 400);
  await late.body?.cancel();
  const result = await post("/auth/kakao/poll", {
    loginToken: attempt.loginToken,
  });
  assert.equal(result.status, 410);
  await result.body?.cancel();
});
