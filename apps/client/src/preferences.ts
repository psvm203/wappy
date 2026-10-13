export const PREFERENCES_KEY = "wappy.characters.v1";

export const CHARACTER_POSITIONS = {
  free: "자유",
  top: "상단",
  bottom: "하단",
  left: "좌측",
  right: "우측",
} as const;
export type CharacterPosition = keyof typeof CHARACTER_POSITIONS;

export const CHARACTER_SIZES = {
  "very-small": { label: "매우 작게", pixels: 24 },
  small: { label: "작게", pixels: 32 },
  normal: { label: "보통", pixels: 42 },
  large: { label: "크게", pixels: 56 },
  "very-large": { label: "매우 크게", pixels: 72 },
} as const;
export type CharacterSize = keyof typeof CHARACTER_SIZES;

export function isCharacterSize(value: unknown): value is CharacterSize {
  return (
    typeof value === "string" && Object.keys(CHARACTER_SIZES).includes(value)
  );
}

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
  size: CharacterSize;
}

export function loadCharacterPreferences(
  reducedMotion: boolean,
): CharacterPreferences {
  const defaults: CharacterPreferences = {
    paused: reducedMotion,
    visible: true,
    position: "free",
    size: "normal",
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
      size:
        "size" in value && isCharacterSize(value.size) ? value.size : "normal",
    };
  } catch {
    return defaults;
  }
}
