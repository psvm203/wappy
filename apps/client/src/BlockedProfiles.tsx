import type { BlockingSettings } from "@wappy/api";
import { Character } from "./Character";

export function BlockedProfiles({
  blocking,
  disabled,
  onUnblock,
}: {
  blocking?: BlockingSettings;
  disabled: boolean;
  onUnblock: (id: string) => void;
}) {
  return (
    <section className="invite-card" aria-label="차단한 친구 관리">
      <h2>차단한 친구{blocking ? ` · ${blocking.profiles.length}` : ""}</h2>
      <p className="hint">
        차단한 프로필과는 인사·채팅·접속 상태를 주고받지 않아요. 차단을 풀어도
        친구로 자동 연결되지는 않아요.
      </p>
      {blocking === undefined ? (
        <p className="hint">
          이 서버는 차단 기능을 지원하지 않아요. 서버를 업데이트해 주세요.
        </p>
      ) : blocking.profiles.length === 0 ? (
        <p className="hint">차단한 친구가 없어요.</p>
      ) : (
        <ul className="blocked-profiles">
          {blocking.profiles.map((profile) => (
            <li key={profile.id}>
              <Character kind={profile.character} />
              <strong>{profile.name}</strong>
              <button
                type="button"
                className="text-button"
                disabled={disabled}
                aria-label={`${profile.name} 님 차단 해제`}
                onClick={() => onUnblock(profile.id)}
              >
                차단 해제
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
