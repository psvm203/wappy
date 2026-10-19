import { useEffect, useRef, useState } from "react";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { type Session } from "@wappy/api";
import { parseKakaoStart, parseKakaoResult } from "./kakao-login";
import type { SavedSession } from "./sessions";
import { ApiError, errorMessage, request, serverUrl } from "./api";

export function KakaoLogin({
  server,
  session,
  onStart,
  busy,
  onBusyChange,
  onLogin,
}: {
  server: string;
  session?: SavedSession;
  onStart: () => void;
  busy: boolean;
  onBusyChange: (busy: boolean) => void;
  onLogin: (server: string, session: Session) => void;
}) {
  const active = useRef<AbortController | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  useEffect(
    () => () => {
      active.current?.abort();
    },
    [],
  );

  async function login() {
    if (busy || active.current) return;
    const controller = new AbortController();
    active.current = controller;
    const { signal } = controller;
    setPending(true);
    setError("");
    onBusyChange(true);
    // Open synchronously with the click so browsers do not block the login window.
    const popup = isTauri() ? null : window.open("about:blank", "_blank");
    if (popup) popup.opener = null;
    let address = "";
    let loginToken = "";
    let completed = false;
    try {
      if (!isTauri() && !popup)
        throw new ApiError(
          400,
          "로그인 창을 열 수 없습니다. 팝업을 허용한 뒤 다시 시도해 주세요.",
        );
      try {
        address = serverUrl(server);
      } catch {
        throw new ApiError(400, "연결할 서버 주소를 확인해 주세요.");
      }
      onStart();
      const started = parseKakaoStart(
        await request(
          { server: address, token: session?.token },
          "POST /auth/kakao/start",
          {},
          signal,
        ),
        address,
      );
      loginToken = started.loginToken;
      const destination = new URL(started.authorizationUrl);
      signal.throwIfAborted();
      if (popup) popup.location.href = destination.href;
      else await invoke("open_kakao_login", { url: destination.href });
      const deadline = Math.min(started.expiresAt, Date.now() + 10 * 60_000);
      while (Date.now() < deadline) {
        signal.throwIfAborted();
        const result = parseKakaoResult(
          await request(
            { server: address },
            "POST /auth/kakao/poll",
            { loginToken },
            signal,
          ),
        );
        signal.throwIfAborted();
        if (result.status === "complete") {
          completed = true;
          onLogin(address, result.session);
          return;
        }
        await new Promise<void>((resolve) => {
          const done = () => {
            window.clearTimeout(timer);
            signal.removeEventListener("abort", done);
            resolve();
          };
          const timer = window.setTimeout(done, 2_000);
          signal.addEventListener("abort", done, { once: true });
          if (signal.aborted) done();
        });
      }
      throw new ApiError(
        410,
        "로그인 시간이 만료되었습니다. 다시 시도해 주세요.",
      );
    } catch (cause) {
      if (!signal.aborted) setError(errorMessage(cause));
    } finally {
      popup?.close();
      if (loginToken && !completed)
        void request({ server: address }, "POST /auth/kakao/cancel", {
          loginToken,
        }).catch(() => {});
      active.current = null;
      setPending(false);
      onBusyChange(false);
    }
  }

  return (
    <section className="kakao-login mt-[18px]" aria-label="카카오 로그인">
      <button
        type="button"
        className="flex w-full items-center justify-center gap-[9px] rounded-[10px] bg-[#fee500] p-[13px_14px] text-[13px] font-semibold text-[#000000d9] disabled:cursor-wait disabled:opacity-60"
        disabled={busy}
        onClick={() => void login()}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="#000"
            d="M12 3C5.925 3 1 6.797 1 11.48c0 3.047 2.088 5.717 5.223 7.211l-1.062 3.895c-.094.344.299.618.6.42l4.656-3.074c.52.06 1.047.091 1.583.091 6.075 0 11-3.797 11-8.48C23 6.797 18.075 3 12 3Z"
          />
        </svg>
        카카오 로그인
      </button>
      {pending && (
        <>
          <p
            className="mt-[12px] text-[11px] leading-[1.8] text-[#68745e]"
            role="status"
          >
            브라우저에서 로그인한 뒤 이 화면으로 돌아오세요.
          </p>
          <button
            type="button"
            className="mt-[10px] bg-transparent p-[4px_0] text-[12px] text-[#765b52] underline"
            onClick={() => active.current?.abort()}
          >
            로그인 취소
          </button>
        </>
      )}
      {error && (
        <p
          className="mt-[12px] rounded-[9px] bg-[#f6e9df] p-[11px] text-[11px] leading-[1.65] text-[#9b6556]"
          role="alert"
        >
          {error}
        </p>
      )}
    </section>
  );
}
