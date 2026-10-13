import assert from "node:assert/strict";
import { test } from "node:test";
import {
  SESSION_KEY,
  SAVED_SESSIONS_KEY,
  loadSession,
  saveSession,
  type SavedProfile,
} from "../src/sessions.ts";

test("saving a session preserves existing profiles and updates only the matching credential", () => {
  const values = new Map<string, string>();
  let fail = "";
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      if (fail === `write:${key}`) throw new Error("Storage full");
      values.set(key, value);
    },
  };
  const savedProfiles = () =>
    JSON.parse(storage.getItem(SAVED_SESSIONS_KEY) ?? "[]");
  const alice: SavedProfile = {
    server: "https://one.test",
    token: "a".repeat(43),
    profile: {
      id: "alice",
      name: "Alice",
      character: "hachiware",
    },
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
  storage.setItem(SAVED_SESSIONS_KEY, JSON.stringify([alice]));
  saveSession(bob, storage);
  assert.deepEqual(savedProfiles(), [alice]);
  assert.deepEqual(loadSession(storage), {
    server: bob.server,
    token: bob.token,
  });
  storage.setItem(SAVED_SESSIONS_KEY, JSON.stringify([alice, bob, elsewhere]));
  const renewed = {
    ...alice,
    token: "d".repeat(43),
    profile: { ...alice.profile!, name: "Alicia" },
  };
  saveSession(renewed, storage);
  assert.deepEqual(loadSession(storage), {
    server: alice.server,
    token: renewed.token,
  });
  assert.deepEqual(savedProfiles(), [bob, elsewhere, renewed]);
  saveSession({ server: renewed.server, token: renewed.token }, storage);
  assert.deepEqual(
    savedProfiles(),
    [bob, elsewhere, renewed],
    "saving credentials preserves cached display information",
  );

  fail = `write:${SAVED_SESSIONS_KEY}`;
  assert.throws(() => saveSession(alice, storage));
  assert.deepEqual(loadSession(storage), {
    server: renewed.server,
    token: renewed.token,
  });
  fail = `write:${SESSION_KEY}`;
  assert.throws(() => saveSession(elsewhere, storage));
  assert.deepEqual(loadSession(storage), {
    server: renewed.server,
    token: renewed.token,
  });
  fail = "";
  storage.setItem(SAVED_SESSIONS_KEY, "{damaged");
  assert.throws(() => saveSession(renewed, storage));
  assert.equal(
    storage.getItem(SAVED_SESSIONS_KEY),
    "{damaged",
    "unreadable archives must not be overwritten",
  );
  assert.equal(loadSession(storage)?.token, renewed.token);
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
  saveSession(renewed, storage);
  assert.deepEqual(savedProfiles(), [
    { server: bob.server, token: bob.token },
    renewed,
  ]);
});
