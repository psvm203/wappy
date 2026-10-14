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
      className="
        invite-card update-panel [&.update-panel]:mt-[12px] [&.update-panel]:pt-[12px]
        [&.update-panel]:text-[12px] [&_p]:m-[0_0_8px] [&_p]:wrap-anywhere
        [&.update-panel_>_p[role='status']]:mt-0 [&.update-panel_>_p[role='status']]:text-[#000]
        [&_progress]:w-full [&_progress]:accent-[#678b57] [&_.update-install]:bg-[#4f783e]
        [&_.update-install]:text-[#fff] [&_.update-install:hover]:bg-[#426533] bg-[#f0f3e8] border
        border-solid border-[#e5e9db] rounded-[15px] p-[20px_16px_13px] [&_h2]:text-[13px]
        [&_>_p:not(.hint)]:text-[11px] [&_>_p:not(.hint)]:text-[#68745e] [&_>_p:not(.hint)]:leading-[1.8]
        [&_>_p:not(.hint)]:m-[10px_0_17px]
      "
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
          className={`
            secondary w-full rounded-[10px] text-[12px] p-[13px_14px] font-semibold text-[#526a3d]
            bg-[#e8eede] [&:hover]:bg-[#dee7ce]
          ${state.version ? "update-install" : ""}`}
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
        <p
          className="
            error text-[11px] leading-[1.65] rounded-[9px] p-[11px] bg-[#f6e9df] text-[#9b6556]
            wrap-anywhere flex items-start gap-[5px] [&_button]:bg-transparent [&_button]:text-inherit
            [&_button]:ml-auto [&_button]:p-[0_2px]
          "
          role="alert"
        >
          {state.error}
        </p>
      )}
    </section>
  );
}
