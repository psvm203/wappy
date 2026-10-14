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
    <p
      className="
        chat-bubble m-[6px_0_0] p-[7px_9px] rounded-[10px_10px_10px_2px] bg-[#e6efda] text-[#35462d]
        text-[12px] leading-[1.45] whitespace-pre-wrap wrap-anywhere line-clamp-3
      "
      title={message.text}
    >
      {message.text}
    </p>
  );
}
