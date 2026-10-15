import { useCallback, useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@wappy/api";
import { displayedChat, type LocalChat } from "./chat";

export function useChatComposer(
  profileKey: string | null,
  senderId: string | undefined,
  serverMessage: ChatMessage | undefined,
  sendMessage: (text: string) => Promise<ChatMessage>,
) {
  const [composer, setComposer] = useState<{
    target: string;
    text: string;
    error: string;
  } | null>(null);
  const [local, setLocal] = useState<LocalChat | null>(null);
  const pending = useRef<ChatMessage | null>(null);
  const nextId = useRef(0);

  useEffect(() => {
    // oxlint-disable react/set-state-in-effect -- Drafts and local messages belong only to the active profile.
    setComposer(null);
    setLocal(null);
    // oxlint-enable react/set-state-in-effect
    return () => {
      pending.current = null;
    };
  }, [profileKey]);

  function open(target: string) {
    if (!pending.current) setComposer({ target, text: "", error: "" });
  }

  const close = useCallback(() => {
    setComposer(null);
  }, []);

  function send(text: string) {
    if (pending.current || !senderId || !composer) return;
    const message: ChatMessage = {
      id: --nextId.current,
      senderId,
      text,
      sentAt: Date.now(),
    };
    pending.current = message;
    setLocal({ message });
    close();
    void (async () => {
      try {
        const confirmed = await sendMessage(text);
        if (pending.current === message)
          setLocal({ message, confirmedId: confirmed.id });
      } catch (cause) {
        if (pending.current !== message) return;
        setLocal(null);
        setComposer({
          target: composer.target,
          text,
          error:
            cause instanceof Error
              ? cause.message
              : "메시지를 보내지 못했어요. 다시 시도해 주세요.",
        });
      } finally {
        if (pending.current === message) pending.current = null;
      }
    })();
  }

  return {
    target: composer?.target ?? null,
    initialText: composer?.text ?? "",
    initialError: composer?.error ?? "",
    message: displayedChat(serverMessage, local),
    open,
    close,
    send,
  };
}
