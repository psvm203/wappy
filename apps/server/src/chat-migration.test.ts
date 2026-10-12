import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { parseSidebarState } from "@wappy/api";
import { createApp } from "./server.ts";

test("removed social features reject requests and legacy data stays hidden", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "wappy-chat-migration-"));
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
  assert.deepEqual(old.messages, [
    { id: 1, senderId: "legacy", text: "기존 이야기", sentAt: now },
  ]);
  const alice = await create("Alice"),
    bob = await create("Bob"),
    carol = await create("Carol");
  await connect(alice.token, bob.token);
  await connect(alice.token, carol.token);
  const inspection = new DatabaseSync(databasePath);
  t.after(() => inspection.close());
  const privateId = Number(
    inspection
      .prepare(
        "INSERT INTO chat_messages (sender_id, recipient_id, text, sent_at) VALUES (?, ?, ?, ?)",
      )
      .run(alice.profile.id, bob.profile.id, "비공개 이야기", now - 2000)
      .lastInsertRowid,
  );
  inspection
    .prepare(
      "INSERT INTO chat_recipients (message_id, user_id, friend_id) VALUES (?, ?, ?)",
    )
    .run(privateId, ...[alice.profile.id, bob.profile.id].sort());
  // An existing database may still contain greetings, but none should be returned.
  inspection.exec(`CREATE TABLE waves (
    id TEXT NOT NULL UNIQUE, user_id TEXT NOT NULL, friend_id TEXT NOT NULL,
    sender_id TEXT NOT NULL, sent_at INTEGER NOT NULL, acknowledged INTEGER NOT NULL,
    PRIMARY KEY (user_id, friend_id, sender_id),
    FOREIGN KEY (user_id, friend_id) REFERENCES friendships(user_id, friend_id) ON DELETE CASCADE
  ) STRICT;`);
  inspection
    .prepare("INSERT INTO waves VALUES (?, ?, ?, ?, ?, 0)")
    .run(
      "legacy-wave",
      ...[alice.profile.id, bob.profile.id].sort(),
      alice.profile.id,
      now,
    );
  for (const token of [alice.token, bob.token, carol.token]) {
    const snapshot = (await call("/state", token)).body;
    assert.deepEqual(snapshot.messages, []);
    assert.ok(
      snapshot.friends.every(
        (friend: Record<string, unknown>) => !("wave" in friend),
      ),
    );
    for (const field of ["directChat", "chatReporting", "unreadChatIds"])
      assert.equal(field in snapshot, false);
  }
  for (const [path, body] of [
    ["/friends/wave", { friendId: bob.profile.id }],
    ["/waves/read", { waveId: "legacy-wave" }],
    ["/chat/direct", { text: "private", friendId: bob.profile.id }],
    ["/chat/report", { messageId: privateId, reason: "spam", details: "" }],
    ["/chat/reports", undefined],
    ["/chat/read", { messageIds: [privateId] }],
  ] as const)
    assert.equal((await call(path, alice.token, body)).status, 404);
  for (const target of [
    { friendId: bob.profile.id },
    { recipientId: bob.profile.id },
  ])
    assert.equal(
      (
        await call("/chat", alice.token, {
          text: "must not broadcast",
          ...target,
        })
      ).status,
      400,
    );
  const sent = await call("/chat", alice.token, { text: "모두에게" });
  assert.equal(sent.status, 201);
  for (const token of [alice.token, bob.token, carol.token])
    assert.deepEqual((await state(token)).messages, [sent.body]);
  await close();
  server = createApp({ databasePath, now: () => now });
  await listen();
  assert.deepEqual((await state(bob.token)).messages, [sent.body]);
  assert.ok(
    (await state(bob.token)).friends.every((friend) => !("wave" in friend)),
  );
  assert.deepEqual((await state(legacyToken)).messages, old.messages);
  assert.deepEqual(inspection.prepare("PRAGMA foreign_key_check").all(), []);
});
