export const PREFERENCES_KEY = "wappy.characters.v1";

export interface CharacterPreferences {
  paused: boolean;
  visible: boolean;
}

export function loadCharacterPreferences(
  reducedMotion: boolean,
): CharacterPreferences {
  const defaults = { paused: reducedMotion, visible: true };
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
    };
  } catch {
    return defaults;
  }
}
