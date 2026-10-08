import assert from "node:assert/strict";
import test from "node:test";
import {
  ATTACK_TTL_MS,
  parseAttackEvent,
  parseSidebarState,
  type AttackEvent,
} from "@wappy/api";
import {
  collectAttacks,
  createAttackInbox,
  nextAttack,
} from "../src/online-attacks.ts";
import { applyBlockingSettings } from "../src/blocking.ts";

const event = (id: number): AttackEvent => ({
  id,
  attackerId: "self",
  targetId: "friend",
  sentAt: 1_800_000_000_000,
});
const online = new Set(["self", "friend"]);

test("attack snapshots reject spoofed participants, duplicates, invalid times and keep old servers compatible", () => {
  const profile = { id: "self", name: "나", status: "", character: "chiikawa" };
  const state = {
    self: profile,
    friends: [
      { ...profile, id: "friend", online: true },
      { ...profile, id: "other", online: true },
    ],
  };
  assert.equal(parseSidebarState(state).attacks, undefined);
  assert.deepEqual(
    parseSidebarState({ ...state, attacks: [event(1)] }).attacks,
    [event(1)],
  );
  for (const attacks of [
    [event(1), event(1)],
    [event(2), event(1)],
    [{ ...event(1), attackerId: "missing" }],
    [{ ...event(1), attackerId: "other" }],
    [{ ...event(1), id: -1 }],
    [{ ...event(1), sentAt: NaN }],
  ])
    assert.throws(() => parseSidebarState({ ...state, attacks }));
  assert.throws(() => parseAttackEvent({ ...event(1), targetId: "self" }));
  const blocked = applyBlockingSettings(
    parseSidebarState({ ...state, attacks: [event(1)] }),
    {
      revision: 1,
      profiles: [{ id: "friend", name: "친구", character: "chiikawa" }],
    },
  );
  assert.deepEqual(blocked.attacks, []);
});

test("out-of-order polls play each incoming attack once", () => {
  const inbox = createAttackInbox("friend");
  collectAttacks(inbox, [event(2)], online, true, 0);
  collectAttacks(inbox, [event(1), event(2)], online, true, 100);
  assert.equal(nextAttack(inbox, 100)?.id, 2);
  assert.equal(nextAttack(inbox, 100)?.id, 1);
  collectAttacks(inbox, [event(1), event(2)], online, true, 200);
  assert.equal(nextAttack(inbox, 200), undefined);
});

test("server echoes never replay a locally animated attack, including delayed or lost acknowledgements", () => {
  const inbox = createAttackInbox("self");
  const incoming = { ...event(2), attackerId: "friend", targetId: "self" };
  collectAttacks(inbox, [event(1)], online, true, 0);
  assert.equal(nextAttack(inbox, 0), undefined);
  collectAttacks(inbox, [event(1), incoming, event(3)], online, true, 100);
  assert.deepEqual(nextAttack(inbox, 100), incoming);
  assert.equal(nextAttack(inbox, 100), undefined);
  collectAttacks(inbox, [event(1), incoming, event(3)], online, true, 200);
  assert.equal(nextAttack(inbox, 200), undefined);

  const remounted = createAttackInbox("self");
  collectAttacks(remounted, [event(1), event(3)], online, true, 300);
  assert.equal(nextAttack(remounted, 300), undefined);
});

test("hidden, paused, disconnected and unavailable participants never replay an old attack on resuming", () => {
  for (const enabled of [false, true]) {
    const inbox = createAttackInbox("friend");
    collectAttacks(
      inbox,
      [event(1)],
      enabled ? new Set(["self"]) : online,
      enabled,
      0,
    );
    collectAttacks(inbox, [event(1)], online, true, 200);
    assert.equal(nextAttack(inbox, 200), undefined);
  }
  const inbox = createAttackInbox("friend");
  collectAttacks(inbox, [event(1)], online, true, 0);
  collectAttacks(inbox, [event(1)], online, false, 50);
  collectAttacks(inbox, [event(1)], online, true, 100);
  assert.equal(nextAttack(inbox, 100), undefined);
});

test("queued attacks expire and the queue and deduplication memory stay bounded", () => {
  const inbox = createAttackInbox("friend");
  collectAttacks(inbox, [event(1)], online, true, 0);
  assert.equal(nextAttack(inbox, ATTACK_TTL_MS), undefined);
  collectAttacks(
    inbox,
    Array.from({ length: 300 }, (_, index) => event(index + 2)),
    online,
    true,
    0,
  );
  assert.equal(inbox.queue.length, 8);
  assert.equal(inbox.seen.size, 256);
  assert.equal(
    createAttackInbox("other").seen.size,
    0,
    "a different profile has an independent stream",
  );
});
