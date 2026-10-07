import assert from "node:assert/strict";
import { test } from "node:test";
import { parseSidebarState } from "@wappy/api";

test("invalid server states cannot become online or corrupt character rendering", () => {
  const self = { id: "self", name: "Alice", character: "cat", status: "함께" };
  const friend = { ...self, id: "friend", online: true };
  const state = { self, friends: [friend] };
  assert.deepEqual(parseSidebarState(state), state);
  assert.deepEqual(
    parseSidebarState({ self: { ...self, token: "private" }, friends: [] }),
    { self, friends: [] },
  );
  for (const invalid of [
    null,
    [],
    { error: "not a state" },
    { self, friends: {} },
    { self: { ...self, id: null }, friends: [] },
    { self, friends: [{ ...friend, character: "missing" }] },
    { self, friends: [{ ...friend, online: "false" }] },
    { self, friends: [{ ...friend, status: null }] },
    { self, friends: [friend, friend] },
    { self, friends: [{ ...friend, id: self.id }] },
  ])
    assert.throws(() => parseSidebarState(invalid));
});
