import { useEffect, useRef, useState } from "react";
import { checkServer } from "./server-check";
import { isLocalServer } from "./invitations";

export function ServerCheck({
  server,
  busy = false,
}: {
  server: string;
  busy?: boolean;
}) {
  const [result, setResult] = useState<{
    loading?: boolean;
    address?: string;
    error?: string;
  } | null>(null);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  async function check() {
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setResult({ loading: true });
    try {
      const address = await checkServer(server, controller.signal);
      if (!controller.signal.aborted) setResult({ address });
    } catch (cause) {
      if (!controller.signal.aborted)
        setResult({ error: (cause as Error).message });
    }
  }
  return (
    <div className="server-check">
      <button
        type="button"
        className="secondary"
        disabled={busy || result?.loading || !server.trim()}
        onClick={() => void check()}
      >
        {result?.loading ? "서버 확인 중…" : "서버 연결 확인"}
      </button>
      <div role="status" aria-live="polite">
        {result?.loading && (
          <p className="hint">서버의 응답을 기다리고 있어요.</p>
        )}
        {result?.address && (
          <>
            <p className="hint server-address">
              서버 응답을 확인했어요: <strong>{result.address}</strong>
            </p>
            <p className="hint">
              {isLocalServer(result.address)
                ? "이 주소는 내 컴퓨터에서만 사용할 수 있어요. 다른 기기의 친구와 함께하려면 둘 다 접속할 수 있는 서버 주소가 필요해요."
                : "친구와 같은 서버 주소인지 확인해 주세요. 이 확인만으로 프로필을 만들거나 로그인하지는 않아요."}
            </p>
          </>
        )}
      </div>
      {result?.error && (
        <p className="error" role="alert">
          {result.error}
        </p>
      )}
    </div>
  );
}
