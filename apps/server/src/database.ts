import { DatabaseSync } from "node:sqlite";
import { createHash, randomInt, randomUUID } from "node:crypto";
import { REMOVED_CHARACTERS, type Profile } from "@wappy/api";
import { HttpError } from "./http.ts";

export function openDatabase(databasePath: string) {
  const db = new DatabaseSync(databasePath);
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL, character TEXT NOT NULL
    ) STRICT;
    CREATE TABLE IF NOT EXISTS friendships (
      user_id TEXT NOT NULL REFERENCES users(id),
      friend_id TEXT NOT NULL REFERENCES users(id),
      PRIMARY KEY (user_id, friend_id), CHECK (user_id < friend_id)
    ) STRICT;
    CREATE TABLE IF NOT EXISTS invites (
      code_hash TEXT PRIMARY KEY, owner_id TEXT NOT NULL UNIQUE REFERENCES users(id)
    ) STRICT;
    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY, name TEXT NOT NULL
    ) STRICT;
    CREATE TABLE IF NOT EXISTS room_members (
      room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      PRIMARY KEY (room_id, user_id)
    ) STRICT;
    DROP TABLE IF EXISTS recovery_codes;
    DROP TABLE IF EXISTS kakao_accounts;
    CREATE TABLE IF NOT EXISTS presence_settings (
      user_id TEXT PRIMARY KEY REFERENCES users(id),
      sharing INTEGER NOT NULL CHECK (sharing IN (0, 1)),
      revision INTEGER NOT NULL CHECK (revision >= 1)
    ) STRICT;
    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      recipient_id TEXT REFERENCES users(id) ON DELETE CASCADE,
      text TEXT NOT NULL, sent_at INTEGER NOT NULL
    ) STRICT;
    CREATE TABLE IF NOT EXISTS attack_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL, friend_id TEXT NOT NULL,
      attacker_id TEXT NOT NULL, target_id TEXT NOT NULL, sent_at INTEGER NOT NULL,
      CHECK ((attacker_id = user_id AND target_id = friend_id) OR
        (attacker_id = friend_id AND target_id = user_id)),
      FOREIGN KEY (user_id, friend_id) REFERENCES friendships(user_id, friend_id) ON DELETE CASCADE
    ) STRICT;
    CREATE INDEX IF NOT EXISTS attacks_sender ON attack_events(attacker_id, sent_at);
    CREATE INDEX IF NOT EXISTS attacks_target ON attack_events(target_id, sent_at);
    CREATE INDEX IF NOT EXISTS attacks_expiry ON attack_events(sent_at);
    CREATE INDEX IF NOT EXISTS chat_sender ON chat_messages(sender_id, id DESC);
    CREATE INDEX IF NOT EXISTS chat_expiry ON chat_messages(sent_at);
    CREATE TABLE IF NOT EXISTS chat_recipients (
      message_id INTEGER NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL, friend_id TEXT NOT NULL,
      PRIMARY KEY (message_id, user_id, friend_id),
      FOREIGN KEY (user_id, friend_id) REFERENCES friendships(user_id, friend_id) ON DELETE CASCADE
    ) STRICT;
    CREATE INDEX IF NOT EXISTS friendships_friend ON friendships(friend_id, user_id);
    CREATE INDEX IF NOT EXISTS recipients_user ON chat_recipients(user_id, message_id);
    CREATE INDEX IF NOT EXISTS recipients_friend ON chat_recipients(friend_id, message_id);
  `);
  if (
    db
      .prepare("PRAGMA table_info(users)")
      .all()
      .some((column) => column.name === "status")
  )
    db.exec("ALTER TABLE users DROP COLUMN status");
  if (
    !db
      .prepare("PRAGMA table_info(chat_messages)")
      .all()
      .some((column) => column.name === "recipient_id")
  )
    db.exec(
      "ALTER TABLE chat_messages ADD COLUMN recipient_id TEXT REFERENCES users(id) ON DELETE CASCADE",
    );
  if (
    db
      .prepare("PRAGMA table_info(invites)")
      .all()
      .some((column) => column.name === "expires_at")
  )
    db.exec("ALTER TABLE invites DROP COLUMN expires_at");
  // Old friendships have no invitation provenance. Keep each connected group
  // together in one room, preserving accounts, codes and existing chat audiences.
  transaction(db, () => {
    if (
      db
        .prepare("PRAGMA table_info(invites)")
        .all()
        .some((column) => column.name === "room_id")
    )
      return;
    const members = db.prepare(`WITH RECURSIVE connected(id) AS (
      SELECT ? UNION
      SELECT CASE WHEN f.user_id = c.id THEN f.friend_id ELSE f.user_id END
      FROM connected c JOIN friendships f ON f.user_id = c.id OR f.friend_id = c.id
    ) INSERT INTO room_members SELECT ?, id FROM connected`);
    for (const user of db
      .prepare("SELECT id, name FROM users ORDER BY id")
      .all()) {
      if (
        db.prepare("SELECT 1 FROM room_members WHERE user_id = ?").get(user.id!)
      )
        continue;
      db.prepare("INSERT INTO rooms (id, name) VALUES (?, ?)").run(
        user.id!,
        `${user.name}의 방`,
      );
      members.run(user.id!, user.id!);
    }
    db.exec(`
      INSERT OR IGNORE INTO friendships
        SELECT a.user_id, b.user_id FROM room_members a
        JOIN room_members b ON a.room_id = b.room_id AND a.user_id < b.user_id;
      ALTER TABLE invites RENAME TO legacy_invites;
      CREATE TABLE invites (
        code_hash TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL REFERENCES users(id),
        room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE
      ) STRICT;
      CREATE INDEX invites_room ON invites(room_id);
      INSERT INTO invites SELECT i.code_hash, i.owner_id, m.room_id
        FROM legacy_invites i JOIN room_members m ON m.user_id = i.owner_id;
      DROP TABLE legacy_invites;
    `);
  });
  transaction(db, () => {
    if (
      !db
        .prepare("PRAGMA table_info(rooms)")
        .all()
        .some((column) => column.name === "invite_code")
    ) {
      db.exec("ALTER TABLE rooms ADD COLUMN invite_code TEXT");
      db.exec("CREATE UNIQUE INDEX rooms_invite_code ON rooms(invite_code)");
    }
    // Profiles created before automatic rooms may still have no membership.
    for (const user of db
      .prepare(
        `SELECT id, name FROM users
      WHERE id NOT IN (SELECT user_id FROM room_members)`,
      )
      .all())
      createRoom(db, user as unknown as Pick<Profile, "id" | "name">);
    // Old codes were stored as hashes only. Keep them usable as aliases while
    // assigning one readable, permanent code to each existing room.
    for (const room of db
      .prepare(
        `SELECT r.id,
      COALESCE(
        (SELECT owner_id FROM invites WHERE room_id = r.id ORDER BY rowid LIMIT 1),
        (SELECT user_id FROM room_members WHERE room_id = r.id ORDER BY user_id LIMIT 1)
      ) AS owner_id FROM rooms r WHERE r.invite_code IS NULL`,
      )
      .all())
      assignRoomInvite(db, room.id as string, room.owner_id as string);
  });
  // Retire blocking without leaving members of the same room disconnected.
  transaction(db, () => {
    if (
      db.prepare(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'profile_blocks'",
      ).get()
    )
      db.exec(`
        INSERT OR IGNORE INTO friendships
          SELECT MIN(b.user_id, b.blocked_id), MAX(b.user_id, b.blocked_id)
          FROM profile_blocks b
          JOIN room_members a ON a.user_id = b.user_id
          JOIN room_members t ON t.user_id = b.blocked_id AND t.room_id = a.room_id;
        DROP TABLE profile_blocks;
      `);
    db.exec("DROP TABLE IF EXISTS blocking_settings");
  });
  db.prepare(
    `UPDATE users SET character = 'chiikawa'
     WHERE character IN (${REMOVED_CHARACTERS.map(() => "?").join(",")})`,
  ).run(...REMOVED_CHARACTERS);
  return db;
}

/** Called within the transaction that creates the profile or migrates old data. */
export function createRoom(
  db: DatabaseSync,
  owner: Pick<Profile, "id" | "name">,
) {
  const roomId = randomUUID();
  db.prepare("INSERT INTO rooms (id, name) VALUES (?, ?)").run(
    roomId,
    `${owner.name}의 방`,
  );
  db.prepare("INSERT INTO room_members VALUES (?, ?)").run(roomId, owner.id);
  assignRoomInvite(db, roomId, owner.id);
}

function assignRoomInvite(db: DatabaseSync, roomId: string, ownerId: string) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const collision = db.prepare("SELECT 1 FROM invites WHERE code_hash = ?");
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = Array.from(
      { length: 5 },
      () => alphabet[randomInt(alphabet.length)],
    ).join("");
    const digest = createHash("sha256").update(code).digest("hex");
    if (collision.get(digest)) continue;
    db.prepare("INSERT INTO invites VALUES (?, ?, ?)").run(
      digest,
      ownerId,
      roomId,
    );
    db.prepare("UPDATE rooms SET invite_code = ? WHERE id = ?").run(
      code,
      roomId,
    );
    return;
  }
  throw new HttpError(503, "초대 코드를 만들지 못했어요. 다시 시도해 주세요.");
}

/** Keep each synchronous group of writes atomic, including commit failures. */
export function transaction<T>(db: DatabaseSync, work: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = work();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
