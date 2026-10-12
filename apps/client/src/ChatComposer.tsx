import { useRef, useState, type FormEvent } from "react";
import { MAX_CHAT_LENGTH, parseChatText } from "@wappy/api";
import "./ChatComposer.css";

export function ChatComposer({
  senderName,
  connected,
  onSend,
  onClose,
}: {
  senderName: string;
  connected: boolean;
  onSend: (text: string) => Promise<unknown>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLTextAreaElement>(null);
  const sending = useRef(false);

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
      onSubmit={(event) => void send(event)}
      onKeyDown={(event) => {
        if (event.key === "Escape" && !event.nativeEvent.isComposing) {
          event.stopPropagation();
          if (!sending.current) onClose();
        }
      }}
    >
      <div className="chat-composer-heading">
        <span>{senderName} · 친구 모두에게</span>
        <button
          type="button"
          aria-label="채팅 입력창 닫기"
          disabled={busy}
          onClick={onClose}
        >
          ×
        </button>
      </div>
      <textarea
        ref={input}
        autoFocus
        aria-label="친구 모두에게 메시지"
        placeholder="친구들에게 한마디"
        rows={2}
        maxLength={MAX_CHAT_LENGTH}
        value={draft}
        readOnly={busy}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (
            event.key === "Enter" &&
            !event.shiftKey &&
            !event.nativeEvent.isComposing &&
            event.keyCode !== 229
          ) {
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
          }
        }}
      />
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!connected && <p role="status">서버에 연결되면 보낼 수 있어요.</p>}
      <div className="chat-composer-actions">
        <small>Enter 전송 · Shift+Enter 줄바꿈</small>
        <button type="submit" disabled={busy || !connected || !draft.trim()}>
          {busy ? "전송 중…" : "보내기"}
        </button>
      </div>
    </form>
  );
}
