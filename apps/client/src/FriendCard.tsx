import type { ChatMessage, Friend } from "@wappy/api";
import type { ReactNode } from "react";
import { Character } from "./Character";
import { ChatBubble } from "./ChatBubble";

export function FriendCard({
  friend,
  connected,
  message,
  busy,
  canKick,
  removing,
  onRemovingChange,
  onRemove,
  children,
}: {
  friend: Friend;
  connected: boolean;
  message?: ChatMessage;
  busy: boolean;
  canKick: boolean;
  removing: boolean;
  onRemovingChange: (removing: boolean) => void;
  onRemove: () => void;
  children?: ReactNode;
}) {
  const online = friend.online && connected;
  return (
    <li
      id={`friend-${friend.id}`}
      tabIndex={-1}
      aria-label={`${friend.name} 님의 친구 카드`}
      className={`friend-card ${online ? "is-online" : ""}`}
    >
      <div className="friend-scene">
        <Character kind={friend.character} asleep={!online} />
        <div className="scene-floor" />
      </div>
      <div className="friend-info">
        <div className="friend-name">
          <strong>{friend.name}</strong>
          <span className={`online-dot ${!online ? "offline" : ""}`} />
        </div>
        <ChatBubble message={message} />
        <small>
          {!connected
            ? "접속 상태 확인 중"
            : friend.online
              ? "지금 함께 있어요"
              : "잠시 쉬고 있어요"}
        </small>
      </div>
      {children}
      {canKick && (
        <button
          className="remove-button"
          aria-label={`${friend.name} 님 추방`}
          title="추방"
          onClick={() => onRemovingChange(!removing)}
        >
          ×
        </button>
      )}
      {canKick && removing && (
        <div className="remove-confirm">
          <p>{friend.name} 님을 추방할까요?</p>
          <button
            className="text-button"
            onClick={() => onRemovingChange(false)}
          >
            취소
          </button>
          <button
            className="text-button danger"
            disabled={busy}
            onClick={onRemove}
          >
            추방
          </button>
        </div>
      )}
    </li>
  );
}
