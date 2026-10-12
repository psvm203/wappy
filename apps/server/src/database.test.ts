import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { transaction } from "./database.ts";

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
