import type { Friend } from "@wappy/api";

export function FriendGreeting({
  friend,
  disabled,
  onSend,
  onRead,
}: {
  friend: Friend;
  disabled: boolean;
  onSend: () => void;
  onRead: () => void;
}) {
  return (
    <div className="friend-greeting">
      <button
        className="text-button wave-send"
        disabled={disabled}
        onClick={onSend}
        aria-label={`${friend.name} 님에게 인사 보내기`}
      >
        <span aria-hidden="true">👋</span> 인사 보내기
      </button>
      {friend.wave && (
        <div className="received-wave">
          <p>
            <span aria-hidden="true">👋</span> 인사를 보냈어요
            <time dateTime={new Date(friend.wave.sentAt).toISOString()}>
              {new Date(friend.wave.sentAt).toLocaleString("ko-KR", {
                month: "numeric",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </time>
          </p>
          <button
            className="text-button"
            disabled={disabled}
            onClick={onRead}
            aria-label={`${friend.name} 님의 인사 확인`}
          >
            확인
          </button>
        </div>
      )}
    </div>
  );
}
