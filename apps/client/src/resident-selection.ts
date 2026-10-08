import type { Friend, SidebarState } from "@wappy/api";
import { serverUrl } from "./invitations.ts";

export const RESIDENT_SELECTION_PREFIX = "wappy.residents.v1:";

export function residentSelectionKey(
  server: string,
  profileId: string,
): string {
  // Keep a selection through token rotation, while isolating servers and profiles.
  return (
    RESIDENT_SELECTION_PREFIX + JSON.stringify([serverUrl(server), profileId])
  );
}

export function loadHiddenResidents(
  key: string,
  storage: Pick<Storage, "getItem"> = localStorage,
): string[] {
  const value: unknown = JSON.parse(storage.getItem(key) ?? "[]");
  if (
    !Array.isArray(value) ||
    value.some((id) => typeof id !== "string" || !id || id.length > 128)
  )
    throw new Error("Invalid character selection");
  return [...new Set(value)];
}

export function saveHiddenResidents(
  key: string,
  hiddenIds: string[],
  storage: Pick<Storage, "setItem"> = localStorage,
) {
  storage.setItem(key, JSON.stringify(hiddenIds));
}

export type DesktopResident = Friend & { isSelf: boolean };

export function visibleResidents(
  state: SidebarState,
  connected: boolean,
  hiddenIds: readonly string[],
): DesktopResident[] {
  const hidden = new Set(hiddenIds);
  return [
    { ...state.self, online: true, isSelf: true },
    ...state.friends.map((friend) => ({
      ...friend,
      online: connected && friend.online,
      isSelf: false,
    })),
  ].filter((profile) => !hidden.has(profile.id));
}
