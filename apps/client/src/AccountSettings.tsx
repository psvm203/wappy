import type { Session, SidebarState } from "@wappy/api";
import { KakaoLogin } from "./KakaoLogin";
import type { SavedSession } from "./sessions";

export function AccountSettings({
  server,
  session,
  state,
  busy,
  onBusyChange,
  onStart,
  onLogin,
  onLogout,
  onGuest,
}: {
  server: string;
  session?: SavedSession;
  state: SidebarState | null;
  busy: boolean;
  onBusyChange: (busy: boolean) => void;
  onStart: () => void;
  onLogin: (server: string, session: Session) => void;
  onLogout: () => void;
  onGuest: () => void;
}) {
  const linked = !!session && state?.account?.kakao === true;
  return (
    <section aria-label="계정" className="text-[12px] text-[#3e4935]">
      <div className="rounded-[15px] border border-solid border-[#e5e9db] bg-[#f0f3e8] p-[18px_15px]">
        <strong>
          {linked ? "카카오 계정으로 로그인했어요" : "게스트로 사용 중이에요"}
        </strong>
        {linked ? (
          <>
            <p className="mt-[10px] text-[11px] leading-[1.8] text-[#68745e]">
              {state?.self.name} 님의 프로필과 방이 카카오 계정에 연결되어
              있어요. 같은 계정으로 다시 로그인하면 이어서 사용할 수 있어요.
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={onLogout}
              className="mt-[14px] w-full rounded-[10px] bg-[#e8eede] p-[12px] text-[12px] font-semibold text-[#526a3d] disabled:opacity-50"
            >
              로그아웃
            </button>
            <p className="mt-[10px] text-[10px] leading-[1.7] text-[#68745e]">
              이 기기에서만 로그아웃돼요. 이전 게스트 프로필이 있으면
              돌아갑니다.
            </p>
          </>
        ) : (
          <KakaoLogin
            server={server}
            session={session}
            busy={busy}
            onBusyChange={onBusyChange}
            onStart={onStart}
            onLogin={onLogin}
          />
        )}
      </div>
      {!session && (
        <button
          type="button"
          disabled={busy}
          onClick={onGuest}
          className="mt-[18px] w-full rounded-[10px] bg-[#e8eede] p-[12px] text-[12px] font-semibold text-[#526a3d] disabled:opacity-50"
        >
          로그인 없이 시작하기
        </button>
      )}
    </section>
  );
}
