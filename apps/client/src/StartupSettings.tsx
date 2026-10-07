import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

export function StartupSettings() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const requestId = useRef(0);
  const changing = useRef(false);

  const sync = useCallback(async (next?: boolean) => {
    if (changing.current) return;
    const id = ++requestId.current;
    changing.current = next !== undefined;
    setBusy(true);
    setError("");
    let failure = "";
    if (next !== undefined) {
      try {
        await invoke("set_startup_enabled", { enabled: next });
      } catch {
        failure =
          "자동 실행 설정을 바꾸지 못했습니다. 앱 설치 위치와 OS의 로그인 항목·시작 앱 설정을 확인해 주세요.";
      }
    }
    // Always read back the OS setting, including after a failed write.
    try {
      const actual = await invoke<boolean>("startup_status");
      if (requestId.current === id) setEnabled(actual);
    } catch {
      if (requestId.current === id) setEnabled(null);
      failure = "자동 실행 상태를 확인하지 못했습니다. 다시 확인해 주세요.";
    } finally {
      if (next !== undefined) changing.current = false;
      if (requestId.current === id) {
        setError(failure);
        setBusy(false);
      }
    }
  }, []);

  useEffect(() => {
    const refresh = () => {
      void sync();
    };
    refresh();
    window.addEventListener("focus", refresh);
    return () => {
      ++requestId.current;
      window.removeEventListener("focus", refresh);
    };
  }, [sync]);

  return (
    <section className="invite-card startup-panel" aria-label="앱 시작 설정">
      <h2>다음에도 함께 시작해요</h2>
      <label className="setting-toggle">
        <input
          type="checkbox"
          checked={enabled === true}
          disabled={busy || enabled === null}
          onChange={(event) => void sync(event.target.checked)}
        />
        컴퓨터 로그인 시 Wappy 실행
      </label>
      <p className="hint">
        자동으로 시작할 때는 사이드바를 숨깁니다. 메뉴 막대·트레이의 Wappy
        아이콘에서 다시 열 수 있어요.
      </p>
      <p className="hint">
        앱을 사용할 위치에 설치한 뒤 켜 주세요. 앱을 옮겼다면 끈 뒤 다시 켜
        주세요.
      </p>
      <p className="hint" role="status">
        {busy
          ? "설정을 확인하는 중…"
          : enabled === null
            ? "자동 실행 상태를 알 수 없어요."
            : enabled
              ? "자동 실행이 등록되어 있어요."
              : "자동 실행이 등록되어 있지 않아요."}
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <p className="hint">
        OS에서 백그라운드 실행을 차단했다면 로그인 항목·시작 앱 설정에서 허용해
        주세요.
      </p>
      <button
        className="text-button"
        disabled={busy}
        onClick={() => void sync()}
      >
        자동 실행 상태 다시 확인
      </button>
    </section>
  );
}
