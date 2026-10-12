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
      <label className="field">
        방 초대 코드
        <textarea
          required
          rows={1}
          maxLength={2048}
          autoCapitalize="none"
          autoComplete="off"
          spellCheck={false}
          placeholder="5자리 코드 (예: A7K3M)"
          value={value}
          disabled={busy}
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
      {destination && destination !== WAPPY_SERVER && (
        <p className="hint invitation-destination" role="status">
          초대받은 서버: <strong>{destination}</strong>
        </p>
      )}
      <button
        type="button"
        className="secondary"
        disabled={busy || current?.loading || !value.trim()}
        onClick={() => void check()}
      >
        {current?.loading ? "초대 확인 중…" : "초대장 미리 확인하기"}
      </button>
      {current?.error && (
        <p className="error" role="alert">
          {current.error}
        </p>
      )}
      {current?.preview && (
        <div className="invitation-preview" role="status">
          <Character kind={current.preview.character} />
          <div>
            <strong>{current.preview.name} 님이 보낸 방 초대예요.</strong>
            <p className="hint">인원과 기간 제한 없이 사용할 수 있어요.</p>
            <p className="hint">
              참여하면 같은 방의 친구들을 모두 만날 수 있어요.
            </p>
            <p className="hint">아직 방에 참여하지 않았어요.</p>
          </div>
        </div>
      )}
      {onVerified && !current?.preview && (
        <p className="hint">
          초대장을 먼저 확인한 뒤 내 이름과 캐릭터로 시작해 주세요.
        </p>
      )}
    </>
  );
}
