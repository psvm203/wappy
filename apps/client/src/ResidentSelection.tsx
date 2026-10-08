import type { SidebarState } from "@wappy/api";

export function ResidentSelection({
  state,
  hiddenIds,
  ready,
  visible,
  onChange,
}: {
  state: SidebarState;
  hiddenIds: string[];
  ready: boolean;
  visible: boolean;
  onChange: (update: (current: string[]) => string[]) => void;
}) {
  const residents = [state.self, ...state.friends];
  const hidden = new Set(hiddenIds);
  const selected = residents.filter(
    (profile) => !hidden.has(profile.id),
  ).length;
  return (
    <details className="resident-selection">
      <summary>
        캐릭터 선택 ·{" "}
        {ready ? `${selected}/${residents.length}` : "불러오는 중…"}
      </summary>
      <p className="hint">
        이 기기에만 적용돼요. 친구 목록과 받은 인사는 계속 볼 수 있어요.
      </p>
      {!visible && <p className="hint">지금은 전체 캐릭터를 숨긴 상태예요.</p>}
      <fieldset disabled={!ready}>
        <legend className="selection-legend">바탕화면에 표시할 캐릭터</legend>
        {residents.map((profile) => (
          <label className="setting-toggle" key={profile.id}>
            <input
              type="checkbox"
              checked={!hidden.has(profile.id)}
              onChange={(event) => {
                const selected = event.target.checked;
                onChange((current) =>
                  selected
                    ? current.filter((id) => id !== profile.id)
                    : [...current, profile.id],
                );
              }}
            />
            {profile.name}
            {profile.id === state.self.id ? " (나)" : ""}
          </label>
        ))}
        <div className="selection-actions">
          <button className="text-button" onClick={() => onChange(() => [])}>
            모두 선택
          </button>
          <button
            className="text-button"
            onClick={() =>
              onChange(() => state.friends.map((friend) => friend.id))
            }
          >
            내 캐릭터만
          </button>
        </div>
      </fieldset>
    </details>
  );
}
