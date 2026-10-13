import { useEffect, useSyncExternalStore } from "react";
import {
  checkForUpdates,
  getUpdateState,
  installUpdate,
  subscribeUpdates,
  UPDATE_CHECK_INTERVAL,
  type UpdateState,
} from "./updater";

export function useAppUpdates(desktop: boolean) {
  const state = useSyncExternalStore(subscribeUpdates, getUpdateState);
  useEffect(() => {
    if (!desktop) return;
    const refresh = () => {
      void checkForUpdates();
    };
    refresh();
    const timer = window.setInterval(
      () => void checkForUpdates(true),
      UPDATE_CHECK_INTERVAL,
    );
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [desktop]);
  return state;
}

export function UpdateSettings({
  state,
  disabled = false,
}: {
  state: UpdateState;
  disabled?: boolean;
}) {
  const busy = ["checking", "downloading", "installing"].includes(state.status);
  const message = {
    idle: "앱 업데이트",
    disabled: "이 빌드는 자동 업데이트를 지원하지 않습니다.",
    checking: "새 버전을 확인하는 중…",
    current: "최신 버전을 사용하고 있어요.",
    available: `새 버전 ${state.version}가 있어요.`,
    downloading: `업데이트 다운로드 중${state.progress === null ? "…" : ` · ${state.progress}%`}`,
    installing: "업데이트 확인·설치 중…",
    ready: "업데이트 설치 완료",
    error: "앱 업데이트",
  }[state.status];
  return (
    <section
      className="invite-card update-panel"
      aria-label="앱 업데이트"
      aria-busy={busy}
    >
      <p role="status">{message}</p>
      {state.status === "downloading" && (
        <progress
          aria-label="업데이트 다운로드"
          max={100}
          value={state.progress ?? undefined}
        />
      )}
      {state.status !== "disabled" && (
        <button
          type="button"
          className={state.version ? "secondary update-install" : "secondary"}
          disabled={busy || disabled}
          onClick={() =>
            void (state.version ? installUpdate() : checkForUpdates(true))
          }
        >
          {state.status === "ready"
            ? "지금 재시작"
            : state.version
              ? "업데이트"
              : "업데이트 확인"}
        </button>
      )}
      {state.error && (
        <p className="error" role="alert">
          {state.error}
        </p>
      )}
    </section>
  );
}
