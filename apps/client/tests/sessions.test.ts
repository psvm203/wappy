import assert from "node:assert/strict";
import { test } from "node:test";
import {
  SESSION_KEY,
  SAVED_SESSIONS_KEY,
  loadSession,
  loadSavedSessions,
  saveSession,
  parkSession,
  forgetSavedSession,
  type SavedProfile,
} from "../src/sessions.ts";

test("server switching preserves distinct profiles and updates only the recovered identity", () => {
  const values = new Map<string, string>();
  let fail = "";
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (fail === `write:${key}`) throw new Error("Storage full");
      values.set(key, value);
    },
    removeItem: (key: string) => {
      if (fail === `remove:${key}`) throw new Error("Storage unavailable");
      values.delete(key);
    },
  };
  const alice: SavedProfile = {
    server: "https://one.test",
    token: "a".repeat(43),
    profile: { id: "alice", name: "Alice", character: "cat", status: "hello" },
  };
  const bob: SavedProfile = {
    ...alice,
    token: "b".repeat(43),
    profile: { ...alice.profile!, id: "bob", name: "Bob" },
  };
  const elsewhere: SavedProfile = {
    ...alice,
    server: "https://two.test",
    token: "c".repeat(43),
  };

  // Existing installations retain their original active-session format.
  storage.setItem(
    SESSION_KEY,
    JSON.stringify({ server: "https://ONE.test:443/", token: alice.token }),
  );
  assert.deepEqual(loadSession(storage), {
    server: alice.server,
    token: alice.token,
  });
  assert.deepEqual(loadSavedSessions(storage), []);
  assert.deepEqual(parkSession(alice, storage), [alice]);
  assert.equal(loadSession(storage), null);
  saveSession(bob, storage);
  assert.deepEqual(loadSavedSessions(storage), [alice]);
  parkSession(bob, storage);
  parkSession(elsewhere, storage);
  assert.deepEqual(loadSavedSessions(storage), [alice, bob, elsewhere]);
  const recovered = {
    ...alice,
    token: "d".repeat(43),
    profile: { ...alice.profile!, name: "Alicia" },
  };
  saveSession(recovered, storage);
  assert.deepEqual(loadSession(storage), {
    server: alice.server,
    token: recovered.token,
  });
  assert.deepEqual(loadSavedSessions(storage), [bob, elsewhere, recovered]);
  assert.deepEqual(
    forgetSavedSession(alice, storage),
    [bob, elsewhere, recovered],
    "stale removal cannot delete a newly recovered credential",
  );
  assert.deepEqual(forgetSavedSession(bob, storage), [elsewhere, recovered]);
  parkSession({ server: recovered.server, token: recovered.token }, storage);
  assert.deepEqual(
    loadSavedSessions(storage),
    [elsewhere, recovered],
    "offline switching preserves cached display information",
  );

  saveSession(recovered, storage);
  for (const operation of [
    `write:${SAVED_SESSIONS_KEY}`,
    `remove:${SESSION_KEY}`,
  ]) {
    fail = operation;
    assert.throws(() => parkSession(recovered, storage));
    assert.deepEqual(loadSession(storage), {
      server: recovered.server,
      token: recovered.token,
    });
  }
  fail = `write:${SESSION_KEY}`;
  assert.throws(() => saveSession(elsewhere, storage));
  assert.deepEqual(loadSession(storage), {
    server: recovered.server,
    token: recovered.token,
  });
  fail = "";
  storage.setItem(SAVED_SESSIONS_KEY, "{damaged");
  assert.deepEqual(loadSavedSessions(storage), []);
  assert.throws(() => parkSession(recovered, storage));
  assert.equal(
    storage.getItem(SAVED_SESSIONS_KEY),
    "{damaged",
    "unreadable archives must not be overwritten",
  );
  assert.equal(loadSession(storage)?.token, recovered.token);
  storage.setItem(
    SAVED_SESSIONS_KEY,
    JSON.stringify([
      alice,
      alice,
      null,
      { ...bob, server: "https://secret@evil.test" },
      { ...elsewhere, token: "bad" },
      { ...bob, profile: { name: null } },
    ]),
  );
  assert.deepEqual(loadSavedSessions(storage), [
    alice,
    { server: bob.server, token: bob.token },
  ]);
});
