import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CHAT_BUBBLE_MS,
  CHAT_HISTORY_LIMIT,
  MAX_CHAT_LENGTH,
  parseChatMessage,
  parseChatText,
  parseSidebarState,
} from "@wappy/api";
import { latestChat, movedForDrag } from "../src/chat.ts";

test("chat validates text, audience, ordering and history bounds at the server boundary", () => {
  const self = { id: "alice", name: "Alice", character: "cat", status: "" };
  const friend = { ...self, id: "bob", online: false };
  const message = {
    id: 1,
    senderId: friend.id,
    text: "안녕!\n같이 놀자",
    sentAt: 1_800_000_000_000,
  };
  assert.equal(parseChatText("  안녕\r\n반가워  "), "안녕\n반가워");
  assert.equal(
    parseChatText("<script>alert(1)</script>"),
    "<script>alert(1)</script>",
  );
  assert.deepEqual(parseChatMessage({ ...message, token: "discard" }), message);
  assert.deepEqual(
    parseSidebarState({ self, friends: [friend], messages: [message] })
      .messages,
    [message],
  );
  for (const text of [
    null,
    {},
    42,
    "",
    " \n ",
    "x".repeat(MAX_CHAT_LENGTH + 1),
    "hello\u0000",
    "hello\tworld",
  ])
    assert.throws(() => parseChatText(text));
  for (const messages of [
    null,
    {},
    [{ ...message, senderId: "stranger" }],
    [message, message],
    [{ ...message, id: 2 }, message],
    [{ ...message, id: -1 }],
    [{ ...message, sentAt: NaN }],
    Array.from({ length: CHAT_HISTORY_LIMIT + 1 }, (_, index) => ({
      ...message,
      id: index + 1,
    })),
  ])
    assert.throws(() =>
      parseSidebarState({ self, friends: [friend], messages }),
    );
  assert.equal(parseSidebarState({ self, friends: [] }).messages, undefined);
});

test("bubbles show the latest message per sender for one minute; clicking is distinct from dragging", () => {
  const now = 1_800_000_000_000;
  const first = { id: 1, senderId: "alice", text: "처음", sentAt: now };
  const second = { ...first, id: 2, text: "다음", sentAt: now + 1000 };
  const other = { ...first, id: 3, senderId: "bob", sentAt: now + 2000 };
  assert.equal(latestChat([first, second, other], "alice", now + 2000), second);
  assert.equal(latestChat([first, second, other], "bob", now + 2000), other);
  assert.equal(latestChat([first], "alice", now + CHAT_BUBBLE_MS), undefined);
  assert.equal(latestChat(undefined, "alice", now), undefined);
  assert.equal(movedForDrag(100, 100, 103, 102), false);
  assert.equal(movedForDrag(100, 100, 110, 100), true);
});
