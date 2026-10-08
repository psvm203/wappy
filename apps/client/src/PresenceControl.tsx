import type { PresenceSettings } from "@wappy/api";

export function PresenceControl({
  setting,
  connected,
  busy,
  pending,
  unknown,
  onChange,
  onRetry,
}: {
  setting: PresenceSettings | undefined;
  connected: boolean;
  busy: boolean;
  pending: boolean;
  unknown: boolean;
  onChange: (sharing: boolean) => void;
  onRetry: () => void;
}) {
  return (
    <section className="presence-controls" aria-label="접속 공개 설정">
      <label className="setting-toggle">
        <input
          type="checkbox"
          checked={setting?.sharing ?? true}
          disabled={busy || !connected || unknown || !setting}
          onChange={(event) => onChange(event.target.checked)}
        />
        친구에게 접속 상태 보이기
      </label>
      <p className="hint" role="status">
        {pending
          ? "접속 공개 설정을 확인하고 있어요…"
          : unknown
            ? "현재 공개 상태를 확인하지 못했어요. 다시 확인해 주세요."
            : !connected
              ? "서버와 연결한 뒤 공개 상태를 확인할 수 있어요."
              : !setting
                ? "이 서버의 공개 설정을 확인할 수 없어요. 서버 업데이트가 필요할 수 있어요."
                : setting.sharing
                  ? "친구에게 온라인으로 보여요."
                  : "접속 상태를 숨겼어요. 친구에게 오프라인으로 보여요."}
      </p>
      <p className="hint">
        꺼도 친구 목록과 인사를 받을 수 있어요. 직접 보낸 인사와 프로필 변경은
        친구에게 전달돼요. 설정은 이 프로필에 저장됩니다.
      </p>
      {(unknown || !setting) && (
        <button className="text-button" disabled={busy} onClick={onRetry}>
          접속 공개 상태 다시 확인
        </button>
      )}
    </section>
  );
}
