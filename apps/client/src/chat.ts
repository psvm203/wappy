import {
  CHAT_BUBBLE_MS,
  type ChatMessage,
  type SidebarState,
} from "@wappy/api";

export function unreadChatByConversation(state: SidebarState | null) {
  const unread = new Set(state?.unreadChatIds);
  const conversations = new Map<string | null, number[]>();
  for (const message of state?.messages ?? []) {
    if (!unread.has(message.id) || message.senderId === state?.self.id)
      continue;
    const recipient = message.recipientId ? message.senderId : null;
    const ids = conversations.get(recipient) ?? [];
    ids.push(message.id);
    conversations.set(recipient, ids);
  }
  return conversations;
}

/** A delayed poll must not restore a received message already confirmed as read. */
export function reconcileChatReads(
  current: SidebarState | null,
  incoming: SidebarState,
): SidebarState {
  if (
    current?.self.id !== incoming.self.id ||
    !current.unreadChatIds ||
    !incoming.unreadChatIds
  )
    return incoming;
  const unread = new Set(current.unreadChatIds);
  const read = new Set(
    current.messages
      ?.filter((message) => !unread.has(message.id))
      .map((message) => message.id),
  );
  return {
    ...incoming,
    unreadChatIds: incoming.unreadChatIds.filter((id) => !read.has(id)),
  };
}

export function conversationMessages(
  messages: readonly ChatMessage[] | undefined,
  selfId: string,
  friendId: string | null,
) {
  return (messages ?? []).filter((message) =>
    friendId === null
      ? message.recipientId === undefined
      : (message.senderId === selfId && message.recipientId === friendId) ||
        (message.senderId === friendId && message.recipientId === selfId),
  );
}

export function chatBubbleText(message: ChatMessage) {
  return message.recipientId
    ? "🔒 1:1 메시지 · 채팅에서 확인해요"
    : message.text;
}

export function latestChat(
  messages: readonly ChatMessage[] | undefined,
  senderId: string,
  now = Date.now(),
) {
  for (let i = (messages?.length ?? 0) - 1; i >= 0; i--) {
    const message = messages![i];
    if (message.senderId === senderId && message.sentAt + CHAT_BUBBLE_MS > now)
      return message;
  }
}

export const CHAT_CLICK_SLOP = 6;
export function movedForDrag(
  startX: number,
  startY: number,
  x: number,
  y: number,
) {
  return Math.hypot(x - startX, y - startY) > CHAT_CLICK_SLOP;
}
