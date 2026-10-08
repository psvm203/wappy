import { useEffect, useRef, useState, type MouseEvent } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { openUrl } from "@tauri-apps/plugin-opener";
import { version as browserVersion } from "../package.json";
import { SUPPORT_URL, supportReport, type SupportState } from "./support";

export function SupportPanel(state: SupportState) {
  const [version, setVersion] = useState(state.desktop ? "" : browserVersion);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [opening, setOpening] = useState(false);
  const report = useRef<HTMLTextAreaElement>(null);
  const address = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!state.desktop) return;
    let disposed = false;
    void getVersion()
      .then((value) => {
        if (!disposed) setVersion(value);
      })
      .catch(() => {
        // Keep diagnostics usable when the native version cannot be read.
      });
    return () => {
      disposed = true;
    };
  }, [state.desktop]);
  async function copy(
    field: HTMLInputElement | HTMLTextAreaElement | null,
    message: string,
  ) {
    if (!field) return;
    setError("");
    setNotice("");
    try {
      await navigator.clipboard.writeText(field.value);
      setNotice(message);
    } catch {
      field.focus();
      field.select();
      setError("복사하지 못했어요. 선택된 내용을 직접 복사해 주세요.");
    }
  }
  async function open(event: MouseEvent<HTMLAnchorElement>) {
    if (!state.desktop) return;
    event.preventDefault();
    if (opening) return;
    setOpening(true);
    setError("");
    setNotice("");
    try {
      await openUrl(SUPPORT_URL);
    } catch {
      setError(
        "브라우저를 열지 못했어요. 아래 신고 주소를 복사해 브라우저에서 열어 주세요.",
      );
    } finally {
      setOpening(false);
    }
  }
  return (
    <details className="invite-card support-panel">
      <summary>도움말·앱 정보</summary>
      <h2>불편한 점을 알려 주세요</h2>
      <p className="hint">
        아래 정보를 확인한 뒤 문제 발생 상황과 함께 전달해 주세요. 이름·친구
        목록·서버 주소·로그인 정보는 포함하지 않아요.
      </p>
      <label className="field">
        문제 확인 정보
        <textarea
          ref={report}
          aria-label="문제 확인 정보"
          readOnly
          rows={8}
          spellCheck={false}
          value={supportReport(
            state,
            version,
            navigator.platform,
            import.meta.env.VITE_BUILD_ID,
          )}
          onFocus={(event) => event.target.select()}
        />
      </label>
      <button
        className="secondary"
        type="button"
        onClick={() =>
          void copy(report.current, "문제 확인 정보를 복사했어요.")
        }
      >
        문제 확인 정보 복사
      </button>
      <p className="hint">
        GitHub 로그인이 필요하며 작성한 신고는 공개됩니다. 복구 코드와 초대장,
        개인정보가 담긴 화면은 올리지 마세요.
      </p>
      <a
        className="support-link"
        href={SUPPORT_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-disabled={opening || undefined}
        onClick={(event) => void open(event)}
      >
        {opening ? "브라우저 여는 중…" : "GitHub에서 문제 신고"}
      </a>
      <label className="field">
        신고 페이지 주소
        <input
          ref={address}
          readOnly
          value={SUPPORT_URL}
          onFocus={(event) => event.target.select()}
        />
      </label>
      <button
        className="text-button"
        type="button"
        onClick={() =>
          void copy(address.current, "신고 페이지 주소를 복사했어요.")
        }
      >
        신고 주소 복사
      </button>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <p className="hint" role="status">
        {notice}
      </p>
    </details>
  );
}
