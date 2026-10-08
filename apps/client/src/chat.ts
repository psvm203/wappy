import { CHAT_BUBBLE_MS, type ChatMessage } from "@wappy/api";

export function latestChat(
  messages: readonly ChatMessage[] | undefined,
  senderId: string,
  now = Date.now(),
) {
  return messages
    ?.slice()
    .reverse()
    .find(
      (message) =>
        message.senderId === senderId && message.sentAt + CHAT_BUBBLE_MS > now,
    );
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
