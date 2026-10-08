import { useState, type FormEvent } from "react";
import { errorMessage, request, type SavedSession } from "./api";
import { ServerCheck } from "./ServerCheck";

export function RecoveryForm({
  server,
  onServerChange,
  busy,
  onRecover,
}: {
  server: string;
  onServerChange: (server: string) => void;
  busy: boolean;
  onRecover: (code: string) => void;
}) {
  const [code, setCode] = useState("");
  function submit(event: FormEvent) {
    event.preventDefault();
    onRecover(code.trim());
  }
  return (
    <form className="profile-form" onSubmit={submit}>
      <fieldset disabled={busy}>
        <legend>프로필과 친구 목록을 다시 불러와요</legend>
        <label className="field">
          기존 서버 주소
          <input
            type="url"
            required
            value={server}
            onChange={(event) => onServerChange(event.target.value)}
          />
        </label>
        <ServerCheck key={server} server={server} busy={busy} />
        <label className="field">
          보관한 복구 코드
          <input
            type="password"
            required
            maxLength={128}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="wappy-recovery-로 시작하는 코드"
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
        </label>
        <p className="hint">
          복구하면 기존 기기는 로그아웃됩니다. 초대 코드로는 복구할 수 없어요.
          복구 코드가 없다면 기존 기기의 ‘내 모습’에서 먼저 발급해 주세요.
        </p>
        <button className="primary" disabled={!code.trim()} type="submit">
          {busy ? "복구하는 중…" : "프로필 복구하기"}
        </button>
      </fieldset>
    </form>
  );
}

export function RecoveryCode({ session }: { session: SavedSession }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function generate() {
    if (busy) return;
    setBusy(true);
    setError("");
    setCode("");
    setNotice("");
    try {
      const result = await request(session, "POST /recovery-code", {});
      setCode(result.code);
      setNotice("복구 코드를 발급했어요. 지금 안전한 곳에 보관해 주세요.");
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      className="invite-card recovery-panel"
      aria-label="프로필 복구 설정"
    >
      <h2>이 친구들을 잃지 않도록</h2>
      <p>
        앱을 다시 설치하거나 기기를 바꿀 때 사용할 복구 코드예요. 서버 주소와
        함께 비밀번호 관리자 등 안전한 곳에 보관하세요.
      </p>
      <p>
        이 코드를 아는 사람은 내 프로필을 사용할 수 있어요. 친구에게 보내지
        마세요. 새로 발급하면 이전 복구 코드는 즉시 무효화됩니다.
      </p>
      {code && (
        <>
          <label className="field">
            나만 보관할 복구 코드
            <textarea
              className="invite-code"
              readOnly
              rows={3}
              value={code}
              onFocus={(event) => event.target.select()}
            />
          </label>
          <p className="hint">이 화면을 떠나면 코드를 다시 볼 수 없어요.</p>
          <button
            className="secondary"
            onClick={async () => {
              setError("");
              try {
                await navigator.clipboard.writeText(code);
                setNotice("복구 코드를 복사했어요. 안전한 곳에 보관해 주세요.");
              } catch {
                setError("코드 입력란을 선택한 뒤 직접 복사해 주세요.");
              }
            }}
          >
            복구 코드 복사
          </button>
        </>
      )}
      <button
        className={code ? "text-button regenerate" : "secondary"}
        disabled={busy}
        onClick={() => void generate()}
      >
        {busy
          ? "발급하는 중…"
          : code
            ? "기존 코드 무효화하고 재발급"
            : "복구 코드 발급·교체"}
      </button>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <p className="hint" role="status">
        {notice}
      </p>
      <p className="hint server-address">
        복구할 서버: <strong>{session.server}</strong>
      </p>
    </section>
  );
}
