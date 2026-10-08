import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";
import { CHAT_TTL_MS, ONLINE_TIMEOUT_MS, WAVE_TTL_MS } from "@wappy/api";
import { createApp } from "./server.ts";

test("conditional state remains fresh across writes, presence/TTL transitions and token revocation", async (t) => {
  let now = 1_800_000_000_000;
  const server = createApp({ databasePath: ":memory:", now: () => now });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  t.after(async () => {
    const closed = once(server, "close");
    server.close();
    server.closeAllConnections();
    await closed;
  });
  async function write(
    path: string,
    body: unknown,
    token?: string,
    method = "POST",
  ) {
    const response = await fetch(base + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    assert.ok(response.ok, `${path}: ${response.status}`);
    return response.json();
  }
  async function state(token: string, etag?: string) {
    const response = await fetch(base + "/state", {
      headers: {
        Authorization: `Bearer ${token}`,
        Origin: "http://localhost:1420",
        ...(etag ? { "If-None-Match": etag } : {}),
      },
    });
    const body = await response.text();
    return {
      status: response.status,
      etag: response.headers.get("ETag")!,
      headers: response.headers,
      body: body ? JSON.parse(body) : null,
    };
  }
  const alice = await write("/session", {
    name: "Alice",
    character: "hachiware",
    status: "",
  });
  const bob = await write("/session", {
    name: "Bob",
    character: "hachiware",
    status: "",
  });
  let a = await state(alice.token);
  assert.equal(a.status, 200);
  assert.ok(a.etag);
  assert.equal(a.headers.get("access-control-expose-headers"), "ETag");
  assert.match(a.headers.get("cache-control")!, /private.*no-store/);
  for (const tag of [a.etag, `"unrelated", W/${a.etag}`, "*"]) {
    const unchanged = await state(alice.token, tag);
    assert.equal(unchanged.status, 304);
    assert.equal(unchanged.body, null);
  }
  assert.equal(
    (await state(bob.token, a.etag)).status,
    200,
    "validators are per profile",
  );
  const preflight = await fetch(base + "/state", {
    method: "OPTIONS",
    headers: {
      Origin: "http://localhost:1420",
      "Access-Control-Request-Headers": "if-none-match,authorization",
    },
  });
  assert.match(
    preflight.headers.get("access-control-allow-headers")!,
    /If-None-Match/,
  );

  const invite = await write("/invites", {}, bob.token);
  await write("/invites/accept", invite, alice.token);
  let next = await state(alice.token, a.etag);
  assert.equal(next.status, 200);
  assert.equal(next.body.friends[0].online, true);
  a = next;
  await write(
    "/profile",
    { name: "Robert", character: "chiikawa", status: "hi" },
    bob.token,
    "PATCH",
  );
  next = await state(alice.token, a.etag);
  assert.equal(next.body.friends[0].name, "Robert");
  a = next;
  await write("/presence", { sharing: false }, bob.token, "PATCH");
  next = await state(alice.token, a.etag);
  assert.equal(next.body.friends[0].online, false);
  await write("/presence", { sharing: true }, bob.token, "PATCH");
  a = await state(alice.token);

  // An unchanged response still sends a heartbeat, and expiring friend presence
  // must invalidate without any database write or housekeeping run.
  now += ONLINE_TIMEOUT_MS - 1;
  assert.equal((await state(alice.token, a.etag)).status, 304);
  assert.equal((await state(bob.token)).body.friends[0].online, true);
  now += ONLINE_TIMEOUT_MS;
  next = await state(alice.token, a.etag);
  assert.equal(next.body.friends[0].online, false);
  a = next;
  await state(bob.token);
  next = await state(alice.token, a.etag);
  assert.equal(
    next.body.friends[0].online,
    true,
    "a friend's heartbeat wakes cached presence",
  );

  await write("/friends/wave", { friendId: alice.profile.id }, bob.token);
  a = await state(alice.token);
  assert.ok(a.body.friends[0].wave);
  await write(
    "/waves/read",
    { waveId: a.body.friends[0].wave.id },
    alice.token,
  );
  assert.equal(
    (await state(alice.token, a.etag)).body.friends[0].wave,
    undefined,
  );
  now += 30_001;
  await write("/friends/wave", { friendId: alice.profile.id }, bob.token);
  await write("/chat", { text: "hello" }, bob.token);
  a = await state(alice.token);
  assert.equal(a.body.messages.length, 1);
  now += Math.max(CHAT_TTL_MS, WAVE_TTL_MS);
  next = await state(alice.token, a.etag);
  assert.equal(next.body.messages.length, 0);
  assert.equal(next.body.friends[0].wave, undefined);
  await write("/chat", { text: "new" }, bob.token);
  a = await state(alice.token);
  await write("/friends/remove", { friendId: bob.profile.id }, alice.token);
  next = await state(alice.token, a.etag);
  assert.equal(next.body.friends.length, 0);
  assert.equal(next.body.messages.length, 0);
  a = next;
  const recovery = await write("/recovery-code", {}, alice.token);
  const recovered = await write("/session/recover", recovery);
  assert.equal(
    (await state(alice.token, a.etag)).status,
    401,
    "a cache hit never skips authentication",
  );
  await write(
    "/profile/delete",
    { profileId: alice.profile.id },
    recovered.token,
  );
  assert.equal((await state(recovered.token, a.etag)).status, 401);
});
