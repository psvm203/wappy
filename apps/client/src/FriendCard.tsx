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
      className={`
        friend-card flex items-center min-h-[82px] bg-[#f1f1ea] rounded-[15px] p-[8px_11px_8px_4px]
        relative border border-solid border-[#e7e9df] gap-[7px] flex-wrap
        [&:focus]:[outline:2px_solid_#60764e] [&:focus]:outline-offset-2 [&.is-online]:bg-[#f4f6ec]
        [&:nth-child(2n)_.character-body]:[animation-delay:-1.5s]
      ${online ? "is-online" : ""}`}
    >
      <div
        className="
          friend-scene w-[54px] shrink-0 relative [&_.character]:w-[54px] [&_.character]:relative
          [&_.character]:z-1
        "
      >
        <Character kind={friend.character} asleep={!online} />
        <div className="scene-floor absolute bottom-[4px] w-[46px] h-[16px] left-[4px] rounded-[50%] bg-[#e3e8d6]" />
      </div>
      <div
        className="
          friend-info flex-1 min-w-0 [&_p:not(.chat-bubble)]:text-[11px]
          [&_p:not(.chat-bubble)]:leading-[1.6] [&_p:not(.chat-bubble)]:text-[#777e6e]
          [&_p:not(.chat-bubble)]:m-[7px_0] [&_p:not(.chat-bubble)]:wrap-anywhere
          [&_small]:text-[#68745e] [&_small]:text-[9px]
        "
      >
        <div className="friend-name flex items-center gap-[8px] [&_strong]:text-[13px] [&_strong]:wrap-anywhere">
          <strong>{friend.name}</strong>
          <span
            className={`online-dot inline-block w-[6px] h-[6px] rounded-[50%] bg-[#71a46b] shrink-0 [&.offline]:bg-[#b6b9b0] ${!online ? "offline" : ""}`}
          />
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
          className="
            remove-button absolute top-[5px] right-[7px] p-[1px_4px] bg-transparent text-[#9ba58f]
            text-[15px]
          "
          aria-label={`${friend.name} 님 추방`}
          title="추방"
          onClick={() => onRemovingChange(!removing)}
        >
          ×
        </button>
      )}
      {canKick && removing && (
        <div
          className="
            remove-confirm w-full border-t [border-top-style:solid] border-t-[#dfe3d4] p-[9px_8px_3px]
            text-right [&_p:not(.chat-bubble)]:text-[11px] [&_p:not(.chat-bubble)]:text-left
            [&_button]:ml-[14px]
          "
        >
          <p>{friend.name} 님을 추방할까요?</p>
          <button
            className="text-button bg-transparent text-[11px] p-[3px_0] text-[#68745e] [&:hover]:text-[#41562e]"
            onClick={() => onRemovingChange(false)}
          >
            취소
          </button>
          <button
            className="
              text-button danger bg-transparent text-[11px] p-[3px_0] [&:hover]:text-[#41562e]
              text-[#ab5555]
            "
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
