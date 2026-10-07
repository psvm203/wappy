import assert from "node:assert/strict";
import test from "node:test";
import type { Friend } from "@wappy/api";
import { filterFriends } from "../src/friend-filter.ts";

test("friend search combines literal words and live filters without changing shared state", () => {
  const friends: Friend[] = [
    {
      id: "one",
      name: "Ａlice",
      status: "책 읽는 중",
      character: "cat",
      online: false,
      wave: { id: "older", sentAt: 1 },
    },
    {
      id: "two",
      name: "가을",
      status: "Coffee time",
      character: "bunny",
      online: true,
    },
    {
      id: "three",
      name: "[Bob]",
      status: "함께 .*",
      character: "frog",
      online: true,
      wave: { id: "newer", sentAt: 2 },
    },
  ];
  const original = structuredClone(friends);
  const ids = (result: Friend[]) => result.map((friend) => friend.id);
  assert.deepEqual(ids(filterFriends(friends, "  책\nALICE ", "all", true)), [
    "one",
  ]);
  assert.deepEqual(
    ids(filterFriends(friends, "가을".normalize("NFD"), "all", true)),
    ["two"],
  );
  assert.deepEqual(ids(filterFriends(friends, "COFFEE", "online", true)), [
    "two",
  ]);
  assert.deepEqual(ids(filterFriends(friends, ".* [", "all", true)), ["three"]);
  assert.deepEqual(
    ids(filterFriends(friends, "one", "all", true)),
    [],
    "IDs are not searchable profile text",
  );
  assert.deepEqual(ids(filterFriends(friends, "alice", "online", true)), []);
  assert.deepEqual(ids(filterFriends(friends, "", "waves", true)), [
    "three",
    "one",
  ]);
  assert.deepEqual(ids(filterFriends(friends, "책", "waves", false)), ["one"]);
  assert.deepEqual(
    filterFriends(friends, "", "online", false),
    [],
    "stale online flags are not proof of current presence",
  );
  assert.deepEqual(ids(filterFriends(friends, " \t", "all", true)), [
    "two",
    "three",
    "one",
  ]);
  assert.deepEqual(ids(filterFriends(friends, "", "all", false)), [
    "one",
    "two",
    "three",
  ]);
  assert.deepEqual(filterFriends([], "", "all", true), []);
  assert.deepEqual(
    friends,
    original,
    "filtering must not reorder shared friends or consume waves",
  );
  assert.equal(filterFriends(friends, "alice", "all", true)[0], friends[0]);
});
