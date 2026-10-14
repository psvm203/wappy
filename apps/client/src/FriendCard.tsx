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
        friend-card relative flex min-h-[82px] flex-wrap items-center gap-[7px]
        rounded-[15px] border border-solid border-[#e7e9df] bg-[#f1f1ea] p-[8px_11px_8px_4px]
        [&.is-online]:bg-[#f4f6ec] [&:focus]:[outline:2px_solid_#60764e] [&:focus]:outline-offset-2
        [&:nth-child(2n)_.character-body]:[animation-delay:-1.5s]
      ${online ? "is-online" : ""}`}
    >
      <div
        className="
          friend-scene relative w-[54px] shrink-0 [&_.character]:relative [&_.character]:z-1
          [&_.character]:w-[54px]
        "
      >
        <Character kind={friend.character} asleep={!online} />
        <div className="scene-floor absolute bottom-[4px] left-[4px] h-[16px] w-[46px] rounded-[50%] bg-[#e3e8d6]" />
      </div>
      <div
        className="
          friend-info min-w-0 flex-1 [&_p:not(.chat-bubble)]:m-[7px_0]
          [&_p:not(.chat-bubble)]:text-[11px] [&_p:not(.chat-bubble)]:leading-[1.6]
          [&_p:not(.chat-bubble)]:wrap-anywhere [&_p:not(.chat-bubble)]:text-[#777e6e]
          [&_small]:text-[9px] [&_small]:text-[#68745e]
        "
      >
        <div className="friend-name flex items-center gap-[8px] [&_strong]:text-[13px] [&_strong]:wrap-anywhere">
          <strong>{friend.name}</strong>
          <span
            className={`online-dot inline-block h-[6px] w-[6px] shrink-0 rounded-[50%] bg-[#71a46b] [&.offline]:bg-[#b6b9b0] ${!online ? "offline" : ""}`}
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
            remove-button absolute top-[5px] right-[7px] bg-transparent p-[1px_4px] text-[15px]
            text-[#9ba58f]
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
            text-right [&_button]:ml-[14px] [&_p:not(.chat-bubble)]:text-left
            [&_p:not(.chat-bubble)]:text-[11px]
          "
        >
          <p>{friend.name} 님을 추방할까요?</p>
          <button
            className="text-button bg-transparent p-[3px_0] text-[11px] text-[#68745e] [&:hover]:text-[#41562e]"
            onClick={() => onRemovingChange(false)}
          >
            취소
          </button>
          <button
            className="
              text-button danger bg-transparent p-[3px_0] text-[11px] text-[#ab5555]
              [&:hover]:text-[#41562e]
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
