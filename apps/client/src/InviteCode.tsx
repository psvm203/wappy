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
          <div
            className="
              field block text-[11px] text-[#68725d] m-[15px_0] [&_:is(input,select,textarea)]:block
              [&_:is(input,select,textarea)]:w-full [&_:is(input,select,textarea)]:mt-[8px]
              [&_:is(input,select,textarea)]:p-[12px] [&_:is(input,select,textarea)]:bg-[#f4f5ef]
              [&_:is(input,select,textarea)]:border [&_:is(input,select,textarea)]:border-solid
              [&_:is(input,select,textarea)]:border-[#e0e5d8]
              [&_:is(input,select,textarea)]:rounded-[9px] [&_:is(input,select,textarea)]:text-[12px]
              [&_:is(input,select,textarea)]:text-[#3e4935] [&_textarea]:resize-y
              [&_textarea]:leading-[1.6] [&_textarea]:wrap-anywhere [&_input::placeholder]:text-[#68745e]
              [&_input::placeholder]:text-[11px]
            "
          >
            <input
              className="invite-code [font-family:ui-monospace,_monospace]"
              aria-label="초대 코드"
              readOnly
              value={inviteCode}
              onFocus={(event) => event.target.select()}
            />
          </div>
          <button
            className="
              primary w-full rounded-[10px] text-[12px] p-[13px_14px] font-semibold flex items-center
              justify-between bg-[#d3e8af] text-[#425335] [&:hover]:bg-[#c7dda1] [&_span]:text-[18px]
              [&_span]:font-normal [&_span]:leading-[1]
            "
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
        <p
          className="hint text-[10px] text-[#68745e] leading-[1.7]"
          role="status"
        >
          초대 코드를 불러오는 중…
        </p>
      ) : null}
      {error && (
        <p
          className="
            error text-[11px] leading-[1.65] rounded-[9px] p-[11px] bg-[#f6e9df] text-[#9b6556]
            wrap-anywhere flex items-start gap-[5px] [&_button]:bg-transparent [&_button]:text-inherit
            [&_button]:ml-auto [&_button]:p-[0_2px]
          "
          role="alert"
        >
          {error}
        </p>
      )}
      {!inviteCode && error && (
        <button
          className="
            primary w-full rounded-[10px] text-[12px] p-[13px_14px] font-semibold flex items-center
            justify-between bg-[#d3e8af] text-[#425335] [&:hover]:bg-[#c7dda1] [&_span]:text-[18px]
            [&_span]:font-normal [&_span]:leading-[1]
          "
          onClick={() => setAttempt(attempt + 1)}
        >
          초대 코드 다시 불러오기
        </button>
      )}
    </>
  );
}
