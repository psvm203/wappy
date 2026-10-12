import type { ChatMessage, Friend } from "@wappy/api";
import { Character } from "./Character";
import { ChatBubble } from "./ChatBubble";

type Confirmation = "remove" | "block" | null;

export function FriendCard({
  friend,
  connected,
  message,
  busy,
  blockingSupported,
  confirmation,
  onConfirmationChange,
  onRemove,
  onBlock,
}: {
  friend: Friend;
  connected: boolean;
  message?: ChatMessage;
  busy: boolean;
  blockingSupported: boolean;
  confirmation: Confirmation;
  onConfirmationChange: (confirmation: Confirmation) => void;
  onRemove: () => void;
  onBlock: () => void;
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
        <button
          type="button"
          className="text-button danger"
          id={`block-friend-${friend.id}`}
          aria-label={`${friend.name} 님 차단하기`}
          disabled={busy || !connected || !blockingSupported}
          onClick={() => onConfirmationChange("block")}
        >
          차단하기
        </button>
      </div>
      <button
        className="remove-button"
        aria-label={`${friend.name} 친구 연결 해제`}
        title="친구 연결 해제"
        onClick={() =>
          onConfirmationChange(confirmation === "remove" ? null : "remove")
        }
      >
        ×
      </button>
      {confirmation === "remove" && (
        <div className="remove-confirm">
          <p>{friend.name} 님과 연결을 해제할까요?</p>
          <button
            className="text-button"
            onClick={() => onConfirmationChange(null)}
          >
            취소
          </button>
          <button
            className="text-button danger"
            disabled={busy}
            onClick={onRemove}
          >
            연결 해제
          </button>
        </div>
      )}
      {confirmation === "block" && (
        <div
          className="block-confirm"
          role="group"
          aria-label={`${friend.name} 님 차단 확인`}
        >
          <p>
            <strong>{friend.name} 님을 차단할까요?</strong>
          </p>
          <p>
            친구 연결을 삭제하고, 초대로 다시 연결되는 것도 막아요. 차단 해제는
            내 모습에서 할 수 있어요.
          </p>
          <div>
            <button
              type="button"
              className="text-button"
              disabled={busy}
              autoFocus
              onClick={() => {
                onConfirmationChange(null);
                document.getElementById(`block-friend-${friend.id}`)?.focus();
              }}
            >
              취소
            </button>
            <button
              type="button"
              className="text-button danger"
              disabled={busy || !connected}
              onClick={() => {
                document.getElementById("sidebar-tab-friends")?.focus();
                onBlock();
              }}
            >
              친구 차단
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
