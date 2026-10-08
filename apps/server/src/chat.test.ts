import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { CHAT_HISTORY_LIMIT, CHAT_TTL_MS, MAX_CHAT_LENGTH } from "@wappy/api";
import { createApp } from "./server.ts";

test("chat reaches only friends at send time, persists, expires and is removed with friendships/profiles", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "wappy-chat-"));
  const databasePath = join(directory, "chat.sqlite");
  let now = Date.now();
  let server = createApp({ databasePath, now: () => now });
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
  t.after(async () => {
    await close();
    rmSync(directory, { recursive: true, force: true });
  });
  await listen();
  async function call(
    path: string,
    body?: unknown,
    token?: string,
    method = body === undefined ? "GET" : "POST",
  ) {
    const response = await fetch(base + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  }
  async function create(name: string) {
    return (await call("/session", { name, character: "cat", status: "" }))
      .body;
  }
  async function connect(a: string, b: string) {
    const invite = (await call("/invites", {}, a)).body;
    assert.equal((await call("/invites/accept", invite, b)).status, 200);
  }
  const alice = await create("Alice"),
    bob = await create("Bob"),
    carol = await create("Carol");
  assert.equal((await call("/chat", { text: "unauthenticated" })).status, 401);
  for (const text of [
    null,
    12,
    "",
    " \n ",
    "x".repeat(MAX_CHAT_LENGTH + 1),
    "bad\u0000",
  ])
    assert.equal((await call("/chat", { text }, alice.token)).status, 400);
  await connect(alice.token, bob.token);
  await call("/presence", { sharing: false }, alice.token, "PATCH");
  const sent = await call(
    "/chat",
    { text: "  안녕!\r\n반가워  ", senderId: bob.profile.id },
    alice.token,
  );
  assert.equal(sent.status, 201);
  assert.equal(
    sent.body.senderId,
    alice.profile.id,
    "sender always comes from authentication",
  );
  assert.equal(sent.body.text, "안녕!\n반가워");
  assert.deepEqual((await call("/state", undefined, bob.token)).body.messages, [
    sent.body,
  ]);
  assert.equal(
    (await call("/state", undefined, bob.token)).body.friends[0].online,
    false,
  );
  assert.deepEqual(
    (await call("/state", undefined, carol.token)).body.messages,
    [],
  );
  assert.equal(
    (await call("/chat", { text: "too soon" }, alice.token)).status,
    429,
  );
  await close();
  server = createApp({ databasePath, now: () => now });
  await listen();
  assert.deepEqual((await call("/state", undefined, bob.token)).body.messages, [
    sent.body,
  ]);
  assert.equal(
    (await call("/chat", { text: "still too soon" }, alice.token)).status,
    429,
  );
  await connect(alice.token, carol.token);
  assert.deepEqual(
    (await call("/state", undefined, carol.token)).body.messages,
    [],
    "new friends cannot see prior chat",
  );
  now += 1001;
  const broadcast = await call("/chat", { text: "다 같이 안녕" }, alice.token);
  assert.deepEqual(
    (await call("/state", undefined, carol.token)).body.messages,
    [broadcast.body],
  );
  assert.equal(
    (await call("/state", undefined, bob.token)).body.messages.length,
    2,
  );
  await call("/friends/remove", { friendId: alice.profile.id }, bob.token);
  assert.deepEqual(
    (await call("/state", undefined, bob.token)).body.messages,
    [],
  );
  await connect(alice.token, bob.token);
  assert.deepEqual(
    (await call("/state", undefined, bob.token)).body.messages,
    [],
    "reconnecting does not restore revoked history",
  );
  now += 1001;
  const reply = await call(
    "/chat",
    { text: "<img src=x onerror=alert(1)>" },
    bob.token,
  );
  assert.equal(reply.status, 201);
  assert.deepEqual(
    (await call("/state", undefined, carol.token)).body.messages,
    [broadcast.body],
    "a friend's friends are not recipients",
  );
  const aliceState = (await call("/state", undefined, alice.token)).body;
  assert.deepEqual(
    aliceState.messages.map((message: { id: number }) => message.id),
    [sent.body.id, broadcast.body.id, reply.body.id],
  );
  for (let i = 0; i <= CHAT_HISTORY_LIMIT; i++) {
    now += 2001;
    assert.equal(
      (await call("/chat", { text: `message ${i}` }, alice.token)).status,
      201,
    );
  }
  const history = (await call("/state", undefined, bob.token)).body.messages;
  assert.equal(history.length, CHAT_HISTORY_LIMIT);
  assert.equal(history[0].text, "message 1");
  assert.equal(history.at(-1).text, `message ${CHAT_HISTORY_LIMIT}`);
  const inspection = new DatabaseSync(databasePath);
  assert.equal(
    inspection
      .prepare(
        "SELECT COUNT(*) AS count FROM chat_messages WHERE sender_id = ?",
      )
      .get(alice.profile.id)!.count,
    CHAT_HISTORY_LIMIT,
  );
  now += CHAT_TTL_MS;
  assert.deepEqual(
    (await call("/state", undefined, bob.token)).body.messages,
    [],
    "expiration does not wait for housekeeping",
  );
  assert.equal(
    (
      await call(
        "/profile/delete",
        { profileId: alice.profile.id },
        alice.token,
      )
    ).status,
    200,
  );
  assert.equal(
    inspection
      .prepare(
        "SELECT COUNT(*) AS count FROM chat_messages WHERE sender_id = ?",
      )
      .get(alice.profile.id)!.count,
    0,
  );
  assert.equal(
    inspection.prepare("SELECT COUNT(*) AS count FROM chat_recipients").get()!
      .count,
    0,
  );
  inspection.close();
});
