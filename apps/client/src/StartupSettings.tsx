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
      <label className="setting-toggle">
        <input
          type="checkbox"
          checked={enabled === true}
          disabled={busy || enabled === null}
          onChange={(event) => void sync(event.target.checked)}
        />
        컴퓨터 로그인 시 Wappy 실행
      </label>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
