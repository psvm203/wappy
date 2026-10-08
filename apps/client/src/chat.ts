import { CHAT_BUBBLE_MS, type ChatMessage } from "@wappy/api";

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
