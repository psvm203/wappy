import { useEffect, useRef, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { openUrl } from "@tauri-apps/plugin-opener";
import { isRecord, parseSidebarState, type Session } from "@wappy/api";
import { ApiError, errorMessage, request, serverUrl } from "./api";

export function KakaoLogin({
  server,
  busy,
  onBusyChange,
  onLogin,
}: {
  server: string;
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
      const started = await request(
        { server: address },
        "POST /auth/kakao/start",
        {},
        signal,
      );
      if (
        !isRecord(started) ||
        typeof started.loginToken !== "string" ||
        !/^[A-Za-z0-9_-]{43}$/.test(started.loginToken) ||
        typeof started.authorizationUrl !== "string" ||
        typeof started.expiresAt !== "number" ||
        !Number.isSafeInteger(started.expiresAt)
      )
        throw new ApiError(502, "서버의 로그인 응답을 확인하지 못했습니다.");
      loginToken = started.loginToken;
      const destination = new URL(started.authorizationUrl);
      if (
        destination.origin !== address ||
        destination.pathname !== "/auth/kakao/authorize" ||
        destination.username ||
        destination.password ||
        destination.hash ||
        !/^[a-f0-9]{64}$/.test(destination.searchParams.get("state") ?? "")
      )
        throw new ApiError(
          502,
          "로그인 주소가 연결할 서버와 다릅니다. 서버 주소와 카카오 리다이렉트 URI를 확인해 주세요.",
        );
      signal.throwIfAborted();
      if (popup) popup.location.href = destination.href;
      else await openUrl(destination.href);
      const deadline = Math.min(started.expiresAt, Date.now() + 10 * 60_000);
      while (Date.now() < deadline) {
        signal.throwIfAborted();
        const result = await request(
          { server: address },
          "POST /auth/kakao/poll",
          { loginToken },
          signal,
        );
        signal.throwIfAborted();
        if (
          !isRecord(result) ||
          !["pending", "complete"].includes(result.status)
        )
          throw new ApiError(502, "서버의 로그인 응답을 확인하지 못했습니다.");
        if (result.status === "complete") {
          const session = result.session;
          if (
            !isRecord(session) ||
            typeof session.token !== "string" ||
            !/^[A-Za-z0-9_-]{43}$/.test(session.token)
          )
            throw new ApiError(
              502,
              "서버의 로그인 정보를 확인하지 못했습니다.",
            );
          const profile = parseSidebarState({
            self: session.profile,
            friends: [],
          }).self;
          completed = true;
          onLogin(address, { token: session.token, profile });
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
    <section className="kakao-login" aria-label="카카오 로그인">
      <button
        type="button"
        className="kakao-button"
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
      {pending ? (
        <>
          <p className="hint" role="status">
            브라우저에서 로그인한 뒤 이 화면으로 돌아오세요.
          </p>
          <button
            type="button"
            className="text-button"
            onClick={() => active.current?.abort()}
          >
            로그인 취소
          </button>
        </>
      ) : (
        <p className="hint">
          같은 카카오 계정으로 내 프로필을 다시 불러올 수 있어요. 새로
          로그인하면 이전 기기는 로그아웃돼요.
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
