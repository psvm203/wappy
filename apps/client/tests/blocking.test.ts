import assert from "node:assert/strict";
import { test } from "node:test";
import {
  parseBlockingSettings,
  parseSidebarState,
  type SidebarState,
} from "@wappy/api";
import { applyBlockingSettings, reconcileBlocking } from "../src/blocking.ts";

test("blocking responses validate private snapshots without allowing a blocked friend or message to render", () => {
  const self = {
    id: "alice",
    name: "Alice",
    character: "hachiware" as const,
    status: "",
  };
  const bob = { ...self, id: "bob", name: "Bob", online: true };
  const carol = { ...bob, id: "carol", name: "Carol" };
  const blockedBob = { id: bob.id, name: bob.name, character: bob.character };
  const blocking = { revision: 1, profiles: [blockedBob] };
  assert.deepEqual(
    parseBlockingSettings({
      ...blocking,
      profiles: [{ ...bob, token: "private" }],
    }),
    blocking,
  );
  const before: SidebarState = {
    self,
    friends: [bob, carol],
    blocking: { revision: 0, profiles: [] },
    messages: [
      { id: 1, senderId: bob.id, text: "공유", sentAt: 1 },
      {
        id: 2,
        senderId: self.id,
        recipientId: bob.id,
        text: "둘이",
        sentAt: 1,
      },
      { id: 3, senderId: carol.id, text: "그대로", sentAt: 1 },
      { id: 4, senderId: self.id, text: "내 공유", sentAt: 1 },
    ],
    unreadChatIds: [1, 3],
  };
  const after = applyBlockingSettings(before, blocking);
  assert.deepEqual(after.friends, [carol]);
  assert.deepEqual(
    after.messages?.map((message) => message.id),
    [3, 4],
  );
  assert.deepEqual(after.unreadChatIds, [3]);
  assert.deepEqual(parseSidebarState(after), after);
  assert.deepEqual(before.friends, [bob, carol]);
  assert.deepEqual(
    reconcileBlocking(after, before),
    after,
    "late polls cannot restore a blocked sender",
  );
  const unblocked = applyBlockingSettings(after, { revision: 2, profiles: [] });
  assert.deepEqual(
    unblocked.friends,
    [carol],
    "unblocking does not restore friendship",
  );
  assert.deepEqual(
    reconcileBlocking(unblocked, before),
    unblocked,
    "even pre-block polls cannot restore a connection after unblocking",
  );
  assert.equal(
    applyBlockingSettings(unblocked, blocking),
    unblocked,
    "an old mutation response cannot reinstate a block",
  );
  const reconnected = { ...before, blocking: unblocked.blocking };
  assert.equal(reconcileBlocking(unblocked, reconnected), reconnected);
  assert.equal(reconcileBlocking(null, before), before);
  const legacy = { ...before, blocking: undefined };
  assert.equal(reconcileBlocking(after, legacy), legacy);
  const different = { ...before, self: carol };
  assert.equal(reconcileBlocking(after, different), different);
  assert.throws(() => parseSidebarState({ ...before, blocking }));
  assert.throws(() =>
    parseSidebarState({
      ...before,
      blocking: { revision: 1, profiles: [self] },
    }),
  );
  for (const invalid of [
    null,
    [],
    {},
    { revision: -1, profiles: [] },
    { revision: 1.5, profiles: [] },
    { revision: "1", profiles: [] },
    { revision: NaN, profiles: [] },
    { revision: 1, profiles: null },
    { revision: 1, profiles: [blockedBob, blockedBob] },
    { revision: 1, profiles: [{ ...blockedBob, id: "" }] },
    { revision: 1, profiles: [{ ...blockedBob, character: "missing" }] },
  ])
    assert.throws(() => parseBlockingSettings(invalid));
});
