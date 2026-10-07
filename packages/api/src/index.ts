export const CHARACTERS = ["bunny", "cat", "bear", "frog"] as const;
export type Character = (typeof CHARACTERS)[number];
export const CHARACTER_NAMES: Record<Character, string> = {
  bunny: "토끼",
  cat: "고양이",
  bear: "곰",
  frog: "개구리",
};
export const POLL_INTERVAL_MS = 5_000;
export const ONLINE_TIMEOUT_MS = 30_000;
export const INVITE_TTL_MS = 24 * 60 * 60 * 1_000;
export const MAX_NAME_LENGTH = 24;
export const MAX_STATUS_LENGTH = 60;
export const WAVE_COOLDOWN_MS = 30_000;
export const WAVE_TTL_MS = 24 * 60 * 60 * 1_000;

export interface ProfileInput {
  name: string;
  character: Character;
  status: string;
}
export interface Profile extends ProfileInput {
  id: string;
}
export interface Friend extends Profile {
  online: boolean;
  wave?: Wave;
}
export interface Wave {
  id: string;
  sentAt: number;
}
export interface SidebarState {
  self: Profile;
  friends: Friend[];
  /** Private to the authenticated profile; absent on servers without this feature. */
  presence?: PresenceSettings;
}
export interface PresenceSettings {
  sharing: boolean;
  revision: number;
}
export interface Session {
  token: string;
  profile: Profile;
}
export interface Invite {
  code: string;
  expiresAt: number;
}
export interface ApiErrorBody {
  error: string;
}

/** The client and server share method, path, request and response types. */
export interface ApiRoutes {
  "POST /session": { input: ProfileInput; output: Session };
  "POST /session/recover": { input: { code: string }; output: Session };
  "POST /recovery-code": {
    input: Record<string, never>;
    output: { code: string };
  };
  "GET /state": { input: undefined; output: SidebarState };
  "PATCH /profile": { input: ProfileInput; output: Profile };
  "PATCH /presence": { input: { sharing: boolean }; output: PresenceSettings };
  "POST /invites": { input: Record<string, never>; output: Invite };
  "POST /invites/accept": { input: { code: string }; output: Profile };
  "POST /friends/remove": { input: { friendId: string }; output: { ok: true } };
  "POST /friends/wave": { input: { friendId: string }; output: Wave };
  "POST /waves/read": { input: { waveId: string }; output: { ok: true } };
}
export type Route = keyof ApiRoutes;
export type Input<R extends Route> = ApiRoutes[R]["input"];
export type Output<R extends Route> = ApiRoutes[R]["output"];

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parsePresenceSettings(value: unknown): PresenceSettings {
  if (
    !isRecord(value) ||
    typeof value.sharing !== "boolean" ||
    typeof value.revision !== "number" ||
    !Number.isSafeInteger(value.revision) ||
    value.revision < 0
  )
    throw new Error("잘못된 접속 공개 설정입니다.");
  return { sharing: value.sharing, revision: value.revision };
}

/** Runtime validation at the HTTP boundary; TypeScript alone cannot validate JSON. */
export function parseProfile(value: unknown): ProfileInput {
  if (
    !isRecord(value) ||
    typeof value.name !== "string" ||
    typeof value.status !== "string" ||
    !CHARACTERS.includes(value.character as Character)
  ) {
    throw new Error("이름, 캐릭터, 상태 메시지를 확인해 주세요.");
  }
  const name = value.name.trim();
  const status = value.status.trim();
  if (
    !name ||
    name.length > MAX_NAME_LENGTH ||
    status.length > MAX_STATUS_LENGTH ||
    /[\u0000-\u001f\u007f]/.test(name + status)
  ) {
    throw new Error(
      `이름은 1–${MAX_NAME_LENGTH}자, 상태 메시지는 ${MAX_STATUS_LENGTH}자 이내로 입력해 주세요.`,
    );
  }
  return { name, status, character: value.character as Character };
}

/** Validate state from a server before using it to render either desktop window. */
export function parseSidebarState(value: unknown): SidebarState {
  function profile(input: unknown): Profile {
    if (
      !isRecord(input) ||
      typeof input.id !== "string" ||
      !input.id ||
      input.id.length > 128
    )
      throw new Error("잘못된 프로필 응답입니다.");
    return { id: input.id, ...parseProfile(input) };
  }
  if (!isRecord(value) || !Array.isArray(value.friends))
    throw new Error("잘못된 친구 목록 응답입니다.");
  const self = profile(value.self);
  const ids = new Set([self.id]);
  const waveIds = new Set<string>();
  const friends = value.friends.map((friend): Friend => {
    if (!isRecord(friend) || typeof friend.online !== "boolean")
      throw new Error("잘못된 접속 상태 응답입니다.");
    const parsed = profile(friend);
    if (ids.has(parsed.id)) throw new Error("중복된 친구 응답입니다.");
    ids.add(parsed.id);
    let wave: Wave | undefined;
    if (friend.wave !== undefined) {
      const input = friend.wave;
      if (
        !isRecord(input) ||
        typeof input.id !== "string" ||
        !input.id ||
        input.id.length > 128 ||
        waveIds.has(input.id) ||
        typeof input.sentAt !== "number" ||
        !Number.isSafeInteger(input.sentAt) ||
        input.sentAt <= 0 ||
        input.sentAt > 8_640_000_000_000_000
      )
        throw new Error("잘못된 인사 응답입니다.");
      waveIds.add(input.id);
      wave = { id: input.id, sentAt: input.sentAt };
    }
    return { ...parsed, online: friend.online, ...(wave ? { wave } : {}) };
  });
  return {
    self,
    friends,
    ...(value.presence === undefined
      ? {}
      : { presence: parsePresenceSettings(value.presence) }),
  };
}
