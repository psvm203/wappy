/** Retained only to migrate old profiles; these characters are no longer selectable. */
export const REMOVED_CHARACTERS: readonly string[] = [
  "bunny",
  "cat",
  "bear",
  "frog",
  "penguin",
  "otter",
];
export const CHARACTERS = [
  "chiikawa",
  "hachiware",
  "usagi",
  "momonga",
  "kurimanju",
  "rakko",
  "shisa",
  "furuhonya",
  "ironman",
  "captain-america",
  "thor",
  "hulk",
  "black-widow",
  "hawkeye",
  "pochacco",
  "badtz-maru",
  "hangyodon",
  "pekkle",
  "tuxedosam",
  "keroppi",
  "slime",
  "orange-mushroom",
  "pink-bean",
  "stone-spirit",
  "yeti",
  "shinchan",
  "kazama",
  "nene",
  "masao",
  "bochan",
] as const;
export type Character = (typeof CHARACTERS)[number];
export const CHARACTER_NAMES: Record<Character, string> = {
  chiikawa: "치이카와",
  hachiware: "하치와레",
  usagi: "우사기",
  momonga: "모몽가",
  kurimanju: "쿠리만쥬",
  rakko: "랏코",
  shisa: "시사",
  furuhonya: "후루혼야",
  ironman: "아이언맨",
  "captain-america": "캡틴 아메리카",
  thor: "토르",
  hulk: "헐크",
  "black-widow": "블랙 위도우",
  hawkeye: "호크아이",
  pochacco: "포차코",
  "badtz-maru": "배드바츠마루",
  hangyodon: "한교동",
  pekkle: "아히루노페클",
  tuxedosam: "턱시도샘",
  keroppi: "케로케로케로피",
  slime: "슬라임",
  "orange-mushroom": "주황버섯",
  "pink-bean": "핑크빈",
  "stone-spirit": "돌의 정령",
  yeti: "예티",
  shinchan: "짱구",
  kazama: "철수",
  nene: "유리",
  masao: "훈이",
  bochan: "맹구",
};
export const POLL_INTERVAL_MS = 5_000;
export const HEARTBEAT_INTERVAL_MS = 10_000;
export const ONLINE_TIMEOUT_MS = 30_000;
export const MAX_NAME_LENGTH = 24;
export const ATTACK_COOLDOWN_MS = 2_000;
export const ATTACK_TTL_MS = 15_000;
export const ATTACK_HISTORY_LIMIT = 50;
export interface AttackEvent {
  id: number;
  attackerId: string;
  targetId: string;
  sentAt: number;
}
export const MAX_CHAT_LENGTH = 200;
export const CHAT_HISTORY_LIMIT = 50;
export const CHAT_TTL_MS = 24 * 60 * 60 * 1_000;
export const CHAT_BUBBLE_MS = 5_000;
export const CHAT_COOLDOWN_MS = 1_000;
export interface ChatMessage {
  id: number;
  senderId: string;
  text: string;
  sentAt: number;
}

export interface ProfileInput {
  name: string;
  character: Character;
}
export interface Profile extends ProfileInput {
  id: string;
}
export interface Friend extends Profile {
  online: boolean;
}
interface Room {
  id: string;
  name: string;
  /** The room creator; absent on servers without owner-only removal. */
  ownerId?: string;
  /** Permanent room code, shared by all members; absent on older servers. */
  inviteCode?: string;
}
export interface SidebarState {
  self: Profile;
  friends: Friend[];
  /** The profile's current room; absent before joining or on older servers. */
  room?: Room;
  /** Private to the authenticated profile; absent on servers without this feature. */
  presence?: PresenceSettings;
  /** Absent on servers that do not support chat. */
  messages?: ChatMessage[];
  /** Recent attacks between self or visible friends; absent on servers without online attacks. */
  attacks?: AttackEvent[];
  /** Hits during the last absence, private to self; absent on older servers. */
  sleepHitCount?: number;
}
interface PresenceSettings {
  sharing: boolean;
  revision: number;
}
export interface Session {
  token: string;
  profile: Profile;
}
export interface Invite {
  code: string;
}
export interface InvitePreview {
  name: string;
  character: Character;
}
export interface ApiErrorBody {
  error: string;
}

/** The client and server share method, path, request and response types. */
interface ApiRoutes {
  "POST /session": { input: ProfileInput; output: Session };
  "GET /state": { input: undefined; output: SidebarState };
  /** GET /events streams personalized SidebarState snapshots using SSE. */
  "POST /heartbeat": { input: Record<string, never>; output: undefined };
  "POST /chat": { input: { text: string }; output: ChatMessage };
  "PATCH /profile": { input: ProfileInput; output: Profile };
  "PATCH /presence": { input: { sharing: boolean }; output: PresenceSettings };
  /** Compatibility lookup for older clients; never rotates the room's code. */
  "POST /invites": { input: Record<string, never>; output: Invite };
  "POST /invites/preview": { input: { code: string }; output: InvitePreview };
  "POST /invites/accept": { input: { code: string }; output: Profile };
  /** Only the current room's owner can remove another member from the room. */
  "POST /friends/remove": { input: { friendId: string }; output: { ok: true } };
  "POST /friends/attack": { input: { friendId: string }; output: AttackEvent };
}
export type Route = keyof ApiRoutes;
export type Input<R extends Route> = ApiRoutes[R]["input"];
export type Output<R extends Route> = ApiRoutes[R]["output"];

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseAttackEvent(value: unknown): AttackEvent {
  if (
    !isRecord(value) ||
    !Number.isSafeInteger(value.id) ||
    (value.id as number) <= 0 ||
    typeof value.attackerId !== "string" ||
    !value.attackerId ||
    value.attackerId.length > 128 ||
    typeof value.targetId !== "string" ||
    !value.targetId ||
    value.targetId.length > 128 ||
    value.attackerId === value.targetId ||
    !Number.isSafeInteger(value.sentAt) ||
    (value.sentAt as number) <= 0 ||
    (value.sentAt as number) > 8_640_000_000_000_000
  )
    throw new Error("잘못된 공격 응답입니다.");
  return {
    id: value.id as number,
    attackerId: value.attackerId,
    targetId: value.targetId,
    sentAt: value.sentAt as number,
  };
}

export function parseChatText(value: unknown): string {
  if (typeof value !== "string") throw new Error("채팅 내용을 입력해 주세요.");
  const text = value.replace(/\r\n?/g, "\n").trim();
  if (
    !text ||
    text.length > MAX_CHAT_LENGTH ||
    // oxlint-disable-next-line no-control-regex -- Reject control characters in untrusted display text.
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
    value.recipientId !== undefined ||
    typeof value.sentAt !== "number" ||
    !Number.isSafeInteger(value.sentAt) ||
    value.sentAt <= 0 ||
    value.sentAt > 8_640_000_000_000_000
  )
    throw new Error("잘못된 채팅 응답입니다.");
  return {
    id: value.id,
    senderId: value.senderId,
    text: parseChatText(value.text),
    sentAt: value.sentAt,
  };
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
    !CHARACTERS.includes(value.character as Character)
  ) {
    throw new Error("이름과 캐릭터를 확인해 주세요.");
  }
  const name = value.name.trim();
  if (
    !name ||
    name.length > MAX_NAME_LENGTH ||
    // oxlint-disable-next-line no-control-regex -- Reject control characters in untrusted display text.
    /[\u0000-\u001f\u007f]/.test(name)
  ) {
    throw new Error(`이름은 1–${MAX_NAME_LENGTH}자로 입력해 주세요.`);
  }
  return { name, character: value.character as Character };
}

/** Unknown characters in snapshots fall back locally; new writes stay strict. */
function parseProfileSnapshot(value: unknown): ProfileInput {
  return parseProfile(
    isRecord(value) &&
      typeof value.character === "string" &&
      value.character.trim() &&
      !CHARACTERS.includes(value.character as Character)
      ? { ...value, character: "chiikawa" }
      : value,
  );
}

export function parseInvitePreview(value: unknown): InvitePreview {
  if (!isRecord(value)) throw new Error("잘못된 초대 응답입니다.");
  const { name, character } = parseProfileSnapshot(value);
  return { name, character };
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
    return { id: input.id, ...parseProfileSnapshot(input) };
  }
  if (!isRecord(value) || !Array.isArray(value.friends))
    throw new Error("잘못된 친구 목록 응답입니다.");
  const self = profile(value.self);
  const ids = new Set([self.id]);
  const friends = value.friends.map((friend): Friend => {
    if (!isRecord(friend) || typeof friend.online !== "boolean")
      throw new Error("잘못된 접속 상태 응답입니다.");
    const parsed = profile(friend);
    if (ids.has(parsed.id)) throw new Error("중복된 친구 응답입니다.");
    ids.add(parsed.id);
    return { ...parsed, online: friend.online };
  });
  let room: Room | undefined;
  if (value.room !== undefined) {
    const input = value.room;
    if (
      !isRecord(input) ||
      typeof input.id !== "string" ||
      !input.id ||
      input.id.length > 128 ||
      typeof input.name !== "string" ||
      !input.name.trim() ||
      input.name.length > MAX_NAME_LENGTH + 3 ||
      // oxlint-disable-next-line no-control-regex -- Reject control characters in untrusted display text.
      /[\u0000-\u001f\u007f]/.test(input.name)
    )
      throw new Error("잘못된 방 응답입니다.");
    if (
      input.inviteCode !== undefined &&
      (typeof input.inviteCode !== "string" ||
        !/^[A-HJ-NP-Z2-9]{5}$/.test(input.inviteCode))
    )
      throw new Error("잘못된 방 초대 코드입니다.");
    if (
      input.ownerId !== undefined &&
      (typeof input.ownerId !== "string" ||
        !input.ownerId ||
        input.ownerId.length > 128)
    )
      throw new Error("잘못된 방장 정보입니다.");
    room = {
      id: input.id,
      name: input.name,
      ...(input.ownerId === undefined ? {} : { ownerId: input.ownerId }),
      ...(input.inviteCode === undefined
        ? {}
        : { inviteCode: input.inviteCode }),
    };
  }
  let messages: ChatMessage[] | undefined;
  if (value.messages !== undefined) {
    if (
      !Array.isArray(value.messages) ||
      value.messages.length > CHAT_HISTORY_LIMIT
    )
      throw new Error("잘못된 채팅 목록입니다.");
    let previousId = 0;
    // Older servers can still return private messages; never show them as broadcasts.
    messages = value.messages
      .filter((input) => !isRecord(input) || input.recipientId === undefined)
      .map((input) => {
        const message = parseChatMessage(input);
        if (!ids.has(message.senderId) || message.id <= previousId)
          throw new Error("잘못된 채팅 순서 또는 보낸 사람입니다.");
        previousId = message.id;
        return message;
      });
  }
  let attacks: AttackEvent[] | undefined;
  if (value.attacks !== undefined) {
    if (
      !Array.isArray(value.attacks) ||
      value.attacks.length > ATTACK_HISTORY_LIMIT
    )
      throw new Error("잘못된 공격 목록입니다.");
    let previousId = 0;
    attacks = value.attacks.map((input) => {
      const attack = parseAttackEvent(input);
      if (
        attack.id <= previousId ||
        !ids.has(attack.attackerId) ||
        !ids.has(attack.targetId)
      )
        throw new Error("잘못된 공격 참여자 또는 순서입니다.");
      previousId = attack.id;
      return attack;
    });
  }
  if (
    value.sleepHitCount !== undefined &&
    (typeof value.sleepHitCount !== "number" ||
      !Number.isSafeInteger(value.sleepHitCount) ||
      value.sleepHitCount < 0)
  )
    throw new Error("잘못된 수면 중 공격 횟수입니다.");
  return {
    self,
    friends,
    ...(value.sleepHitCount === undefined
      ? {}
      : { sleepHitCount: value.sleepHitCount }),
    ...(room === undefined ? {} : { room }),
    ...(attacks === undefined ? {} : { attacks }),
    ...(messages === undefined ? {} : { messages }),
    ...(value.presence === undefined
      ? {}
      : { presence: parsePresenceSettings(value.presence) }),
  };
}
