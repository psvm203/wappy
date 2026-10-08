import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { CHAT_TTL_MS, parseSidebarState } from "@wappy/api";
import { createApp } from "./server.ts";

test("direct chat migrates existing history, isolates recipients, survives recovery and revokes on removal", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "wappy-direct-chat-"));
  const databasePath = join(directory, "chat.sqlite");
  let now = 1_800_000_000_000;
  const legacyToken = "l".repeat(43);
  // The schema before direct chat, including a real message that must survive migration.
  const legacy = new DatabaseSync(databasePath);
  legacy.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL, character TEXT NOT NULL, status TEXT NOT NULL
    ) STRICT;
    CREATE TABLE chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      text TEXT NOT NULL, sent_at INTEGER NOT NULL
    ) STRICT;
  `);
  legacy
    .prepare("INSERT INTO users VALUES (?, ?, ?, ?, ?)")
    .run(
      "legacy",
      createHash("sha256").update(legacyToken).digest("hex"),
      "Legacy",
      "hachiware",
      "",
    );
  legacy
    .prepare(
      "INSERT INTO chat_messages (sender_id, text, sent_at) VALUES (?, ?, ?)",
    )
    .run("legacy", "기존 이야기", now);
  legacy.close();
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
  const old = await state(legacyToken);
  assert.equal(old.directChat, true);
  assert.deepEqual(old.messages, [
    { id: 1, senderId: "legacy", text: "기존 이야기", sentAt: now },
  ]);
  const alice = await create("Alice"),
    bob = await create("Bob"),
    carol = await create("Carol");
  await connect(alice.token, bob.token);
  await connect(alice.token, carol.token);
  await connect(bob.token, carol.token);
  const beforeBob = await call("/state", bob.token);
  const beforeCarol = await call("/state", carol.token);
  assert.equal(
    (
      await call("/chat/direct", undefined, {
        text: "no auth",
        friendId: bob.profile.id,
      })
    ).status,
    401,
  );
  for (const friendId of [undefined, null, "", 123, "x".repeat(129)])
    assert.equal(
      (await call("/chat/direct", alice.token, { text: "invalid", friendId }))
        .status,
      400,
    );
  for (const friendId of [alice.profile.id, "legacy", "missing"])
    assert.equal(
      (
        await call("/chat/direct", alice.token, {
          text: "not a friend",
          friendId,
        })
      ).status,
      404,
    );
  assert.equal(
    (
      await call("/chat", alice.token, {
        text: "must not broadcast",
        friendId: bob.profile.id,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call("/chat", alice.token, {
        text: "must not broadcast",
        recipientId: bob.profile.id,
      })
    ).status,
    400,
  );
  const sent = await call("/chat/direct", alice.token, {
    text: "둘만의 이야기",
    friendId: bob.profile.id,
    senderId: carol.profile.id,
  });
  assert.equal(sent.status, 201);
  assert.equal(sent.body.senderId, alice.profile.id);
  assert.equal(sent.body.recipientId, bob.profile.id);
  assert.deepEqual((await state(alice.token)).messages, [sent.body]);
  assert.deepEqual((await state(bob.token)).messages, [sent.body]);
  assert.deepEqual((await state(carol.token)).messages, []);
  assert.equal(
    (await call("/state", bob.token, undefined, beforeBob.etag)).status,
    200,
  );
  assert.equal(
    (await call("/state", carol.token, undefined, beforeCarol.etag)).status,
    304,
  );
  assert.equal(
    (await call("/chat", alice.token, { text: "shared cooldown" })).status,
    429,
  );
  assert.equal(
    (
      await call("/chat/direct", alice.token, {
        text: "shared cooldown",
        friendId: carol.profile.id,
      })
    ).status,
    429,
  );
  await close();
  server = createApp({ databasePath, now: () => now });
  await listen();
  assert.deepEqual((await state(bob.token)).messages, [sent.body]);
  assert.deepEqual((await state(carol.token)).messages, []);
  assert.deepEqual((await state(legacyToken)).messages, old.messages);
  const recovery = (await call("/recovery-code", bob.token, {})).body;
  const recovered = (await call("/session/recover", undefined, recovery)).body;
  bob.token = recovered.token;
  assert.deepEqual((await state(bob.token)).messages, [sent.body]);
  const reply = await call("/chat/direct", bob.token, {
    text: "나도 반가워",
    friendId: alice.profile.id,
  });
  assert.equal(reply.status, 201);
  assert.deepEqual((await state(alice.token)).messages, [
    sent.body,
    reply.body,
  ]);
  assert.deepEqual((await state(carol.token)).messages, []);
  const cached = await call("/state", bob.token);
  assert.equal(
    (await call("/friends/remove", alice.token, { friendId: bob.profile.id }))
      .status,
    200,
  );
  assert.deepEqual((await state(alice.token)).messages, []);
  assert.deepEqual((await state(bob.token)).messages, []);
  assert.equal(
    (await call("/state", bob.token, undefined, cached.etag)).status,
    200,
  );
  await connect(alice.token, bob.token);
  assert.deepEqual((await state(alice.token)).messages, []);
  assert.deepEqual((await state(bob.token)).messages, []);
  now += 1001;
  const expiring = await call("/chat/direct", alice.token, {
    text: "하루 동안",
    friendId: bob.profile.id,
  });
  assert.equal(expiring.status, 201);
  now += CHAT_TTL_MS;
  assert.deepEqual((await state(bob.token)).messages, []);
  assert.deepEqual((await state(alice.token)).messages, []);
  const last = await call("/chat/direct", alice.token, {
    text: "삭제 전 이야기",
    friendId: bob.profile.id,
  });
  assert.equal(last.status, 201);
  assert.equal(
    (await call("/profile/delete", bob.token, { profileId: bob.profile.id }))
      .status,
    200,
  );
  assert.deepEqual((await state(alice.token)).messages, []);
  const inspection = new DatabaseSync(databasePath);
  assert.equal(
    inspection
      .prepare(
        "SELECT COUNT(*) AS count FROM chat_messages WHERE recipient_id = ? OR sender_id = ?",
      )
      .get(bob.profile.id, bob.profile.id)!.count,
    0,
  );
  assert.deepEqual(inspection.prepare("PRAGMA foreign_key_check").all(), []);
  inspection.close();
});
