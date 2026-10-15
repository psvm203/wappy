import { useEffect, useRef, useState, type FormEvent } from "react";
import { MAX_CHAT_LENGTH, parseChatText } from "@wappy/api";

export function ChatComposer({
  connected,
  initialText = "",
  initialError = "",
  onSend,
  onClose,
}: {
  connected: boolean;
  initialText?: string;
  initialError?: string;
  onSend: (text: string) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(initialText);
  const [error, setError] = useState(initialError);
  const input = useRef<HTMLTextAreaElement>(null);
  const connectionError = connected ? "" : "서버에 연결되면 보낼 수 있어요.";

  useEffect(() => {
    input.current?.setCustomValidity(error || connectionError);
    if (error) input.current?.reportValidity();
  }, [error, connectionError]);

  useEffect(() => {
    const cancel = () => onClose();
    const clickOutside = (event: MouseEvent) => {
      if (!input.current?.form?.contains(event.target as Node)) cancel();
    };
    // Let the opening click finish before listening for outside clicks.
    const timer = window.setTimeout(() => {
      document.addEventListener("click", clickOutside);
    }, 0);
    window.addEventListener("blur", cancel);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("click", clickOutside);
      window.removeEventListener("blur", cancel);
    };
  }, [onClose]);

  function send(event: FormEvent) {
    event.preventDefault();
    if (!connected) return;
    try {
      const text = parseChatText(draft);
      setError("");
      onSend(text);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "메시지를 보내지 못했어요.",
      );
      input.current?.focus();
    }
  }

  return (
    <form
      className="chat-composer pointer-events-auto m-0 w-[240px] max-w-[calc(100vw-8px)] cursor-default"
      aria-label="친구 모두에게 메시지 보내기"
      onSubmit={send}
      onKeyDown={(event) => {
        if (event.key === "Escape" && !event.nativeEvent.isComposing) {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <textarea
        className="
          m-0 block w-full resize-none rounded-[12px] border border-solid border-[#d5dfcc] bg-[#fbfbf7]
          p-[10px] text-[12px] leading-[1.5] text-[#35462d] shadow-[0_4px_16px_#23311a26] select-text
        "
        ref={input}
        autoFocus
        aria-label="친구 모두에게 메시지"
        aria-description="Enter로 전송, Shift+Enter로 줄바꿈, Escape로 닫기"
        aria-invalid={!!error}
        placeholder={connectionError || "친구들에게 한마디"}
        rows={2}
        maxLength={MAX_CHAT_LENGTH}
        value={draft}
        onChange={(event) => {
          event.target.setCustomValidity(connectionError);
          setError("");
          setDraft(event.target.value);
        }}
        onKeyDown={(event) => {
          if (
            event.key === "Enter" &&
            !event.shiftKey &&
            !event.nativeEvent.isComposing &&
            event.keyCode !== 229
          ) {
            event.preventDefault();
            if (!event.currentTarget.value.trim()) onClose();
            else {
              event.currentTarget.setCustomValidity(connectionError);
              event.currentTarget.form?.requestSubmit();
            }
          }
        }}
      />
    </form>
  );
}
