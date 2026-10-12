import { useState } from "react";
import type { SavedProfile } from "./sessions";

export function SavedProfiles({
  sessions,
  busy,
  onSelect,
  onForget,
}: {
  sessions: SavedProfile[];
  busy: boolean;
  onSelect: (session: SavedProfile) => void;
  onForget: (session: SavedProfile) => void;
}) {
  const [removing, setRemoving] = useState<SavedProfile | null>(null);
  if (!sessions.length) return null;
  return (
    <section className="saved-profiles" aria-label="이 기기에 보관한 프로필">
      <h2>다시 만나요</h2>
      <p className="hint">
        보관한 서버의 프로필과 친구 목록으로 돌아갈 수 있어요.
      </p>
      <ul>
        {sessions.map((session) => (
          <li key={`${session.server}\n${session.token}`}>
            {session.profile && <strong>{session.profile.name}</strong>}
            <p className="hint">{session.server}</p>
            <button
              className="secondary"
              disabled={busy}
              onClick={() => onSelect(session)}
              aria-label={`${session.profile?.name ?? "보관한 프로필"} · ${session.server} 프로필로 돌아가기`}
            >
              이 프로필로 돌아가기
            </button>
            <button
              className="text-button"
              disabled={busy}
              onClick={() => setRemoving(removing === session ? null : session)}
            >
              이 기기에서 보관 해제
            </button>
            {removing === session && (
              <div className="remove-confirm">
                <p>
                  로그인 정보를 이 기기에서 지웁니다. 서버의 프로필과 친구는
                  남습니다. 카카오로 만든 프로필은 같은 계정으로 다시 로그인할
                  수 있지만, 이름으로 만든 프로필은 다른 로그인 정보가 없으면
                  돌아올 수 없어요.
                </p>
                <button
                  className="text-button"
                  onClick={() => setRemoving(null)}
                >
                  취소
                </button>
                <button
                  className="text-button danger"
                  disabled={busy}
                  onClick={() => onForget(session)}
                >
                  보관 해제 확인
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
