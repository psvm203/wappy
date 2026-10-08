import assert from "node:assert/strict";
import { test } from "node:test";
import type { SidebarState } from "@wappy/api";
import {
  residentSelectionKey,
  loadHiddenResidents,
  saveHiddenResidents,
  visibleResidents,
} from "../src/resident-selection.ts";

test("character selections isolate profiles and servers without changing friendship or presence", () => {
  const key = residentSelectionKey("https://example.test/", "alice");
  assert.equal(key, residentSelectionKey("https://example.test", "alice"));
  assert.notEqual(key, residentSelectionKey("https://elsewhere.test", "alice"));
  assert.notEqual(key, residentSelectionKey("https://example.test", "bob"));
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
  assert.deepEqual(loadHiddenResidents(key, storage), []);
  saveHiddenResidents(key, ["bob"], storage);
  assert.deepEqual(loadHiddenResidents(key, storage), ["bob"]);
  assert.deepEqual(
    loadHiddenResidents(
      residentSelectionKey("https://example.test", "bob"),
      storage,
    ),
    [],
  );
  assert.deepEqual(
    loadHiddenResidents(
      residentSelectionKey("https://elsewhere.test", "alice"),
      storage,
    ),
    [],
  );
  // Profile identity stays the same when its session credential rotates.
  assert.deepEqual(
    loadHiddenResidents(
      residentSelectionKey("https://example.test", "alice"),
      storage,
    ),
    ["bob"],
  );
  const state: SidebarState = {
    self: { id: "alice", name: "Alice", character: "hachiware", status: "" },
    friends: [
      {
        id: "bob",
        name: "Bob",
        character: "shisa",
        status: "",
        online: true,
        wave: { id: "greeting", sentAt: 1_800_000_000_000 },
      },
      {
        id: "carol",
        name: "Carol",
        character: "chiikawa",
        status: "",
        online: false,
      },
    ],
    presence: { sharing: false, revision: 1 },
  };
  const original = structuredClone(state);
  const everyone = visibleResidents(state, true, []);
  assert.deepEqual(
    everyone.map(({ id, online, isSelf }) => ({ id, online, isSelf })),
    [
      { id: "alice", online: true, isSelf: true },
      { id: "bob", online: true, isSelf: false },
      { id: "carol", online: false, isSelf: false },
    ],
  );
  assert.equal(everyone[1]?.wave?.id, "greeting");
  assert.deepEqual(
    visibleResidents(state, true, ["alice", "bob"]).map(({ id }) => id),
    ["carol"],
  );
  assert.deepEqual(
    visibleResidents(state, true, ["alice", "bob", "carol"]),
    [],
  );
  assert.deepEqual(
    visibleResidents(state, false, []).map(({ online }) => online),
    [true, false, false],
  );
  assert.equal(visibleResidents(state, true, ["removed-friend"]).length, 3);
  assert.deepEqual(
    state,
    original,
    "selection must not delete a friend, consume a greeting or publish presence",
  );
  saveHiddenResidents(key, [], storage);
  assert.deepEqual(loadHiddenResidents(key, storage), []);

  values.set(key, '["bob","bob","carol"]');
  assert.deepEqual(loadHiddenResidents(key, storage), ["bob", "carol"]);
  for (const invalid of [
    "{",
    "null",
    "{}",
    '"bob"',
    "[null]",
    "[1]",
    '[""]',
    JSON.stringify(["x".repeat(129)]),
  ]) {
    values.set(key, invalid);
    assert.throws(() => loadHiddenResidents(key, storage));
    assert.equal(
      values.get(key),
      invalid,
      "reading must not overwrite damaged preferences",
    );
  }
  assert.throws(() =>
    loadHiddenResidents(key, {
      getItem() {
        throw new Error("unavailable");
      },
    }),
  );
  assert.throws(() =>
    saveHiddenResidents(key, [], {
      setItem() {
        throw new Error("full");
      },
    }),
  );
});
