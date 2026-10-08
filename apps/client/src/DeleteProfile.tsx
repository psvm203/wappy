import { useRef, useState, type FormEvent } from "react";
import { MAX_NAME_LENGTH, type Profile } from "@wappy/api";

export function DeleteProfile({
  profile,
  server,
  busy,
  connected,
  error,
  onDelete,
}: {
  profile: Profile;
  server: string;
  busy: boolean;
  connected: boolean;
  error: string;
  onDelete: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [name, setName] = useState("");
  const trigger = useRef<HTMLButtonElement>(null);
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!busy && connected && name.trim() === profile.name) onDelete();
  }
  return (
    <section
      className="invite-card delete-profile"
      aria-label="서버 프로필 삭제"
    >
      <h2>이 프로필과 작별하기</h2>
      <p>
        이 서버의 내 프로필, 친구 연결, 초대와 주고받은 인사를 삭제합니다. 복구
        코드로도 되돌릴 수 없어요. 다른 프로필은 유지됩니다.
      </p>
      <p className="hint">
        내가 보내거나 받은 1:1 메시지와 나에 관련된 메시지 신고 기록도
        삭제합니다.
      </p>
      <p className="hint server-address">
        삭제할 프로필: <strong>{profile.name}</strong>
        <br />
        서버: <strong>{server}</strong>
      </p>
      {!confirming ? (
        <button
          ref={trigger}
          className="text-button danger"
          disabled={busy || !connected}
          onClick={() => {
            setName("");
            setConfirming(true);
          }}
        >
          서버에서 프로필 삭제하기
        </button>
      ) : (
        <form onSubmit={submit}>
          <label className="field">
            확인을 위해 프로필 이름 입력
            <input
              autoFocus
              required
              autoComplete="off"
              maxLength={MAX_NAME_LENGTH}
              value={name}
              disabled={busy}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <div className="delete-profile-actions">
            <button
              type="button"
              className="text-button"
              disabled={busy}
              onClick={() => {
                setConfirming(false);
                // The trigger is restored by the next render.
                requestAnimationFrame(() => trigger.current?.focus());
              }}
            >
              취소
            </button>
            <button
              className="text-button danger"
              type="submit"
              disabled={busy || !connected || name.trim() !== profile.name}
            >
              {busy ? "처리하는 중…" : "프로필 영구 삭제"}
            </button>
          </div>
        </form>
      )}
      {!connected && (
        <p className="hint">서버에 연결되어 있을 때 삭제할 수 있어요.</p>
      )}
      {error && <p className="error">{error}</p>}
    </section>
  );
}
