import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  CHAT_BUBBLE_MS,
  MAX_CHAT_LENGTH,
  type ChatMessage,
  type SidebarState,
} from "@wappy/api";
import { errorMessage, type SavedSession } from "./api";
import { MessageReport, ChatReportHistory } from "./ChatReports";
import { Character } from "./Character";
import {
  chatBubbleText,
  conversationMessages,
  unreadChatByConversation,
} from "./chat";

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
    <p className="chat-bubble" title={chatBubbleText(message)}>
      {chatBubbleText(message)}
    </p>
  );
}

export function ChatPanel({
  session,
  state,
  connected,
  focusRequest,
  active,
  recipientId,
  onRecipientChange,
  onSend,
  onRead,
}: {
  session: SavedSession;
  state: SidebarState;
  connected: boolean;
  focusRequest: number;
  active: boolean;
  recipientId: string | null;
  onRecipientChange: (id: string | null) => void;
  onSend: (text: string, recipientId: string | null) => Promise<void>;
  onRead: (messageIds: number[]) => Promise<void>;
}) {
  const [drafts, setDrafts] = useState(() => new Map<string, string>());
  const conversation = recipientId ?? "";
  const draft = drafts.get(conversation) ?? "";
  const [busy, setBusy] = useState<"send" | "read" | null>(null);
  const pending = useRef(false);
  const [error, setError] = useState<{
    conversation: string;
    text: string;
  } | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const list = useRef<HTMLOListElement>(null);
  const atBottom = useRef(true);
  const recipient = state.friends.find((friend) => friend.id === recipientId);
  const supported =
    state.messages !== undefined &&
    (recipientId === null || state.directChat === true);
  const available = recipientId === null || !!recipient;
  const messages = conversationMessages(
    state.messages,
    state.self.id,
    recipientId,
  );
  const unreadChats = unreadChatByConversation(state);
  const unreadIds = unreadChats.get(recipientId) ?? [];
  const lastId = messages[messages.length - 1]?.id;
  useEffect(() => {
    if (active) input.current?.focus();
  }, [focusRequest, active]);
  useEffect(() => {
    atBottom.current = true;
    if (list.current) list.current.scrollTop = list.current.scrollHeight;
  }, [recipientId, active]);
  useEffect(() => {
    if (list.current && atBottom.current)
      list.current.scrollTop = list.current.scrollHeight;
  }, [lastId]);

  async function send(event: FormEvent) {
    event.preventDefault();
    if (
      pending.current ||
      !connected ||
      !supported ||
      !available ||
      !draft.trim()
    )
      return;
    pending.current = true;
    setBusy("send");
    setError(null);
    try {
      await onSend(draft, recipientId);
      setDrafts((current) => new Map(current).set(conversation, ""));
      atBottom.current = true;
      if (list.current) list.current.scrollTop = list.current.scrollHeight;
    } catch (cause) {
      setError({ conversation, text: errorMessage(cause) });
    } finally {
      pending.current = false;
      setBusy(null);
      requestAnimationFrame(() => {
        if (input.current?.getClientRects().length) input.current.focus();
      });
    }
  }

  async function confirmRead() {
    if (pending.current || !connected || !unreadIds.length) return;
    pending.current = true;
    setBusy("read");
    setError(null);
    // The confirmation button disappears on success; move keyboard focus now.
    input.current?.focus();
    try {
      await onRead(unreadIds);
    } catch (cause) {
      setError({ conversation, text: errorMessage(cause) });
    } finally {
      pending.current = false;
      setBusy(null);
    }
  }

  const profiles = [state.self, ...state.friends];
  return (
    <section className="chat-panel" aria-label="친구들과 채팅">
      <div className="section-heading">
        <h1>{recipientId === null ? "함께 이야기해요" : "둘이 이야기해요"}</h1>
      </div>
      {unreadChats.size > 0 && (
        <div
          className="chat-unread-list"
          role="group"
          aria-label="새 메시지가 있는 대화"
        >
          {[...unreadChats].map(([id, ids]) => (
            <button
              key={id === null ? "broadcast" : `direct:${id}`}
              type="button"
              className="secondary"
              onClick={() => onRecipientChange(id)}
              disabled={!!busy}
              aria-pressed={recipientId === id}
            >
              {id === null
                ? "모든 친구에게"
                : `${state.friends.find((friend) => friend.id === id)?.name ?? "친구"} 님과 1:1`}
              <span
                className="wave-count"
                aria-label={`새 메시지 ${ids.length}개`}
              >
                {ids.length}
              </span>
            </button>
          ))}
        </div>
      )}
      <div className="field chat-recipient">
        <label htmlFor="chat-recipient">받는 사람</label>
        <select
          id="chat-recipient"
          value={conversation}
          onChange={(event) => onRecipientChange(event.target.value || null)}
          disabled={!!busy}
        >
          <option value="">모든 친구에게</option>
          {recipientId !== null && !recipient && (
            <option value={recipientId}>연결이 해제된 친구</option>
          )}
          {state.friends.map((friend) => (
            <option key={friend.id} value={friend.id}>
              {friend.name} 님에게만 · 1:1
            </option>
          ))}
        </select>
      </div>
      <p className="chat-audience">
        {recipientId === null
          ? "보내는 순간 연결된 모든 친구에게 보여요."
          : recipient
            ? `${recipient.name} 님과 나만 이 대화를 볼 수 있어요.`
            : "친구 연결이 해제되어 이 대화를 보낼 수 없어요."}
      </p>
      <p className="hint">
        {recipientId === null
          ? "말풍선은 1분간 표시해요. "
          : "1:1 내용은 바탕화면 말풍선에 표시하지 않아요. "}
        전체 채팅 중 최근 24시간의 50개까지 보관해요.
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
        {messages.map((message) => {
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
                    {unreadIds.includes(message.id) && (
                      <span className="chat-new">새 메시지</span>
                    )}
                  </strong>
                  <time dateTime={new Date(message.sentAt).toISOString()}>
                    {new Date(message.sentAt).toLocaleTimeString("ko-KR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </header>
                <p>{message.text}</p>
                {sender.id !== state.self.id && (
                  <MessageReport
                    session={session}
                    messageId={message.id}
                    text={message.text}
                    senderName={sender.name}
                    disabled={!connected || state.chatReporting !== true}
                  />
                )}
              </div>
            </li>
          );
        })}
      </ol>
      {state.chatReporting !== true && (
        <p className="hint">
          이 서버는 현재 새 메시지 신고를 받지 않아요. 불편한 친구는 친구들
          탭에서 차단할 수 있어요.
        </p>
      )}
      {unreadIds.length > 0 && (
        <div className="chat-read-control">
          <p className="hint">
            확인하면 이 대화의 새 메시지 표시만 지워져요. 상대에게 읽음 여부를
            보내지 않아요.
          </p>
          <button
            type="button"
            className="secondary"
            disabled={!!busy || !connected}
            onClick={() => void confirmRead()}
          >
            {busy === "read"
              ? "확인 중…"
              : `이 대화의 새 메시지 ${unreadIds.length}개 확인`}
          </button>
        </div>
      )}
      {supported && available && !messages.length && (
        <p className="hint">아직 대화가 없어요. 먼저 말을 걸어 보세요.</p>
      )}
      {!supported && (
        <p className="hint">
          이 서버는 {recipientId === null ? "채팅" : "1:1 채팅"}을 지원하지
          않아요. 서버를 업데이트해 주세요.
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
          {recipientId === null
            ? "친구들에게 한마디"
            : `${recipient?.name ?? "연결이 해제된 친구"} 님에게 한마디`}
          <textarea
            ref={input}
            rows={3}
            maxLength={MAX_CHAT_LENGTH}
            value={draft}
            disabled={busy === "send" || !supported || !available}
            placeholder="무슨 이야기를 나눌까요?"
            onChange={(event) => {
              const text = event.target.value;
              setDrafts((current) => new Map(current).set(conversation, text));
            }}
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
          disabled={
            !!busy || !connected || !supported || !available || !draft.trim()
          }
        >
          {busy === "send"
            ? "보내는 중…"
            : recipientId === null
              ? "친구들에게 보내기"
              : `${recipient?.name ?? "친구"} 님에게만 보내기`}
        </button>
      </form>
      {error?.conversation === conversation && (
        <p className="error" role="alert">
          {error.text}
        </p>
      )}
      {state.chatReporting !== undefined && (
        <ChatReportHistory session={session} connected={connected} />
      )}
    </section>
  );
}
