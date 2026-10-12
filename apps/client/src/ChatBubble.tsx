import { useEffect, useState } from "react";
import { CHAT_BUBBLE_MS, type ChatMessage } from "@wappy/api";

export function ChatBubble({ message }: { message?: ChatMessage }) {
  const [expired, setExpired] = useState<number | null>(null);
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(
      () => setExpired(message.id),
      CHAT_BUBBLE_MS,
    );
    return () => window.clearTimeout(timer);
  }, [message?.id]);
  if (!message || message.id === expired) return null;
  return (
    <p className="chat-bubble" title={message.text}>
      {message.text}
    </p>
  );
}
