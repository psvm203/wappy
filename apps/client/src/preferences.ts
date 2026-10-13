export const PREFERENCES_KEY = "wappy.characters.v1";

export const CHARACTER_POSITIONS = {
  free: "자유",
  top: "상단",
  bottom: "하단",
  left: "좌측",
  right: "우측",
} as const;
export type CharacterPosition = keyof typeof CHARACTER_POSITIONS;

export function isCharacterPosition(
  value: unknown,
): value is CharacterPosition {
  return (
    typeof value === "string" &&
    Object.keys(CHARACTER_POSITIONS).includes(value)
  );
}

export interface CharacterPreferences {
  paused: boolean;
  visible: boolean;
  position: CharacterPosition;
}

export function loadCharacterPreferences(
  reducedMotion: boolean,
): CharacterPreferences {
  const defaults: CharacterPreferences = {
    paused: reducedMotion,
    visible: true,
    position: "free",
  };
  try {
    const value: unknown = JSON.parse(
      localStorage.getItem(PREFERENCES_KEY) || "null",
    );
    if (typeof value !== "object" || value === null || Array.isArray(value))
      return defaults;
    return {
      // Respect the OS preference on every launch; the user can still resume manually.
      paused: reducedMotion || ("paused" in value && value.paused === true),
      visible:
        "visible" in value && typeof value.visible === "boolean"
          ? value.visible
          : true,
      position:
        "position" in value && isCharacterPosition(value.position)
          ? value.position
          : "free",
    };
  } catch {
    return defaults;
  }
}
