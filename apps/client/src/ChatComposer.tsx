import { useEffect, useRef, useState, type FormEvent } from "react";
import { MAX_CHAT_LENGTH, parseChatText } from "@wappy/api";
import "./ChatComposer.css";

export function ChatComposer({
  connected,
  onSend,
  onClose,
}: {
  connected: boolean;
  onSend: (text: string) => Promise<unknown>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLTextAreaElement>(null);
  const sending = useRef(false);
  const connectionError = connected ? "" : "서버에 연결되면 보낼 수 있어요.";

  useEffect(() => {
    input.current?.setCustomValidity(error || connectionError);
    if (error && !busy) input.current?.reportValidity();
  }, [error, busy, connectionError]);

  useEffect(() => {
    const cancel = () => {
      if (!sending.current) onClose();
    };
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

  async function send(event: FormEvent) {
    event.preventDefault();
    if (sending.current || !connected) return;
    try {
      const text = parseChatText(draft);
      sending.current = true;
      setBusy(true);
      setError("");
      await onSend(text);
      setDraft("");
      onClose();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "메시지를 보내지 못했어요.",
      );
      input.current?.focus();
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  return (
    <form
      className="chat-composer"
      aria-label="친구 모두에게 메시지 보내기"
      aria-busy={busy}
      onSubmit={(event) => void send(event)}
      onKeyDown={(event) => {
        if (event.key === "Escape" && !event.nativeEvent.isComposing) {
          event.stopPropagation();
          if (!sending.current) onClose();
        }
      }}
    >
      <textarea
        ref={input}
        autoFocus
        aria-label="친구 모두에게 메시지"
        aria-description="Enter로 전송, Shift+Enter로 줄바꿈, Escape로 닫기"
        aria-invalid={!!error}
        placeholder={connectionError || "친구들에게 한마디"}
        rows={2}
        maxLength={MAX_CHAT_LENGTH}
        value={draft}
        readOnly={busy}
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
            if (sending.current) return;
            if (!event.currentTarget.value.trim()) onClose();
            else event.currentTarget.form?.requestSubmit();
          }
        }}
      />
    </form>
  );
}
