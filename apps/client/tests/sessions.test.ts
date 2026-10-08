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
  forgetDeletedProfile,
  type SavedProfile,
} from "../src/sessions.ts";
import { residentSelectionKey } from "../src/resident-selection.ts";

test("confirmed profile deletion removes only that identity and reports partial storage failures", () => {
  const values = new Map<string, string>();
  let fail = "";
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (key === fail) throw new Error("Storage unavailable");
      values.set(key, value);
    },
    removeItem: (key: string) => {
      if (key === fail) throw new Error("Storage unavailable");
      values.delete(key);
    },
  };
  const deleted = {
    server: "https://one.test",
    token: "a".repeat(43),
    profile: {
      id: "alice",
      name: "Alice",
      character: "cat" as const,
      status: "",
    },
  };
  const old = { ...deleted, token: "b".repeat(43) };
  const bob = {
    ...deleted,
    token: "c".repeat(43),
    profile: { ...deleted.profile, id: "bob" },
  };
  const elsewhere = { ...deleted, server: "https://two.test" };
  const selectionKey = residentSelectionKey(deleted.server, deleted.profile.id);
  function seed() {
    fail = "";
    values.clear();
    storage.setItem(SESSION_KEY, JSON.stringify(deleted));
    storage.setItem(
      SAVED_SESSIONS_KEY,
      JSON.stringify([old, deleted, bob, elsewhere]),
    );
    storage.setItem(selectionKey, '["bob"]');
    storage.setItem(
      residentSelectionKey(elsewhere.server, elsewhere.profile.id),
      '["other"]',
    );
    storage.setItem("wappy.desktop.v1", "unchanged");
  }
  seed();
  assert.equal(forgetDeletedProfile(deleted, storage), true);
  assert.equal(loadSession(storage), null);
  assert.deepEqual(loadSavedSessions(storage), [bob, elsewhere]);
  assert.equal(storage.getItem(selectionKey), null);
  assert.equal(
    storage.getItem(
      residentSelectionKey(elsewhere.server, elsewhere.profile.id),
    ),
    '["other"]',
  );
  assert.equal(storage.getItem("wappy.desktop.v1"), "unchanged");
  assert.equal(forgetDeletedProfile(deleted, storage), true);

  seed();
  saveSession(bob, storage);
  assert.equal(forgetDeletedProfile(deleted, storage), true);
  assert.equal(
    loadSession(storage)?.token,
    bob.token,
    "late cleanup cannot log out a different profile",
  );

  for (const key of [SESSION_KEY, SAVED_SESSIONS_KEY, selectionKey]) {
    seed();
    fail = key;
    assert.equal(forgetDeletedProfile(deleted, storage), false);
    if (key !== SESSION_KEY) assert.equal(loadSession(storage), null);
    if (key !== SAVED_SESSIONS_KEY)
      assert.deepEqual(loadSavedSessions(storage), [bob, elsewhere]);
    if (key !== selectionKey) assert.equal(storage.getItem(selectionKey), null);
    fail = "";
    assert.equal(forgetDeletedProfile(deleted, storage), true);
  }
  seed();
  storage.setItem(SAVED_SESSIONS_KEY, "{damaged");
  assert.equal(forgetDeletedProfile(deleted, storage), false);
  assert.equal(
    storage.getItem(SAVED_SESSIONS_KEY),
    "{damaged",
    "unreadable archives are not erased",
  );
  assert.equal(loadSession(storage), null);
  assert.equal(storage.getItem(selectionKey), null);
});

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
