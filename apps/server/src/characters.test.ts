import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import { REMOVED_CHARACTERS } from "@wappy/api";
import { createApp } from "./server.ts";

test("startup replaces retired characters without changing accounts", async () => {
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
      const insert = db.prepare("INSERT INTO users VALUES (?, ?, ?, ?)");
      insert.run("owner", "owner-token", "Owner", "hachiware");
      for (const character of [...REMOVED_CHARACTERS, "shisa", "unknown"])
        insert.run(character, `${character}-token`, character, character);
      const users = db.prepare("SELECT * FROM users ORDER BY id").all();
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
      }
    } finally {
      db.close();
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
