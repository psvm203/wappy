import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  CHAT_BUBBLE_MS,
  MAX_CHAT_LENGTH,
  type ChatMessage,
  type SidebarState,
} from "@wappy/api";
import { errorMessage } from "./api";
import { Character } from "./Character";

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

export function ChatPanel({
  state,
  connected,
  focusRequest,
  onSend,
}: {
  state: SidebarState;
  connected: boolean;
  focusRequest: number;
  onSend: (text: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLTextAreaElement>(null);
  const list = useRef<HTMLOListElement>(null);
  const atBottom = useRef(true);
  const supported = state.messages !== undefined;
  const lastId = state.messages?.[state.messages.length - 1]?.id;
  useEffect(() => {
    input.current?.focus();
  }, [focusRequest]);
  useEffect(() => {
    if (list.current && atBottom.current)
      list.current.scrollTop = list.current.scrollHeight;
  }, [lastId]);

  async function send(event: FormEvent) {
    event.preventDefault();
    if (busy || !connected || !supported || !draft.trim()) return;
    setBusy(true);
    setError("");
    try {
      await onSend(draft);
      setDraft("");
      atBottom.current = true;
      if (list.current) list.current.scrollTop = list.current.scrollHeight;
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
      requestAnimationFrame(() => input.current?.focus());
    }
  }

  const profiles = [state.self, ...state.friends];
  return (
    <section className="chat-panel" aria-label="친구들과 채팅">
      <div className="section-heading">
        <h1>함께 이야기해요</h1>
      </div>
      <p className="hint">
        보내는 순간 연결된 모든 친구에게 보여요. 말풍선은 1분, 대화는 최근
        24시간의 50개까지 표시해요.
      </p>
      <ol
        className="chat-messages"
        aria-label="채팅 목록"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        ref={list}
        onScroll={(event) => {
          const element = event.currentTarget;
          atBottom.current =
            element.scrollHeight - element.scrollTop - element.clientHeight <
            32;
        }}
      >
        {state.messages?.map((message) => {
          const sender = profiles.find(
            (profile) => profile.id === message.senderId,
          );
          if (!sender) return null;
          return (
            <li
              key={message.id}
              className={
                message.senderId === state.self.id ? "chat-mine" : undefined
              }
            >
              <Character kind={sender.character} />
              <div>
                <header>
                  <strong>
                    {sender.name}
                    {sender.id === state.self.id ? " (나)" : ""}
                  </strong>
                  <time dateTime={new Date(message.sentAt).toISOString()}>
                    {new Date(message.sentAt).toLocaleTimeString("ko-KR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </header>
                <p>{message.text}</p>
              </div>
            </li>
          );
        })}
      </ol>
      {supported && !state.messages?.length && (
        <p className="hint">아직 대화가 없어요. 먼저 말을 걸어 보세요.</p>
      )}
      {!supported && (
        <p className="hint">
          이 서버는 채팅을 지원하지 않아요. 서버를 업데이트해 주세요.
        </p>
      )}
      {!connected && (
        <p className="hint" role="status">
          연결이 끊겨 있어요. 다시 연결되면 보낼 수 있어요.
        </p>
      )}
      {state.friends.length === 0 && (
        <p className="hint">친구를 연결하면 서로의 메시지를 볼 수 있어요.</p>
      )}
      <form onSubmit={(event) => void send(event)}>
        <label className="field">
          친구들에게 한마디
          <textarea
            ref={input}
            rows={3}
            maxLength={MAX_CHAT_LENGTH}
            value={draft}
            disabled={busy || !supported}
            placeholder="무슨 이야기를 나눌까요?"
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
        </label>
        <p className="hint">
          Enter로 전송 · Shift+Enter로 줄바꿈 · {draft.length}/{MAX_CHAT_LENGTH}
        </p>
        <button
          className="primary"
          type="submit"
          disabled={busy || !connected || !supported || !draft.trim()}
        >
          {busy ? "보내는 중…" : "친구들에게 보내기"}
        </button>
      </form>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
