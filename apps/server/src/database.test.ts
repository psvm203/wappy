import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createRoom, openDatabase, transaction } from "./database.ts";

test("legacy sessions migrate once and revoked credentials stay revoked after restart", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "wappy-session-migration-"));
  const path = join(directory, "test.sqlite");
  let db = new DatabaseSync(path);
  t.after(() => {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  });
  db.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL, character TEXT NOT NULL
    ) STRICT;
    INSERT INTO users VALUES ('alice', 'legacy-hash', 'Alice', 'chiikawa');
  `);
  db.close();
  db = openDatabase(path);
  assert.equal(
    db
      .prepare("SELECT user_id FROM sessions WHERE token_hash = 'legacy-hash'")
      .get()?.user_id,
    "alice",
  );
  db.exec("DELETE FROM sessions WHERE token_hash = 'legacy-hash'");
  db.close();
  db = openDatabase(path);
  assert.equal(
    db.prepare("SELECT COUNT(*) AS count FROM sessions").get()?.count,
    0,
  );
  assert.equal(
    db.prepare("SELECT name FROM users WHERE id = 'alice'").get()?.name,
    "Alice",
  );
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
});

test("retired blocking data restores only affected room connections once", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "wappy-block-removal-"));
  const path = join(directory, "test.sqlite");
  let db = openDatabase(path);
  t.after(() => {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  });
  for (const id of ["a", "b", "c", "d", "e"])
    db.prepare("INSERT INTO users VALUES (?, ?, ?, 'chiikawa')").run(
      id,
      id,
      id,
    );
  createRoom(db, { id: "a", name: "a" });
  createRoom(db, { id: "e", name: "e" });
  for (const id of ["b", "c", "d"])
    db.prepare(
      `INSERT INTO room_members
      SELECT room_id, ? FROM room_members WHERE user_id = 'a'`,
    ).run(id);
  // Model an older database with mutual, one-way and cross-room blocks.
  db.exec(`
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
    INSERT INTO profile_blocks VALUES
      ('a', 'b', 'b', 'chiikawa'), ('b', 'a', 'a', 'chiikawa'),
      ('c', 'b', 'b', 'chiikawa'), ('a', 'e', 'e', 'chiikawa');
    INSERT INTO blocking_settings VALUES ('a', 3), ('b', 1), ('c', 1);
    INSERT INTO friendships VALUES ('a', 'c'), ('c', 'd');
    INSERT INTO chat_messages (sender_id, text, sent_at) VALUES ('a', 'old chat', 1800000000000);
    INSERT INTO chat_recipients VALUES (1, 'a', 'c');
  `);
  const users = db.prepare("SELECT * FROM users ORDER BY id").all();
  const rooms = db.prepare("SELECT * FROM rooms ORDER BY id").all();
  const invites = db.prepare("SELECT * FROM invites ORDER BY code_hash").all();
  db.close();
  db = openDatabase(path);
  const pairs = () =>
    db
      .prepare("SELECT * FROM friendships ORDER BY user_id, friend_id")
      .all()
      .map(({ user_id, friend_id }) => [user_id, friend_id]);
  assert.deepEqual(pairs(), [
    ["a", "b"],
    ["a", "c"],
    ["b", "c"],
    ["c", "d"],
  ]);
  for (let attempt = 0; attempt < 2; attempt++) {
    assert.deepEqual(
      db
        .prepare(
          "SELECT name FROM sqlite_master WHERE name IN ('profile_blocks', 'blocking_settings', 'blocks_target')",
        )
        .all(),
      [],
    );
    assert.deepEqual(
      db.prepare("SELECT * FROM users ORDER BY id").all(),
      users,
    );
    assert.deepEqual(
      db.prepare("SELECT * FROM rooms ORDER BY id").all(),
      rooms,
    );
    assert.deepEqual(
      db.prepare("SELECT * FROM invites ORDER BY code_hash").all(),
      invites,
    );
    assert.deepEqual(
      db
        .prepare("SELECT * FROM chat_recipients")
        .all()
        .map((row) => ({ ...row })),
      [{ message_id: 1, user_id: "a", friend_id: "c" }],
      "restoring a connection does not expose past chat",
    );
    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
    db.exec("DELETE FROM friendships WHERE user_id = 'a' AND friend_id = 'b'");
    db.close();
    db = openDatabase(path);
    assert.deepEqual(pairs(), [
      ["a", "c"],
      ["b", "c"],
      ["c", "d"],
    ]);
  }
});

test("transactions commit results and roll back failed writes and commits", (t) => {
  const db = new DatabaseSync(":memory:");
  t.after(() => db.close());
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE parents (id INTEGER PRIMARY KEY);
    CREATE TABLE children (
      parent_id INTEGER REFERENCES parents(id) DEFERRABLE INITIALLY DEFERRED
    );
  `);
  const count = () =>
    db.prepare("SELECT COUNT(*) AS count FROM parents").get()!.count;

  const failure = new Error("write failed");
  assert.throws(
    () =>
      transaction(db, () => {
        db.exec("INSERT INTO parents VALUES (1)");
        throw failure;
      }),
    (error) => error === failure,
  );
  assert.equal(count(), 0);

  // A deferred constraint can fail at COMMIT, after the callback has returned.
  assert.throws(
    () =>
      transaction(db, () => {
        db.exec("INSERT INTO parents VALUES (1)");
        db.exec("INSERT INTO children VALUES (2)");
      }),
    /FOREIGN KEY constraint failed/,
  );
  assert.equal(count(), 0);
  assert.equal(
    db.prepare("SELECT COUNT(*) AS count FROM children").get()!.count,
    0,
  );

  assert.equal(
    transaction(db, () => {
      db.exec("INSERT INTO parents VALUES (1)");
      db.exec("INSERT INTO children VALUES (1)");
      return "committed";
    }),
    "committed",
  );
  assert.equal(count(), 1);
});
