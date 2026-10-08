import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { REMOVED_CHARACTERS } from "@wappy/api";
import { createApp } from "./server.ts";

test("startup replaces retired characters without changing accounts or block relationships", async () => {
  const directory = mkdtempSync(join(tmpdir(), "wappy-characters-"));
  const databasePath = join(directory, "test.sqlite");
  async function restart() {
    const server = createApp({ databasePath });
    const closed = once(server, "close");
    server.close();
    await closed;
  }
  try {
    await restart();
    const db = new DatabaseSync(databasePath);
    try {
      const insert = db.prepare("INSERT INTO users VALUES (?, ?, ?, ?, ?)");
      insert.run("owner", "owner-token", "Owner", "hachiware", "함께");
      for (const character of [...REMOVED_CHARACTERS, "shisa", "unknown"]) {
        insert.run(
          character,
          `${character}-token`,
          character,
          character,
          "status",
        );
        db.prepare("INSERT INTO profile_blocks VALUES (?, ?, ?, ?)").run(
          "owner",
          character,
          `blocked ${character}`,
          character,
        );
      }
      db.prepare("INSERT INTO blocking_settings VALUES (?, ?)").run("owner", 9);
      const users = db.prepare("SELECT * FROM users ORDER BY id").all();
      const blocks = db
        .prepare("SELECT * FROM profile_blocks ORDER BY blocked_id")
        .all();
      const migrated = (row: Record<string, unknown>) => ({
        ...row,
        character: REMOVED_CHARACTERS.includes(row.character as string)
          ? "chiikawa"
          : row.character,
      });
      for (let attempt = 0; attempt < 2; attempt++) {
        await restart();
        assert.deepEqual(
          db
            .prepare("SELECT * FROM users ORDER BY id")
            .all()
            .map((row) => ({ ...row })),
          users.map(migrated),
        );
        assert.deepEqual(
          db
            .prepare("SELECT * FROM profile_blocks ORDER BY blocked_id")
            .all()
            .map((row) => ({ ...row })),
          blocks.map(migrated),
        );
        assert.equal(
          db
            .prepare(
              "SELECT revision FROM blocking_settings WHERE user_id = 'owner'",
            )
            .get()?.revision,
          9,
        );
      }
    } finally {
      db.close();
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
