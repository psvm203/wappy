import assert from "node:assert/strict";
import test from "node:test";
import type { Friend } from "@wappy/api";
import { filterFriends } from "../src/friend-filter.ts";

test("friend views filter live presence and sort without changing shared state", () => {
  const friends: Friend[] = [
    {
      id: "one",
      name: "Ａlice 책",
      character: "hachiware",
      online: false,
    },
    {
      id: "two",
      name: "가을",
      character: "usagi",
      online: true,
    },
    {
      id: "three",
      name: "[Bob] .*",
      character: "shisa",
      online: true,
    },
  ];
  const original = structuredClone(friends);
  const ids = (result: Friend[]) => result.map((friend) => friend.id);
  assert.deepEqual(ids(filterFriends(friends, "online", true)), [
    "two",
    "three",
  ]);
  assert.deepEqual(
    filterFriends(friends, "online", false),
    [],
    "stale online flags are not proof of current presence",
  );
  assert.deepEqual(ids(filterFriends(friends, "all", true)), [
    "two",
    "three",
    "one",
  ]);
  assert.deepEqual(ids(filterFriends(friends, "all", false)), [
    "one",
    "two",
    "three",
  ]);
  assert.deepEqual(filterFriends([], "all", true), []);
  assert.deepEqual(
    friends,
    original,
    "filtering must not reorder shared friends",
  );
  assert.equal(filterFriends(friends, "all", true)[0], friends[1]);
});
