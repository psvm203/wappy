import type { CharacterPreferences } from "./preferences";

export function DesktopControls({
  desktop,
  compact,
  preferences,
  onChange,
}: {
  desktop: boolean;
  compact: boolean;
  preferences: CharacterPreferences;
  onChange: (
    update: (current: CharacterPreferences) => CharacterPreferences,
  ) => void;
}) {
  const { paused: motionPaused, visible: charactersVisible } = preferences;
  return (
    <section className="desktop-controls" aria-label="바탕화면 캐릭터 설정">
      <p>
        {desktop
          ? motionPaused
            ? "캐릭터가 쉬고 있어요. ‘다시 걷기’로 자동 이동을 시작하세요."
            : "가장자리를 따라 걷는 캐릭터를 잡아서 던져보세요."
          : "데스크톱 앱에서 바탕화면 산책을 시작하세요."}
      </p>
      <div>
        <button
          className="text-button"
          disabled={!desktop}
          onClick={() =>
            onChange((current) => ({
              ...current,
              paused: !current.paused,
            }))
          }
          aria-label={
            motionPaused ? "캐릭터 움직임 다시 시작" : "캐릭터 움직임 멈추기"
          }
          aria-pressed={motionPaused}
        >
          {compact
            ? motionPaused
              ? "▶"
              : "Ⅱ"
            : motionPaused
              ? "다시 걷기"
              : "잠깐 쉬기"}
        </button>
        <button
          className="text-button"
          disabled={!desktop}
          onClick={() =>
            onChange((current) => ({
              ...current,
              visible: !current.visible,
            }))
          }
          aria-label={
            charactersVisible
              ? "바탕화면 캐릭터 숨기기"
              : "바탕화면 캐릭터 표시"
          }
          aria-pressed={charactersVisible}
        >
          {compact
            ? charactersVisible
              ? "◉"
              : "○"
            : charactersVisible
              ? "캐릭터 숨기기"
              : "캐릭터 표시"}
        </button>
      </div>
      {desktop && (
        <p className="hint">
          닫아도 캐릭터는 남아요. 메뉴 막대·트레이에서 다시 열거나 종료할 수
          있어요.
        </p>
      )}
    </section>
  );
}
