import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { CHAT_HISTORY_LIMIT, CHAT_TTL_MS, parseSidebarState } from "@wappy/api";
import { createApp } from "./server.ts";

test("chat acknowledgements are recipient-private, atomic, durable, bounded and migrate existing deliveries", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "wappy-chat-read-"));
  const databasePath = join(directory, "chat.sqlite");
  let now = 1_800_000_000_000;
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
    if (!server.listening) return;
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
    token?: string,
    body?: unknown,
    etag?: string,
  ) {
    const response = await fetch(base + path, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(etag ? { "If-None-Match": etag } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return {
      status: response.status,
      etag: response.headers.get("ETag")!,
      body: response.status === 304 ? null : await response.json(),
    };
  }
  async function state(token: string) {
    const response = await call("/state", token);
    assert.equal(response.status, 200);
    return parseSidebarState(response.body);
  }
  async function create(name: string) {
    return (
      await call("/session", undefined, {
        name,
        character: "hachiware",
        status: "",
      })
    ).body;
  }
  async function connect(a: string, b: string) {
    const invite = (await call("/invites", a, {})).body;
    assert.equal((await call("/invites/accept", b, invite)).status, 200);
  }
  async function send(token: string, friendId?: string) {
    now += 1001;
    const result = await call(friendId ? "/chat/direct" : "/chat", token, {
      text: "새 이야기",
      ...(friendId ? { friendId } : {}),
    });
    assert.equal(result.status, 201);
    return result.body;
  }
  const alice = await create("Alice"),
    bob = await create("Bob"),
    carol = await create("Carol"),
    stranger = await create("Stranger");
  await connect(alice.token, bob.token);
  await connect(alice.token, carol.token);
  await connect(bob.token, carol.token);
  const broadcast = await send(alice.token);
  const own = await send(bob.token, alice.profile.id);
  const direct = await send(carol.token, bob.profile.id);
  // Reconstruct the previous schema with real deliveries, then migrate it.
  await close();
  const legacy = new DatabaseSync(databasePath);
  legacy.exec("ALTER TABLE chat_recipients DROP COLUMN acknowledged");
  legacy.close();
  server = createApp({ databasePath, now: () => now });
  await listen();
  assert.deepEqual((await state(bob.token)).unreadChatIds, [
    broadcast.id,
    direct.id,
  ]);
  assert.deepEqual(
    (await state(bob.token)).unreadChatIds,
    [broadcast.id, direct.id],
    "polling does not acknowledge messages",
  );
  assert.deepEqual((await state(alice.token)).unreadChatIds, [own.id]);
  assert.deepEqual((await state(carol.token)).unreadChatIds, [broadcast.id]);
  assert.deepEqual((await state(stranger.token)).unreadChatIds, []);
  assert.equal(
    (await call("/chat/read", undefined, { messageIds: [broadcast.id] }))
      .status,
    401,
  );
  for (const messageIds of [
    null,
    "1",
    ["1"],
    [0],
    [-1],
    [1.5],
    [Number.MAX_SAFE_INTEGER + 1],
    [broadcast.id, broadcast.id],
    Array.from({ length: CHAT_HISTORY_LIMIT + 1 }, (_, i) => i + 1),
  ])
    assert.equal(
      (await call("/chat/read", bob.token, { messageIds })).status,
      400,
    );
  assert.equal(
    (await call("/chat/read", stranger.token, { messageIds: [broadcast.id] }))
      .status,
    404,
  );
  assert.equal(
    (
      await call("/chat/read", bob.token, {
        messageIds: [broadcast.id, own.id],
      })
    ).status,
    404,
  );
  assert.deepEqual(
    (await state(bob.token)).unreadChatIds,
    [broadcast.id, direct.id],
    "invalid batches roll back every acknowledgement",
  );
  const senderBefore = await call("/state", alice.token);
  const recipientBefore = await call("/state", bob.token);
  const read = await call("/chat/read", bob.token, {
    messageIds: [broadcast.id],
  });
  assert.equal(read.status, 200);
  assert.deepEqual(read.body, { messageIds: [broadcast.id] });
  assert.deepEqual((await state(bob.token)).unreadChatIds, [direct.id]);
  assert.deepEqual(
    (await state(carol.token)).unreadChatIds,
    [broadcast.id],
    "each recipient controls only their own receipt",
  );
  assert.equal(
    (await call("/state", alice.token, undefined, senderBefore.etag)).status,
    304,
    "the sender cannot observe a receipt in state or ETag",
  );
  assert.equal(
    (await call("/state", bob.token, undefined, recipientBefore.etag)).status,
    200,
  );
  const newer = await send(alice.token, bob.profile.id);
  assert.equal(
    (await call("/chat/read", bob.token, { messageIds: [broadcast.id] }))
      .status,
    200,
  );
  assert.deepEqual(
    (await state(bob.token)).unreadChatIds,
    [direct.id, newer.id],
    "retries cannot clear messages arriving later",
  );
  await close();
  server = createApp({ databasePath, now: () => now });
  await listen();
  const recovery = (await call("/recovery-code", bob.token, {})).body;
  bob.token = (await call("/session/recover", undefined, recovery)).body.token;
  assert.deepEqual(
    (await state(bob.token)).unreadChatIds,
    [direct.id, newer.id],
    "both read and unread states survive restart and recovery",
  );
  assert.equal(
    (await call("/friends/remove", bob.token, { friendId: alice.profile.id }))
      .status,
    200,
  );
  assert.deepEqual((await state(bob.token)).unreadChatIds, [direct.id]);
  assert.equal(
    (await call("/chat/read", bob.token, { messageIds: [newer.id] })).status,
    404,
  );
  await connect(alice.token, bob.token);
  assert.deepEqual(
    (await state(bob.token)).unreadChatIds,
    [direct.id],
    "reconnection cannot restore revoked deliveries",
  );
  for (let i = 0; i <= CHAT_HISTORY_LIMIT; i++)
    await send(carol.token, bob.profile.id);
  const bounded = await state(bob.token);
  assert.equal(bounded.unreadChatIds?.length, CHAT_HISTORY_LIMIT);
  assert.deepEqual(
    bounded.unreadChatIds,
    bounded.messages!.map((message) => message.id),
  );
  now += CHAT_TTL_MS;
  assert.deepEqual((await state(bob.token)).unreadChatIds, []);
  assert.equal(
    (
      await call("/chat/read", bob.token, {
        messageIds: [bounded.unreadChatIds![0]],
      })
    ).status,
    404,
  );
  await send(carol.token, bob.profile.id);
  assert.equal((await state(bob.token)).unreadChatIds?.length, 1);
  assert.equal(
    (
      await call("/profile/delete", carol.token, {
        profileId: carol.profile.id,
      })
    ).status,
    200,
  );
  assert.deepEqual((await state(bob.token)).unreadChatIds, []);
  const inspection = new DatabaseSync(databasePath);
  assert.deepEqual(inspection.prepare("PRAGMA foreign_key_check").all(), []);
  inspection.close();
});
