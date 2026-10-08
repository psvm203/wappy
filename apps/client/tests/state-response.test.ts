import assert from "node:assert/strict";
import { test } from "node:test";
import {
  parseSidebarState,
  parsePresenceSettings,
  type SidebarState,
} from "@wappy/api";
import { reconcilePresence } from "../src/presence.ts";

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

test("private presence settings are validated and older polls cannot undo a confirmed change", () => {
  const state: SidebarState = {
    self: { id: "alice", name: "Alice", character: "cat", status: "" },
    friends: [],
  };
  const hidden = { sharing: false, revision: 2 };
  assert.deepEqual(
    parsePresenceSettings({ ...hidden, token: "discard" }),
    hidden,
  );
  assert.deepEqual(parseSidebarState({ ...state, presence: hidden }), {
    ...state,
    presence: hidden,
  });
  assert.equal(
    parseSidebarState(state).presence,
    undefined,
    "older servers do not imply a confirmed sharing preference",
  );
  for (const presence of [
    null,
    [],
    {},
    { sharing: "false", revision: 1 },
    { sharing: false, revision: -1 },
    { sharing: true, revision: NaN },
    { sharing: true, revision: 0.5 },
    { sharing: true, revision: Number.MAX_SAFE_INTEGER + 1 },
  ]) {
    assert.throws(() => parsePresenceSettings(presence));
    assert.throws(() => parseSidebarState({ ...state, presence }));
  }
  const current = { ...state, presence: hidden };
  const oldPoll = {
    ...state,
    self: { ...state.self, status: "still update profiles" },
    presence: { sharing: true, revision: 1 },
  };
  assert.deepEqual(reconcilePresence(current, oldPoll), {
    ...oldPoll,
    presence: hidden,
  });
  const shown = { ...state, presence: { sharing: true, revision: 3 } };
  assert.deepEqual(reconcilePresence(current, shown), shown);
  assert.deepEqual(reconcilePresence(shown, current), shown);
  assert.deepEqual(reconcilePresence(null, current), current);
  const other = {
    ...state,
    self: { ...state.self, id: "bob" },
    presence: { sharing: true, revision: 0 },
  };
  assert.deepEqual(reconcilePresence(current, other), other);
  assert.deepEqual(
    reconcilePresence(current, state),
    state,
    "missing support must not keep claiming a hidden state",
  );
});
