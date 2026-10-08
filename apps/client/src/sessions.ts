import { isRecord, parseSidebarState, type Profile } from "@wappy/api";
import { serverUrl } from "./invitations.ts";
import { residentSelectionKey } from "./resident-selection.ts";

export const SESSION_KEY = "wappy.session.v1";
export const SAVED_SESSIONS_KEY = "wappy.saved-sessions.v1";
export interface SavedSession {
  server: string;
  token: string;
}
export interface SavedProfile extends SavedSession {
  profile?: Profile;
}
type SessionStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function parseSession(value: unknown): SavedSession | null {
  try {
    if (
      isRecord(value) &&
      typeof value.server === "string" &&
      typeof value.token === "string" &&
      /^[A-Za-z0-9_-]{43}$/.test(value.token)
    )
      return { server: serverUrl(value.server), token: value.token };
  } catch {
    /* An invalid stored address cannot become a request destination. */
  }
  return null;
}

export function loadSession(storage?: SessionStorage): SavedSession | null {
  try {
    return parseSession(
      JSON.parse((storage ?? localStorage).getItem(SESSION_KEY) || "null"),
    );
  } catch {
    return null;
  }
}

function readSavedSessions(storage: SessionStorage): SavedProfile[] {
  const values: unknown = JSON.parse(
    storage.getItem(SAVED_SESSIONS_KEY) || "[]",
  );
  if (!Array.isArray(values)) throw new Error("Invalid saved sessions");
  const sessions = new Map<string, SavedProfile>();
  for (const value of values) {
    const session: SavedProfile | null = parseSession(value);
    if (!session) continue;
    try {
      if (isRecord(value) && value.profile)
        session.profile = parseSidebarState({
          self: value.profile,
          friends: [],
        }).self;
    } catch {
      /* A damaged display name must not discard a usable credential. */
    }
    sessions.set(`${session.server}\n${session.token}`, session);
  }
  return [...sessions.values()];
}

export function loadSavedSessions(storage?: SessionStorage): SavedProfile[] {
  try {
    return readSavedSessions(storage ?? localStorage);
  } catch {
    return [];
  }
}

function sameProfile(a: SavedProfile, b: SavedProfile): boolean {
  return (
    a.server === b.server &&
    (a.token === b.token || (!!a.profile && a.profile.id === b.profile?.id))
  );
}

export function saveSession(
  session: SavedProfile,
  storage: SessionStorage = localStorage,
) {
  const saved = readSavedSessions(storage);
  const previous = saved.find((item) => sameProfile(item, session));
  if (previous) {
    // Recovery rotates the token; update a previously saved copy as well.
    storage.setItem(
      SAVED_SESSIONS_KEY,
      JSON.stringify([
        ...saved.filter((item) => !sameProfile(item, session)),
        { ...previous, ...session },
      ]),
    );
  }
  storage.setItem(
    SESSION_KEY,
    JSON.stringify({ server: session.server, token: session.token }),
  );
}

export function parkSession(
  session: SavedProfile,
  storage: SessionStorage = localStorage,
): SavedProfile[] {
  const previous = readSavedSessions(storage);
  const saved = [
    ...previous.filter((item) => !sameProfile(item, session)),
    { ...previous.find((item) => sameProfile(item, session)), ...session },
  ];
  // Never remove the active credential until its saved copy was written successfully.
  storage.setItem(SAVED_SESSIONS_KEY, JSON.stringify(saved));
  storage.removeItem(SESSION_KEY);
  return saved;
}

export function forgetSavedSession(
  session: SavedSession,
  storage: SessionStorage = localStorage,
): SavedProfile[] {
  const saved = readSavedSessions(storage).filter(
    (item) => item.server !== session.server || item.token !== session.token,
  );
  storage.setItem(SAVED_SESSIONS_KEY, JSON.stringify(saved));
  return saved;
}

/** Only call after the server confirms deletion. Try every local cleanup independently. */
export function forgetDeletedProfile(
  session: SavedProfile & { profile: Profile },
  storage: SessionStorage = localStorage,
): boolean {
  let complete = true;
  for (const cleanup of [
    () => {
      const active = parseSession(
        JSON.parse(storage.getItem(SESSION_KEY) || "null"),
      );
      if (active?.server === session.server && active.token === session.token)
        storage.removeItem(SESSION_KEY);
    },
    () =>
      storage.setItem(
        SAVED_SESSIONS_KEY,
        JSON.stringify(
          readSavedSessions(storage).filter(
            (item) => !sameProfile(item, session),
          ),
        ),
      ),
    () =>
      storage.removeItem(
        residentSelectionKey(session.server, session.profile.id),
      ),
  ]) {
    try {
      cleanup();
    } catch {
      complete = false;
    }
  }
  return complete;
}
