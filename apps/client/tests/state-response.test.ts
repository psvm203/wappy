import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CHARACTERS,
  CHARACTER_NAMES,
  REMOVED_CHARACTERS,
  parseBlockingSettings,
  parseProfile,
  parseInvitePreview,
  parseSidebarState,
  parsePresenceSettings,
  type SidebarState,
} from "@wappy/api";
import { reconcilePresence } from "../src/presence.ts";
import { saveSession, SAVED_SESSIONS_KEY } from "../src/sessions.ts";

test("legacy status messages are discarded from profiles, server snapshots and saved sessions", () => {
  const input = { name: "Alice", character: "chiikawa" };
  const profile = { id: "self", ...input };
  const legacy = { ...profile, status: "previous status" };
  assert.deepEqual(parseProfile(input), input);
  assert.deepEqual(parseProfile(legacy), input);
  assert.deepEqual(
    parseSidebarState({
      self: legacy,
      friends: [{ ...legacy, id: "friend", online: true }],
    }),
    { self: profile, friends: [{ ...profile, id: "friend", online: true }] },
  );
  const session = {
    server: "https://one.test",
    token: "a".repeat(43),
    profile: legacy,
  };
  let saved = JSON.stringify([session]);
  saveSession(
    { server: session.server, token: session.token },
    {
      getItem: () => saved,
      setItem: (key, value) => {
        if (key === SAVED_SESSIONS_KEY) saved = value;
      },
    },
  );
  assert.deepEqual(JSON.parse(saved), [{ ...session, profile }]);
});

test("retired characters are rejected for new profiles but old snapshots and saved sessions remain usable", () => {
  assert.equal(CHARACTERS.length, 25);
  for (const character of REMOVED_CHARACTERS) {
    const input = { name: "기존 친구", character };
    const profile = { id: "self", ...input };
    const migrated = { ...profile, character: "chiikawa" };
    assert.throws(() => parseProfile(input));
    assert.equal(
      CHARACTERS.some((kind) => kind === character),
      false,
    );
    assert.deepEqual(
      parseSidebarState({
        self: profile,
        friends: [{ ...profile, id: "friend", online: false }],
      }),
      {
        self: migrated,
        friends: [{ ...migrated, id: "friend", online: false }],
      },
    );
    assert.deepEqual(
      parseInvitePreview({ ...input, expiresAt: 1_800_000_000_000 }),
      { name: input.name, character: "chiikawa" },
    );
    assert.deepEqual(
      parseBlockingSettings({ revision: 2, profiles: [profile] }),
      {
        revision: 2,
        profiles: [
          { id: profile.id, name: profile.name, character: "chiikawa" },
        ],
      },
    );
    const session = {
      server: "https://one.test",
      token: "a".repeat(43),
      profile,
    };
    let saved = JSON.stringify([session]);
    saveSession(
      { server: session.server, token: session.token },
      {
        getItem: () => saved,
        setItem: (key, value) => {
          if (key === SAVED_SESSIONS_KEY) saved = value;
        },
      },
    );
    assert.deepEqual(JSON.parse(saved), [{ ...session, profile: migrated }]);
  }
});

test("every selectable character survives profile, invitation and friend-state validation", () => {
  for (const character of CHARACTERS) {
    const input = {
      name: CHARACTER_NAMES[character],
      character,
    };
    assert.deepEqual(parseProfile(input), input);
    const preview = {
      name: input.name,
      character,
    };
    assert.deepEqual(parseInvitePreview(preview), preview);
    const state = {
      self: { id: "self", ...input },
      friends: [{ id: "friend", ...input, online: false }],
    };
    assert.deepEqual(
      parseSidebarState(JSON.parse(JSON.stringify(state))),
      state,
    );
  }
});

test("invalid server states cannot become online or corrupt character rendering", () => {
  const self = {
    id: "self",
    name: "Alice",
    character: "momonga",
  };
  const friend = { ...self, id: "friend", character: "rakko", online: true };
  const state = { self, friends: [friend] };
  assert.deepEqual(parseSidebarState(state), state);
  const wave = { id: "wave", sentAt: 1_800_000_000_000 };
  assert.deepEqual(
    parseSidebarState({
      self,
      friends: [{ ...friend, wave: { ...wave, private: "discard" } }],
    }),
    state,
    "old server greetings are discarded",
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
    { self, friends: [{ ...friend, name: null }] },
    { self, friends: [friend, friend] },
    { self, friends: [{ ...friend, id: self.id }] },
  ])
    assert.throws(() => parseSidebarState(invalid));
});

test("private presence settings are validated and older polls cannot undo a confirmed change", () => {
  const state: SidebarState = {
    self: { id: "alice", name: "Alice", character: "hachiware" },
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
    self: { ...state.self, name: "Updated Alice" },
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

test("current room metadata is validated without exposing extra server fields", () => {
  const state = {
    self: { id: "self", name: "A", character: "chiikawa" },
    friends: [],
  };
  const room = { id: "room", name: "A의 방" };
  assert.deepEqual(
    parseSidebarState({ ...state, room: { ...room, code: "private" } }),
    { ...state, room },
  );
  assert.equal(parseSidebarState(state).room, undefined);
  assert.deepEqual(
    parseSidebarState({ ...state, room: { ...room, inviteCode: "A7K3M" } }).room,
    { ...room, inviteCode: "A7K3M" },
  );
  for (const inviteCode of [null, 12345, "", "bad-code", "A0K3M", "a7k3m"])
    assert.throws(() =>
      parseSidebarState({ ...state, room: { ...room, inviteCode } }),
    );
  for (const room of [
    null,
    [],
    {},
    { id: "", name: "방" },
    { id: 1, name: "방" },
    { id: "r", name: " " },
    { id: "r", name: "x".repeat(28) },
    { id: "r", name: "bad\nroom" },
  ]) {
    assert.throws(() => parseSidebarState({ ...state, room }));
  }
});
