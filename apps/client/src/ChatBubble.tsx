import { useEffect, useState } from "react";
import { CHAT_BUBBLE_MS, type ChatMessage } from "@wappy/api";

export function ChatBubble({ message }: { message?: ChatMessage }) {
  const [expired, setExpired] = useState<number | null>(null);
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(
      () => setExpired(message.id),
      Math.max(0, message.sentAt + CHAT_BUBBLE_MS - Date.now()),
    );
    return () => window.clearTimeout(timer);
  }, [message?.id, message?.sentAt]);
  if (
    !message ||
    message.id === expired ||
    message.sentAt + CHAT_BUBBLE_MS <= Date.now()
  )
    return null;
  return (
    <p className="chat-bubble" title={message.text}>
      {message.text}
    </p>
  );
}
