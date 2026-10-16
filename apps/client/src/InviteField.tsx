import { useEffect, useRef, useState } from "react";
import type { InvitePreview } from "@wappy/api";
import { parseInvitation, serverUrl, WAPPY_SERVER } from "./invitations";
import { ApiError, errorMessage, previewInvitation } from "./api";
import { Character } from "./Character";

export function InviteField({
  value,
  onChange,
  server,
  busy = false,
  sameServer = false,
  onVerified,
}: {
  value: string;
  onChange: (value: string) => void;
  server: string;
  busy?: boolean;
  sameServer?: boolean;
  onVerified?: (source: string) => void;
}) {
  const source = JSON.stringify([value, server]);
  const [result, setResult] = useState<{
    source: string;
    loading?: boolean;
    preview?: InvitePreview;
    error?: string;
  } | null>(null);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), [source]);
  const current = result?.source === source ? result : null;
  async function check() {
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setResult({ source, loading: true });
    onVerified?.("");
    try {
      let received;
      let address;
      try {
        received = parseInvitation(value);
        address = received.server ?? serverUrl(server);
      } catch (cause) {
        throw new ApiError(
          400,
          cause instanceof TypeError
            ? "서버 주소를 확인해 주세요."
            : (cause as Error).message,
        );
      }
      if (sameServer && address !== server)
        throw new ApiError(
          400,
          "다른 서버의 초대장이에요. 현재 프로필과 같은 서버의 초대장을 받아 주세요.",
        );
      const preview = await previewInvitation(
        address,
        received.code,
        controller.signal,
      );
      if (controller.signal.aborted) return;
      setResult({ source, preview });
      onVerified?.(source);
    } catch (cause) {
      if (!controller.signal.aborted)
        setResult({ source, error: errorMessage(cause) });
    }
  }
  let destination = "";
  try {
    destination = parseInvitation(value).server ?? server;
  } catch {
    // Show validation errors on submit, not while pasting or typing.
  }
  return (
    <>
      <label
        className="
          field m-[15px_0] block text-[11px] text-[#68725d] [&_:is(input,select,textarea)]:mt-[8px]
          [&_:is(input,select,textarea)]:block [&_:is(input,select,textarea)]:w-full
          [&_:is(input,select,textarea)]:rounded-[9px] [&_:is(input,select,textarea)]:border
          [&_:is(input,select,textarea)]:border-solid [&_:is(input,select,textarea)]:border-[#e0e5d8]
          [&_:is(input,select,textarea)]:bg-[#f4f5ef] [&_:is(input,select,textarea)]:p-[12px]
          [&_:is(input,select,textarea)]:text-[12px] [&_:is(input,select,textarea)]:text-[#3e4935]
          [&_input::placeholder]:text-[11px] [&_input::placeholder]:text-[#68745e] [&_textarea]:resize-y
          [&_textarea]:leading-[1.6] [&_textarea]:wrap-anywhere
        "
      >
        방 초대 코드
        <textarea
          required
          rows={1}
          maxLength={2048}
          autoCapitalize="none"
          autoComplete="off"
          spellCheck={false}
          placeholder="5자리 코드 (예: F58EN)"
          value={value}
          disabled={busy}
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
      {destination && destination !== WAPPY_SERVER && (
        <p
          className="hint invitation-destination text-[10px] leading-[1.7] wrap-anywhere text-[#68745e]"
          role="status"
        >
          초대받은 서버: <strong>{destination}</strong>
        </p>
      )}
      {onVerified && (
        <button
          type="button"
          className="
            secondary w-full rounded-[10px] bg-[#e8eede] p-[13px_14px] text-[12px] font-semibold
            text-[#526a3d] [&:hover]:bg-[#dee7ce]
          "
          disabled={busy || current?.loading || !value.trim()}
          onClick={() => void check()}
        >
          {current?.loading ? "초대 확인 중…" : "초대장 확인하기"}
        </button>
      )}
      {current?.error && (
        <p
          className="
            error flex items-start gap-[5px] rounded-[9px] bg-[#f6e9df] p-[11px]
            text-[11px] leading-[1.65] wrap-anywhere text-[#9b6556] [&_button]:ml-auto [&_button]:bg-transparent
            [&_button]:p-[0_2px] [&_button]:text-inherit
          "
          role="alert"
        >
          {current.error}
        </p>
      )}
      {current?.preview && (
        <div
          className="
            invitation-preview m-[16px_0] flex items-center gap-[10px] rounded-[12px] border border-solid
            border-[#d6dfc9] bg-[#edf2e6] p-[12px] text-[12px] wrap-anywhere
            [&_.character]:w-[48px] [&_.character]:shrink-0
          "
          role="status"
        >
          <Character kind={current.preview.character} />
          <span>
            <strong>{current.preview.name}</strong> 님의 방이에요.
          </span>
        </div>
      )}
    </>
  );
}
