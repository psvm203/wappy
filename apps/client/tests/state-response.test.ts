import assert from "node:assert/strict";
import { test } from "node:test";
import { parseSidebarState } from "@wappy/api";

test("invalid server states cannot become online or corrupt character rendering", () => {
  const self = { id: "self", name: "Alice", character: "cat", status: "함께" };
  const friend = { ...self, id: "friend", online: true };
  const state = { self, friends: [friend] };
  assert.deepEqual(parseSidebarState(state), state);
  const wave = { id: "wave", sentAt: 1_800_000_000_000 };
  assert.deepEqual(
    parseSidebarState({
      self,
      friends: [{ ...friend, wave: { ...wave, private: "discard" } }],
    }),
    { self, friends: [{ ...friend, wave }] },
  );
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
    ...[
      null,
      {},
      { ...wave, id: "" },
      { ...wave, id: 123 },
      { ...wave, id: "x".repeat(129) },
      { ...wave, sentAt: "today" },
      { ...wave, sentAt: NaN },
      { ...wave, sentAt: -1 },
      { ...wave, sentAt: 0.5 },
      { ...wave, sentAt: Infinity },
      { ...wave, sentAt: 8_640_000_000_000_001 },
    ].map((wave) => ({ self, friends: [{ ...friend, wave }] })),
    {
      self,
      friends: [
        { ...friend, wave },
        { ...friend, id: "other", wave },
      ],
    },
  ])
    assert.throws(() => parseSidebarState(invalid));
});
