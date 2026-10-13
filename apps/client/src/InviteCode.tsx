import { useEffect, useState } from "react";
import { ApiError, errorMessage, request, type SavedSession } from "./api";
import { formatInvitation } from "./invitations";

export function InviteCode({
  session,
  code,
  onCopied,
}: {
  session: SavedSession;
  code?: string;
  onCopied: () => void;
}) {
  const [loadedCode, setLoadedCode] = useState<string>();
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const inviteCode = code ?? loadedCode;

  useEffect(() => {
    if (code) return;
    const controller = new AbortController();
    setLoadedCode(undefined);
    setError("");
    void request(session, "POST /invites", {}, controller.signal)
      .then((result) => {
        try {
          if (typeof result?.code !== "string") throw new Error();
          formatInvitation(session.server, result.code);
        } catch {
          throw new ApiError(
            502,
            "초대 코드를 확인하지 못했어요. 다시 시도해 주세요.",
          );
        }
        if (!controller.signal.aborted)
          setLoadedCode(
            result.code.length === 5 ? result.code.toUpperCase() : result.code,
          );
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setError(errorMessage(cause));
      });
    return () => controller.abort();
  }, [session, code, attempt]);

  return (
    <>
      {inviteCode ? (
        <>
          <div className="field">
            <input
              className="invite-code"
              aria-label="초대 코드"
              readOnly
              value={inviteCode}
              onFocus={(event) => event.target.select()}
            />
          </div>
          <button
            className="primary"
            onClick={async () => {
              setError("");
              try {
                await navigator.clipboard.writeText(
                  formatInvitation(session.server, inviteCode),
                );
                onCopied();
              } catch {
                setError("코드 입력란을 선택한 뒤 직접 복사해 주세요.");
              }
            }}
          >
            초대 코드 복사 <span aria-hidden="true">↗</span>
          </button>
        </>
      ) : !error ? (
        <p className="hint" role="status">
          초대 코드를 불러오는 중…
        </p>
      ) : null}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!inviteCode && error && (
        <button className="primary" onClick={() => setAttempt(attempt + 1)}>
          초대 코드 다시 불러오기
        </button>
      )}
    </>
  );
}
