import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CHAT_BUBBLE_MS,
  CHAT_HISTORY_LIMIT,
  MAX_CHAT_LENGTH,
  parseChatMessage,
  parseChatMessageIds,
  parseChatText,
  parseSidebarState,
  type SidebarState,
} from "@wappy/api";
import {
  chatBubbleText,
  conversationMessages,
  latestChat,
  movedForDrag,
  reconcileChatReads,
  unreadChatByConversation,
} from "../src/chat.ts";

test("unread messages belong to the viewer, group by conversation, and never reappear after a delayed poll", () => {
  const self = {
    id: "alice",
    name: "Alice",
    character: "hachiware" as const,
    status: "",
  };
  const bob = { ...self, id: "bob", online: true };
  const carol = { ...bob, id: "carol" };
  const broadcast = {
    id: 1,
    senderId: bob.id,
    text: "모두 안녕",
    sentAt: 1_800_000_000_000,
  };
  const direct = { ...broadcast, id: 2, recipientId: self.id };
  const other = { ...direct, id: 3, senderId: carol.id };
  const own = { ...broadcast, id: 4, senderId: self.id };
  const before: SidebarState = {
    self,
    friends: [bob, carol],
    messages: [broadcast, direct, other, own],
    unreadChatIds: [1, 2, 3],
  };
  assert.deepEqual(parseSidebarState(before), before);
  assert.deepEqual(
    [...unreadChatByConversation(before)],
    [
      [null, [1]],
      [bob.id, [2]],
      [carol.id, [3]],
    ],
  );
  assert.equal(unreadChatByConversation(null).size, 0);
  const confirmed = { ...before, unreadChatIds: [1, 3] };
  const nextMessage = { ...direct, id: 5 };
  const delayed = {
    ...before,
    messages: [...before.messages!, nextMessage],
    unreadChatIds: [1, 2, 3, 5],
  };
  assert.deepEqual(
    reconcileChatReads(confirmed, delayed).unreadChatIds,
    [1, 3, 5],
  );
  assert.deepEqual(confirmed.unreadChatIds, [1, 3]);
  assert.deepEqual(
    reconcileChatReads(before, { ...before, unreadChatIds: [] }).unreadChatIds,
    [],
  );
  assert.equal(reconcileChatReads(null, before), before);
  const different = { ...before, self: bob };
  assert.equal(reconcileChatReads(confirmed, different), different);
  const legacy = { ...before, unreadChatIds: undefined };
  assert.equal(reconcileChatReads(confirmed, legacy), legacy);
  assert.equal(reconcileChatReads(legacy, before), before);
  for (const unreadChatIds of [
    null,
    "1",
    ["1"],
    [-1],
    [0],
    [1.5],
    [NaN],
    [Infinity],
    [Number.MAX_SAFE_INTEGER + 1],
    [1, 1],
    [4],
    [99],
    Array.from({ length: CHAT_HISTORY_LIMIT + 1 }, (_, index) => index + 1),
  ])
    assert.throws(() => parseSidebarState({ ...before, unreadChatIds }));
  assert.throws(() =>
    parseSidebarState({ self, friends: [], unreadChatIds: [] }),
  );
  assert.deepEqual(parseChatMessageIds([]), []);
  assert.deepEqual(parseChatMessageIds([2, 1]), [2, 1]);
  assert.deepEqual(
    parseSidebarState({ self, friends: [], messages: [], unreadChatIds: [] })
      .unreadChatIds,
    [],
  );
});

test("private conversations keep their audience and never expose contents in character bubbles", () => {
  const self = {
    id: "alice",
    name: "Alice",
    character: "hachiware",
    status: "",
  };
  const bob = { ...self, id: "bob", online: false };
  const carol = { ...bob, id: "carol" };
  const broadcast = {
    id: 1,
    senderId: "bob",
    text: "모두 안녕",
    sentAt: 1_800_000_000_000,
  };
  const incoming = {
    ...broadcast,
    id: 2,
    recipientId: "alice",
    text: "둘만의 이야기",
  };
  const outgoing = {
    ...incoming,
    id: 3,
    senderId: "alice",
    recipientId: "bob",
  };
  const other = { ...outgoing, id: 4, recipientId: "carol" };
  const messages = [broadcast, incoming, outgoing, other];
  assert.deepEqual(
    parseSidebarState({
      self,
      friends: [bob, carol],
      messages,
      directChat: true,
    }).messages,
    messages,
  );
  assert.deepEqual(conversationMessages(messages, self.id, null), [broadcast]);
  assert.deepEqual(conversationMessages(messages, self.id, "bob"), [
    incoming,
    outgoing,
  ]);
  assert.deepEqual(conversationMessages(messages, self.id, "carol"), [other]);
  assert.deepEqual(conversationMessages(undefined, self.id, "bob"), []);
  assert.equal(chatBubbleText(broadcast), broadcast.text);
  assert.equal(chatBubbleText(incoming).includes(incoming.text), false);
  assert.match(chatBubbleText(incoming), /1:1/);
  for (const recipientId of [
    null,
    "",
    12,
    "bob",
    "stranger",
    "carol",
    "x".repeat(129),
  ])
    assert.throws(() =>
      parseSidebarState({
        self,
        friends: [bob, carol],
        messages: [{ ...incoming, recipientId }],
      }),
    );
  assert.throws(() =>
    parseSidebarState({ self, friends: [bob], directChat: "true" }),
  );
  assert.equal(
    parseSidebarState({ self, friends: [bob] }).directChat,
    undefined,
  );
});

test("chat validates text, audience, ordering and history bounds at the server boundary", () => {
  const self = {
    id: "alice",
    name: "Alice",
    character: "hachiware",
    status: "",
  };
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
