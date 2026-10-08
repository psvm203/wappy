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
export const MAX_CHAT_LENGTH = 200;
export const CHAT_HISTORY_LIMIT = 50;
export const CHAT_TTL_MS = 24 * 60 * 60 * 1_000;
export const CHAT_BUBBLE_MS = 60_000;
export const CHAT_COOLDOWN_MS = 1_000;

export interface ChatMessage {
  id: number;
  senderId: string;
  /** Present only for a message addressed to one friend. */
  recipientId?: string;
  text: string;
  sentAt: number;
}

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
  /** Absent on servers that do not support chat. */
  messages?: ChatMessage[];
  /** Explicit support is required before enabling private message composition. */
  directChat?: true;
  /** Unacknowledged received messages in this snapshot; private to self. Absent on older servers. */
  unreadChatIds?: number[];
  /** The authenticated profile's block list; absent on older servers. */
  blocking?: BlockingSettings;
}
export type BlockedProfile = Pick<Profile, "id" | "name" | "character">;
export interface BlockingSettings {
  revision: number;
  profiles: BlockedProfile[];
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
export interface InvitePreview {
  name: string;
  character: Character;
  expiresAt: number;
}
export interface ApiErrorBody {
  error: string;
}

/** The client and server share method, path, request and response types. */
export interface ApiRoutes {
  "POST /auth/kakao/start": {
    input: Record<string, never>;
    output: { loginToken: string; authorizationUrl: string; expiresAt: number };
  };
  "POST /auth/kakao/poll": {
    input: { loginToken: string };
    output: { status: "pending" } | { status: "complete"; session: Session };
  };
  "POST /auth/kakao/cancel": {
    input: { loginToken: string };
    output: { ok: true };
  };
  "POST /session": { input: ProfileInput; output: Session };
  "POST /session/recover": { input: { code: string }; output: Session };
  "POST /recovery-code": {
    input: Record<string, never>;
    output: { code: string };
  };
  "GET /state": { input: undefined; output: SidebarState };
  "POST /chat": { input: { text: string }; output: ChatMessage };
  "POST /chat/direct": {
    input: { text: string; friendId: string };
    output: ChatMessage;
  };
  "POST /chat/read": {
    input: { messageIds: number[] };
    output: { messageIds: number[] };
  };
  "PATCH /profile": { input: ProfileInput; output: Profile };
  "POST /profile/delete": {
    input: { profileId: string };
    output: { ok: true };
  };
  "PATCH /presence": { input: { sharing: boolean }; output: PresenceSettings };
  "POST /invites": { input: Record<string, never>; output: Invite };
  "POST /invites/preview": { input: { code: string }; output: InvitePreview };
  "POST /invites/accept": { input: { code: string }; output: Profile };
  "POST /friends/remove": { input: { friendId: string }; output: { ok: true } };
  "POST /friends/block": {
    input: { friendId: string };
    output: BlockingSettings;
  };
  "POST /friends/unblock": {
    input: { friendId: string };
    output: BlockingSettings;
  };
  "POST /friends/wave": { input: { friendId: string }; output: Wave };
  "POST /waves/read": { input: { waveId: string }; output: { ok: true } };
}
export type Route = keyof ApiRoutes;
export type Input<R extends Route> = ApiRoutes[R]["input"];
export type Output<R extends Route> = ApiRoutes[R]["output"];

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseChatText(value: unknown): string {
  if (typeof value !== "string") throw new Error("채팅 내용을 입력해 주세요.");
  const text = value.replace(/\r\n?/g, "\n").trim();
  if (
    !text ||
    text.length > MAX_CHAT_LENGTH ||
    /[\u0000-\u0009\u000b-\u001f\u007f]/.test(text)
  )
    throw new Error(`채팅은 1–${MAX_CHAT_LENGTH}자 이내로 입력해 주세요.`);
  return text;
}

export function parseChatMessage(value: unknown): ChatMessage {
  if (
    !isRecord(value) ||
    typeof value.id !== "number" ||
    !Number.isSafeInteger(value.id) ||
    value.id <= 0 ||
    typeof value.senderId !== "string" ||
    !value.senderId ||
    value.senderId.length > 128 ||
    (value.recipientId !== undefined &&
      (typeof value.recipientId !== "string" ||
        !value.recipientId ||
        value.recipientId.length > 128 ||
        value.recipientId === value.senderId)) ||
    typeof value.sentAt !== "number" ||
    !Number.isSafeInteger(value.sentAt) ||
    value.sentAt <= 0 ||
    value.sentAt > 8_640_000_000_000_000
  )
    throw new Error("잘못된 채팅 응답입니다.");
  return {
    id: value.id,
    senderId: value.senderId,
    ...(value.recipientId === undefined
      ? {}
      : { recipientId: value.recipientId as string }),
    text: parseChatText(value.text),
    sentAt: value.sentAt,
  };
}

export function parseChatMessageIds(value: unknown): number[] {
  if (
    !Array.isArray(value) ||
    value.length > CHAT_HISTORY_LIMIT ||
    value.some((id) => !Number.isSafeInteger(id) || id <= 0) ||
    new Set(value).size !== value.length
  )
    throw new Error("잘못된 채팅 메시지 목록입니다.");
  return [...value];
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

export function parseBlockingSettings(value: unknown): BlockingSettings {
  if (
    !isRecord(value) ||
    !Number.isSafeInteger(value.revision) ||
    (value.revision as number) < 0 ||
    !Array.isArray(value.profiles)
  )
    throw new Error("잘못된 차단 목록입니다.");
  const ids = new Set<string>();
  const profiles = value.profiles.map((input): BlockedProfile => {
    if (
      !isRecord(input) ||
      typeof input.id !== "string" ||
      !input.id ||
      input.id.length > 128 ||
      ids.has(input.id)
    )
      throw new Error("잘못된 차단 프로필입니다.");
    const { name, character } = parseProfile({ ...input, status: "" });
    ids.add(input.id);
    return { id: input.id, name, character };
  });
  return { revision: value.revision as number, profiles };
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

export function parseInvitePreview(value: unknown): InvitePreview {
  if (
    !isRecord(value) ||
    typeof value.expiresAt !== "number" ||
    !Number.isSafeInteger(value.expiresAt) ||
    value.expiresAt <= 0 ||
    value.expiresAt > 8_640_000_000_000_000
  )
    throw new Error("잘못된 초대 응답입니다.");
  const { name, character } = parseProfile({ ...value, status: "" });
  return { name, character, expiresAt: value.expiresAt };
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
  let messages: ChatMessage[] | undefined;
  if (value.messages !== undefined) {
    if (
      !Array.isArray(value.messages) ||
      value.messages.length > CHAT_HISTORY_LIMIT
    )
      throw new Error("잘못된 채팅 목록입니다.");
    let previousId = 0;
    messages = value.messages.map((input) => {
      const message = parseChatMessage(input);
      if (!ids.has(message.senderId) || message.id <= previousId)
        throw new Error("잘못된 채팅 순서 또는 보낸 사람입니다.");
      if (
        message.recipientId !== undefined &&
        (!ids.has(message.recipientId) ||
          (message.senderId !== self.id && message.recipientId !== self.id))
      )
        throw new Error("잘못된 1:1 채팅 받는 사람입니다.");
      previousId = message.id;
      return message;
    });
  }
  if (value.directChat !== undefined && value.directChat !== true)
    throw new Error("잘못된 1:1 채팅 지원 응답입니다.");
  let unreadChatIds: number[] | undefined;
  if (value.unreadChatIds !== undefined) {
    unreadChatIds = parseChatMessageIds(value.unreadChatIds);
    const received = new Set(
      messages
        ?.filter((message) => message.senderId !== self.id)
        .map((message) => message.id),
    );
    if (!messages || unreadChatIds.some((id) => !received.has(id)))
      throw new Error("잘못된 새 채팅 메시지 응답입니다.");
  }
  const blocking =
    value.blocking === undefined
      ? undefined
      : parseBlockingSettings(value.blocking);
  if (blocking?.profiles.some((profile) => ids.has(profile.id)))
    throw new Error("차단한 프로필이 친구 목록에 포함되어 있습니다.");
  return {
    self,
    friends,
    ...(messages === undefined ? {} : { messages }),
    ...(value.directChat === true ? { directChat: true as const } : {}),
    ...(unreadChatIds === undefined ? {} : { unreadChatIds }),
    ...(blocking === undefined ? {} : { blocking }),
    ...(value.presence === undefined
      ? {}
      : { presence: parsePresenceSettings(value.presence) }),
  };
}
