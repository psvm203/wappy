import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { parseSidebarState, type Session } from "@wappy/api";
import { openDatabase } from "./database.ts";
import { createApp } from "./server.ts";

test("automatic rooms support shared codes, isolated moves and owner-only kicks across restarts", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "wappy-rooms-"));
  const databasePath = join(directory, "rooms.sqlite");
  let now = 1_800_000_000_000;
  let server = createApp({ databasePath, now: () => now });
  let base = "";
  let inspection: DatabaseSync | undefined;
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
    inspection?.close();
    await close();
    rmSync(directory, { recursive: true, force: true });
  });
  await listen();
  async function call(
    path: string,
    token?: string,
    body?: unknown,
    etag?: string,
    method = body === undefined ? "GET" : "POST",
  ) {
    const response = await fetch(base + path, {
      method,
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
  async function create(name: string): Promise<Session> {
    const response = await call("/session", undefined, {
      name,
      character: "chiikawa",
    });
    assert.equal(response.status, 201);
    return response.body;
  }
  const [a, b, c, d, e, f] = await Promise.all(
    ["A", "B", "C", "D", "E", "F"].map(create),
  );
  assert.ok(a && b && c && d && e && f);
  async function state(person: Session) {
    const response = await call("/state", person.token);
    assert.equal(response.status, 200);
    return parseSidebarState(response.body);
  }
  async function peers(person: Session, expected: Session[]) {
    assert.deepEqual(
      (await state(person)).friends.map((friend) => friend.id).sort(),
      expected.map((peer) => peer.profile.id).sort(),
    );
  }
  async function invite(person: Session) {
    const room = (await state(person)).room;
    assert.ok(room);
    assert.match(room.inviteCode!, /^[A-HJ-NP-Z2-9]{5}$/);
    return { code: room.inviteCode! };
  }
  const initialCodes = await Promise.all([a, b, c, d, e, f].map(invite));
  assert.equal(new Set(initialCodes.map((invite) => invite.code)).size, 6);
  const first = await invite(a);
  assert.equal((await state(a)).room?.ownerId, a.profile.id);
  assert.equal((await call("/invites/accept", b.token, first)).status, 200);
  const beforeB = await call("/state", b.token);
  // Looking up a code through an older client cannot rotate the room's code.
  const second = await invite(a);
  assert.deepEqual(second, first);
  assert.deepEqual(await call("/invites", b.token, {}), {
    status: 200,
    etag: null,
    body: first,
  });
  assert.equal((await call("/invites/accept", c.token, first)).status, 200);
  await peers(a, [b, c]);
  await peers(b, [a, c]);
  await peers(c, [a, b]);
  assert.equal(
    (await call("/state", b.token, undefined, beforeB.etag)).status,
    200,
  );
  assert.equal(
    (await state(b)).friends.find((friend) => friend.id === c.profile.id)
      ?.online,
    true,
  );
  const chat = await call("/chat", b.token, { text: "방 친구들 안녕" });
  assert.equal(chat.status, 201);
  assert.deepEqual((await state(c)).messages, [chat.body]);
  assert.equal(
    (await call("/friends/attack", b.token, { friendId: c.profile.id })).status,
    201,
  );

  // Every participant sees and shares the same code.
  const fromB = await invite(b);
  assert.deepEqual(fromB, first);
  assert.equal((await call("/invites/preview", undefined, second)).status, 200);
  assert.equal((await call("/invites/accept", d.token, fromB)).status, 200);
  for (const person of [a, b, c, d]) {
    await peers(
      person,
      [a, b, c, d].filter((other) => other !== person),
    );
    assert.equal((await state(person)).room?.id, (await state(a)).room?.id);
    assert.equal((await state(person)).room?.ownerId, a.profile.id);
    assert.deepEqual(await invite(person), first);
  }
  assert.deepEqual(
    (await state(d)).messages,
    [],
    "new members cannot read old room chat",
  );
  await peers(e, []);
  const otherRoom = await invite(e);
  assert.equal((await call("/invites/accept", f.token, otherRoom)).status, 200);
  await peers(f, [e]);
  const otherChat = await call("/chat", e.token, {
    text: "다른 방의 이전 대화",
  });
  assert.equal(otherChat.status, 201);

  await call("/friends/block", e.token, { friendId: d.profile.id });
  assert.equal((await call("/invites/accept", d.token, otherRoom)).status, 409);
  await peers(d, [a, b, c]);
  await call("/friends/unblock", e.token, { friendId: d.profile.id });

  // A failure after leaving the original room must roll the entire move back.
  inspection = new DatabaseSync(databasePath);
  inspection.exec(
    "CREATE TRIGGER fail_join BEFORE INSERT ON room_members BEGIN SELECT RAISE(ABORT, 'test rollback'); END",
  );
  const logged = t.mock.method(console, "error", () => {});
  assert.equal((await call("/invites/accept", d.token, otherRoom)).status, 500);
  logged.mock.restore();
  inspection.exec("DROP TRIGGER fail_join");
  await peers(d, [a, b, c]);
  assert.equal((await state(d)).room?.id, (await state(a)).room?.id);
  const beforeA = await call("/state", a.token);
  assert.equal((await call("/invites/accept", d.token, otherRoom)).status, 200);
  await peers(d, [e, f]);
  assert.deepEqual(await invite(d), otherRoom);
  await peers(e, [d, f]);
  await peers(a, [b, c]);
  await peers(b, [a, c]);
  assert.equal(
    (await call("/state", a.token, undefined, beforeA.etag)).status,
    200,
  );
  assert.deepEqual((await state(d)).messages, []);
  assert.equal(
    (await call("/friends/attack", b.token, { friendId: d.profile.id })).status,
    404,
  );
  now += 2001;
  const later = await call("/chat", b.token, { text: "이전 방에만" });
  assert.equal(later.status, 201);
  assert.deepEqual((await state(d)).messages, []);

  // Blocking a non-inviter still applies when joining their room through someone else.
  await call("/friends/block", c.token, { friendId: d.profile.id });
  assert.equal((await call("/invites/accept", d.token, fromB)).status, 200);
  await peers(d, [a, b]);
  await peers(c, [a, b]);
  await peers(e, [f]);
  assert.deepEqual(
    (await state(d)).messages,
    [],
    "returning members do not regain revoked chat",
  );
  assert.equal((await call("/invites/accept", d.token, fromB)).status, 409);

  const originalRoom = (await state(a)).room;
  assert.equal(originalRoom?.name, "A의 방");
  async function rename(person: Session, name: string) {
    const response = await call(
      "/profile",
      person.token,
      { name, character: person.profile.character },
      undefined,
      "PATCH",
    );
    assert.equal(response.status, 200);
  }
  // Names can match; only the permanent invitation's owner names the room.
  await rename(b, "A");
  const beforeRename = await call("/state", b.token);
  await rename(a, "새 방장 이름");
  const renamed = await call("/state", b.token, undefined, beforeRename.etag);
  assert.equal(renamed.status, 200);
  const renamedRoom = { ...originalRoom, name: "새 방장 이름의 방" };
  assert.deepEqual(renamed.body.room, renamedRoom);
  await rename(b, "새 참여자 이름");
  for (const person of [a, b, c, d])
    assert.deepEqual((await state(person)).room, renamedRoom);
  assert.deepEqual((await call("/invites/preview", undefined, first)).body, {
    name: "새 방장 이름",
    character: a.profile.character,
  });

  await close();
  server = createApp({ databasePath, now: () => now });
  await listen();
  assert.deepEqual((await state(b)).room, renamedRoom);
  await peers(d, [a, b]);
  await peers(e, [f]);
  assert.deepEqual(await invite(a), first);
  assert.deepEqual(await invite(e), otherRoom);
  // Even the original inviter can leave and return using a code for the old room.
  assert.equal((await call("/invites/accept", a.token, otherRoom)).status, 200);
  assert.deepEqual(await invite(a), otherRoom);
  assert.deepEqual(await invite(b), first);
  assert.equal((await call("/invites/accept", a.token, first)).status, 200);
  await peers(a, [b, c, d]);
  const shared = await invite(d);
  assert.equal((await call("/invites/accept", f.token, shared)).status, 200);
  await peers(f, [a, b, c, d]);
  await peers(e, []);
  assert.deepEqual(inspection.prepare("PRAGMA foreign_key_check").all(), []);
  assert.equal(
    inspection.prepare("SELECT COUNT(*) AS count FROM room_members").get()!
      .count,
    6,
  );

  now += 60_001;
  for (const [caller, target, status] of [
    [b, c.profile.id, 403],
    [b, a.profile.id, 403],
    [e, b.profile.id, 404],
    [a, a.profile.id, 400],
    [a, "missing", 404],
  ] as const) {
    assert.equal(
      (await call("/friends/remove", caller.token, {
        friendId: target,
        ownerId: caller.profile.id,
      })).status,
      status,
    );
  }
  await peers(b, [a, c, d, f]);
  assert.equal(
    (await call("/friends/remove", undefined, { friendId: b.profile.id }))
      .status,
    401,
  );
  await state(c);
  const kickMessage = await call("/chat", b.token, { text: "추방 전 메시지" });
  assert.equal(kickMessage.status, 201);
  const kickAttack = await call("/friends/attack", b.token, {
    friendId: c.profile.id,
  });
  assert.equal(kickAttack.status, 201);
  const beforeKick = await call("/state", c.token);
  assert.ok(beforeKick.body.messages.some(
    (message: { id: number }) => message.id === kickMessage.body.id,
  ));
  assert.ok(beforeKick.body.attacks.some(
    (attack: { id: number }) => attack.id === kickAttack.body.id,
  ));
  inspection.exec(
    "CREATE TRIGGER fail_kick BEFORE INSERT ON rooms BEGIN SELECT RAISE(ABORT, 'test rollback'); END",
  );
  const kickLog = t.mock.method(console, "error", () => {});
  assert.equal(
    (await call("/friends/remove", a.token, { friendId: b.profile.id })).status,
    500,
  );
  kickLog.mock.restore();
  inspection.exec("DROP TRIGGER fail_kick");
  await peers(b, [a, c, d, f]);
  assert.equal((await state(b)).room?.ownerId, a.profile.id);
  assert.deepEqual((await call("/state", c.token)).body, beforeKick.body);
  assert.equal(
    (await call("/friends/remove", a.token, { friendId: b.profile.id })).status,
    200,
  );
  await peers(b, []);
  const kickedRoom = (await state(b)).room;
  assert.equal(kickedRoom?.ownerId, b.profile.id);
  assert.notEqual(kickedRoom?.id, originalRoom?.id);
  for (const person of [a, c, d, f]) {
    const remaining = await state(person);
    assert.ok(remaining.friends.every((friend) => friend.id !== b.profile.id));
    assert.ok(
      remaining.messages?.every((message) => message.senderId !== b.profile.id),
    );
    assert.ok(
      remaining.attacks?.every((attack) =>
        attack.attackerId !== b.profile.id && attack.targetId !== b.profile.id,
      ),
    );
    assert.equal(remaining.room?.id, originalRoom?.id);
  }
  assert.equal(
    (await call("/state", c.token, undefined, beforeKick.etag)).status,
    200,
  );
  assert.deepEqual(await invite(a), first);
  await close();
  server = createApp({ databasePath, now: () => now });
  await listen();
  await peers(b, []);
  assert.deepEqual((await state(b)).room, kickedRoom);
  assert.equal((await state(c)).room?.ownerId, a.profile.id);
  assert.deepEqual(inspection.prepare("PRAGMA foreign_key_check").all(), []);
});

test("legacy connected groups migrate once into separate rooms without exposing old chat or restoring removed links", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "wappy-room-migration-"));
  const path = join(directory, "legacy.sqlite");
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const seed = new DatabaseSync(path);
  seed.exec(`
    CREATE TABLE users (id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE, name TEXT NOT NULL, character TEXT NOT NULL) STRICT;
    CREATE TABLE friendships (user_id TEXT NOT NULL REFERENCES users(id), friend_id TEXT NOT NULL REFERENCES users(id), PRIMARY KEY (user_id, friend_id), CHECK (user_id < friend_id)) STRICT;
    CREATE TABLE invites (code_hash TEXT PRIMARY KEY, owner_id TEXT NOT NULL UNIQUE REFERENCES users(id), expires_at INTEGER NOT NULL) STRICT;
    CREATE TABLE chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT, sender_id TEXT NOT NULL REFERENCES users(id),
      recipient_id TEXT REFERENCES users(id), text TEXT NOT NULL, sent_at INTEGER NOT NULL
    ) STRICT;
    CREATE TABLE chat_recipients (
      message_id INTEGER NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL, friend_id TEXT NOT NULL,
      PRIMARY KEY (message_id, user_id, friend_id),
      FOREIGN KEY (user_id, friend_id) REFERENCES friendships(user_id, friend_id) ON DELETE CASCADE
    ) STRICT;
    INSERT INTO users VALUES ('a', 'a', 'A', 'chiikawa'), ('b', 'b', 'B', 'chiikawa'), ('c', 'c', 'C', 'chiikawa'), ('d', 'd', 'D', 'chiikawa'), ('e', 'e', 'E', 'chiikawa');
    INSERT INTO friendships VALUES ('a', 'b'), ('a', 'c'), ('d', 'e');
    INSERT INTO chat_messages (sender_id, text, sent_at) VALUES ('b', 'before rooms', 1800000000000);
    INSERT INTO chat_recipients VALUES (1, 'a', 'b');
  `);
  for (const id of ["a", "b", "d"])
    seed
      .prepare("INSERT INTO invites VALUES (?, ?, 1)")
      .run(createHash("sha256").update(id.repeat(5)).digest("hex"), id);
  seed.close();
  let db = openDatabase(path);
  try {
    const room = (id: string) =>
      db.prepare("SELECT room_id FROM room_members WHERE user_id = ?").get(id)!
        .room_id;
    assert.equal(room("a"), room("b"));
    assert.equal(room("b"), room("c"));
    assert.equal(room("d"), room("e"));
    assert.notEqual(room("a"), room("d"));
    assert.ok(
      db
        .prepare(
          "SELECT 1 FROM friendships WHERE user_id = 'b' AND friend_id = 'c'",
        )
        .get(),
    );
    assert.equal(
      db.prepare("SELECT COUNT(*) AS count FROM friendships").get()!.count,
      4,
    );
    assert.equal(
      db.prepare("SELECT COUNT(*) AS count FROM invites").get()!.count,
      5,
    );
    const rooms = db.prepare("SELECT * FROM rooms ORDER BY id").all();
    for (const room of rooms)
      assert.match(room.invite_code as string, /^[A-HJ-NP-Z2-9]{5}$/);
    for (const invite of db.prepare("SELECT * FROM invites").all())
      assert.equal(invite.room_id, room(invite.owner_id as string));
    assert.deepEqual(
      db
        .prepare("SELECT * FROM chat_recipients")
        .all()
        .map((row) => ({ ...row })),
      [{ message_id: 1, user_id: "a", friend_id: "b" }],
      "newly connected C does not gain access to B's earlier message",
    );
    db.exec("DELETE FROM friendships WHERE user_id = 'b' AND friend_id = 'c'");
    db.close();
    db = openDatabase(path);
    assert.deepEqual(
      db.prepare("SELECT * FROM rooms ORDER BY id").all(),
      rooms,
    );
    assert.equal(
      db.prepare("SELECT COUNT(*) AS count FROM rooms").get()!.count,
      2,
    );
    assert.equal(
      db.prepare("SELECT COUNT(*) AS count FROM friendships").get()!.count,
      3,
    );
    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
  } finally {
    db.close();
  }
});

test("existing rooms and profiles without a room receive permanent codes only once", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "wappy-room-codes-"));
  const path = join(directory, "legacy.sqlite");
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const seed = new DatabaseSync(path);
  seed.exec(`
    CREATE TABLE users (id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE, name TEXT NOT NULL, character TEXT NOT NULL) STRICT;
    CREATE TABLE rooms (id TEXT PRIMARY KEY, name TEXT NOT NULL) STRICT;
    CREATE TABLE room_members (
      room_id TEXT NOT NULL REFERENCES rooms(id), user_id TEXT NOT NULL UNIQUE REFERENCES users(id),
      PRIMARY KEY (room_id, user_id)
    ) STRICT;
    CREATE TABLE invites (
      code_hash TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id),
      room_id TEXT NOT NULL REFERENCES rooms(id)
    ) STRICT;
    INSERT INTO users VALUES ('owner', 'a', 'A', 'chiikawa'), ('waiting', 'b', 'B', 'chiikawa');
    INSERT INTO rooms VALUES ('occupied', 'A의 방'), ('empty', '이전 방');
    INSERT INTO room_members VALUES ('occupied', 'owner');
  `);
  const legacyHash = createHash("sha256").update("A7K3M").digest("hex");
  seed
    .prepare("INSERT INTO invites VALUES (?, 'owner', 'empty')")
    .run(legacyHash);
  seed.close();
  let db = openDatabase(path);
  try {
    const rooms = db.prepare("SELECT * FROM rooms ORDER BY id").all();
    assert.equal(rooms.length, 3);
    assert.equal(new Set(rooms.map((room) => room.invite_code)).size, 3);
    for (const room of rooms) {
      assert.match(room.invite_code as string, /^[A-HJ-NP-Z2-9]{5}$/);
      const digest = createHash("sha256")
        .update(room.invite_code as string)
        .digest("hex");
      assert.equal(
        db
          .prepare("SELECT room_id FROM invites WHERE code_hash = ?")
          .get(digest)?.room_id,
        room.id,
      );
    }
    assert.equal(
      db
        .prepare("SELECT room_id FROM room_members WHERE user_id = 'owner'")
        .get()?.room_id,
      "occupied",
    );
    assert.ok(
      db
        .prepare("SELECT room_id FROM room_members WHERE user_id = 'waiting'")
        .get(),
    );
    assert.equal(
      db
        .prepare("SELECT room_id FROM invites WHERE code_hash = ?")
        .get(legacyHash)?.room_id,
      "empty",
    );
    db.close();
    db = openDatabase(path);
    assert.deepEqual(
      db.prepare("SELECT * FROM rooms ORDER BY id").all(),
      rooms,
    );
    assert.equal(
      db.prepare("SELECT COUNT(*) AS count FROM invites").get()!.count,
      4,
    );
    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
  } finally {
    db.close();
  }
});
