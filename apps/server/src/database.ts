import { DatabaseSync } from "node:sqlite";
import { REMOVED_CHARACTERS } from "@wappy/api";

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
    CREATE TABLE IF NOT EXISTS invites (
      code_hash TEXT PRIMARY KEY, owner_id TEXT NOT NULL UNIQUE REFERENCES users(id)
    ) STRICT;
    DROP TABLE IF EXISTS recovery_codes;
    CREATE TABLE IF NOT EXISTS kakao_accounts (
      kakao_id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE
    ) STRICT;
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
  for (const table of ["users", "profile_blocks"]) {
    db.prepare(
      `UPDATE ${table} SET character = 'chiikawa'
       WHERE character IN (${REMOVED_CHARACTERS.map(() => "?").join(",")})`,
    ).run(...REMOVED_CHARACTERS);
  }
  return db;
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
