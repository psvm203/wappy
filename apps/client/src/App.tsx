import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent,
} from "react";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { exit } from "@tauri-apps/plugin-process";
import {
  parseSidebarState,
  parsePresenceSettings,
  parseChatMessage,
  parseAttackEvent,
  CHAT_HISTORY_LIMIT,
  type ProfileInput,
  type Session,
  type SidebarState,
} from "@wappy/api";
import {
  ApiError,
  DEFAULT_SERVER,
  SESSION_KEY,
  errorMessage,
  loadSession,
  previewInvitation,
  request,
  serverUrl,
} from "./api";
import { FriendCard } from "./FriendCard";
import { Character } from "./Character";
import {
  useCharacterPreferences,
  useDesktopSync,
  useResidentSelection,
} from "./desktop";
import {
  residentSelectionKey,
  toggleResidentVisibility,
} from "./resident-selection";
import { ProfileForm } from "./ProfileForm";
import { ChatBubble } from "./ChatBubble";
import { ChatComposer } from "./ChatComposer";
import { useChatComposer } from "./use-chat-composer";
import { latestChat } from "./chat";
import { useDesktopChatRequests } from "./chat-bridge";
import { InviteField } from "./InviteField";
import { InviteCode } from "./InviteCode";
import { StartupSettings } from "./StartupSettings";
import { UpdateSettings, useAppUpdates } from "./UpdateSettings";
import { filterFriends, type FriendView } from "./friend-filter";
import { reconcilePresence } from "./presence";
import { saveSession, type SavedSession } from "./sessions";
import { isLocalServer, parseInvitation, WAPPY_SERVER } from "./invitations";
import { subscribeState } from "./state-sync";
import { useDesktopAttackRequests } from "./attack-bridge";
import {
  CHARACTER_ACTIVITIES,
  CHARACTER_POSITIONS,
  CHARACTER_SIZES,
  isCharacterActivity,
  isCharacterPosition,
  isCharacterSize,
} from "./preferences";

const emptyProfile: ProfileInput = {
  name: "",
  character: "chiikawa",
};

function App() {
  const [session, setSession] = useState(loadSession);
  const currentSession = useRef(session);
  const stateRevision = useRef(0);
  const profileSave = useRef<Promise<void>>(Promise.resolve());
  const quitDialog = useRef<HTMLDialogElement>(null);
  const [profileDraft, setProfileDraft] = useState<ProfileInput | null>(null);
  const [presenceDraft, setPresenceDraft] = useState<boolean | null>(null);
  const [server, setServer] = useState(session?.server ?? DEFAULT_SERVER);
  const [onboarding, setOnboarding] = useState<"create" | "join">("create");
  const [serverState, setState] = useState<SidebarState | null>(null);
  const state = useMemo(
    () =>
      serverState && {
        ...serverState,
        self: profileDraft
          ? {
              ...serverState.self,
              ...profileDraft,
              name: profileDraft.name.trim() || serverState.self.name,
            }
          : serverState.self,
        presence:
          serverState.presence && presenceDraft !== null
            ? { ...serverState.presence, sharing: presenceDraft }
            : serverState.presence,
      },
    [serverState, profileDraft, presenceDraft],
  );
  const [panel, setPanel] = useState<
    "friends" | "invite" | "profile" | "settings"
  >("friends");
  const [code, setCode] = useState("");
  const [verifiedInvitation, setVerifiedInvitation] = useState("");
  const invitationSource = JSON.stringify([code, server]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [connection, setConnection] = useState<
    "connecting" | "online" | "offline" | "unauthorized"
  >("connecting");
  const [notice, setNotice] = useState("");
  const [removing, setRemoving] = useState<string | null>(null);
  const [friendView, setFriendView] = useState<FriendView>("all");
  const openSettings = useCallback(() => {
    setPanel("settings");
    setError("");
  }, []);
  const {
    preferences,
    setPreferences,
    error: preferencesError,
  } = useCharacterPreferences(openSettings);
  const { paused: motionPaused, visible: charactersVisible } = preferences;
  const desktop = isTauri();
  const updates = useAppUpdates(desktop);
  const profileKey =
    session && state
      ? residentSelectionKey(session.server, state.self.id)
      : null;
  const chat = useChatComposer(
    profileKey,
    state?.self.id,
    state ? latestChat(state.messages, state.self.id) : undefined,
    sendChat,
  );
  const selection = useResidentSelection(desktop ? profileKey : null);
  const chatError = useDesktopChatRequests(profileKey, sendChat);
  const syncError = useDesktopSync({
    state: session && selection.ready ? state : null,
    profileKey,
    connected: !!session && connection === "online",
    paused: motionPaused,
    visible: charactersVisible,
    hideSleeping: preferences.hideSleeping,
    position: preferences.position,
    size: preferences.size,
    activity: preferences.activity,
    hiddenIds: selection.hiddenIds,
  });
  const attackError = useDesktopAttackRequests(profileKey, async (friendId) => {
    if (
      !session ||
      currentSession.current !== session ||
      connection !== "online" ||
      !state ||
      state.attacks === undefined
    )
      throw new ApiError(503, "온라인 공격을 지원하는 서버에 연결해 주세요.");
    if (!state.friends.some((friend) => friend.id === friendId))
      throw new ApiError(404, "연결된 친구에게만 공격할 수 있어요.");
    if (state.presence?.sharing === false)
      throw new ApiError(409, "접속 상태를 공개해야 공격할 수 있어요.");
    const active = session;
    const event = parseAttackEvent(
      await request(active, "POST /friends/attack", { friendId }),
    );
    if (event.attackerId !== state.self.id || event.targetId !== friendId)
      throw new ApiError(502, "공격 전송 결과를 확인하지 못했어요.");
    if (currentSession.current !== active)
      throw new ApiError(
        409,
        "프로필이 바뀌었어요. 현재 프로필에서 다시 시도해 주세요.",
      );
    return event;
  });
  const desktopError =
    preferencesError ||
    selection.error ||
    chatError ||
    attackError ||
    syncError;

  function changeSession(next: SavedSession | null) {
    // Invalidate old callbacks immediately, before React runs effect cleanup.
    currentSession.current = next;
    stateRevision.current++;
    setSession(next);
    setProfileDraft(null);
    setPresenceDraft(null);
    setVerifiedInvitation("");
    setFriendView("all");
    chat.close();
  }

  function applyState(next: SidebarState) {
    stateRevision.current++;
    setState((current) => reconcilePresence(current, next));
  }

  async function sendChat(text: string) {
    if (
      !session ||
      currentSession.current !== session ||
      connection !== "online" ||
      state?.messages === undefined
    )
      throw new ApiError(503, "서버에 다시 연결된 뒤 보내 주세요.");
    const active = session;
    const message = parseChatMessage(
      await request(active, "POST /chat", { text }),
    );
    if (message.senderId !== state.self.id)
      throw new ApiError(502, "메시지 전송 결과를 확인하지 못했어요.");
    if (currentSession.current !== active)
      throw new ApiError(
        409,
        "프로필이 바뀌었어요. 현재 프로필에서 다시 보내 주세요.",
      );
    setState((current) =>
      current
        ? {
            ...current,
            messages: [
              ...(current.messages ?? []).filter(
                (item) => item.id !== message.id,
              ),
              message,
            ]
              .sort((a, b) => a.id - b.id)
              .slice(-CHAT_HISTORY_LIMIT),
          }
        : current,
    );
    return message;
  }

  function chatComposer(id: string) {
    return (
      chat.target === id &&
      state && (
        <ChatComposer
          key={profileKey ?? state.self.id}
          connected={connection === "online" && state.messages !== undefined}
          initialText={chat.initialText}
          initialError={chat.initialError}
          onSend={chat.send}
          onClose={chat.close}
        />
      )
    );
  }

  useEffect(() => {
    if (!session) return;
    return subscribeState(session, (update) => {
      if (currentSession.current !== session) return;
      if (update.connection === "online" && update.state)
        applyState(update.state);
      setConnection(update.connection);
    });
  }, [session]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(
      () => setNotice(""),
      notice === "초대 코드를 복사했어요." ? 2000 : 5000,
    );
    return () => window.clearTimeout(timer);
  }, [notice]);

  async function action(work: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await work();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  async function refresh(active = session) {
    if (active) {
      const revision = stateRevision.current;
      const next = parseSidebarState(
        await request(active, "GET /state", undefined),
      );
      // A delayed HTTP response must not overwrite a newer streamed snapshot.
      if (
        currentSession.current?.server === active.server &&
        currentSession.current?.token === active.token &&
        stateRevision.current === revision
      ) {
        applyState(next);
        setConnection("online");
      }
      return next;
    }
  }

  function connectSession(address: string, created: Session) {
    const saved = { server: address, token: created.token };
    changeSession(saved);
    setServer(address);
    setState({ self: created.profile, friends: [] });
    setCode("");
    setRemoving(null);
    setPanel("friends");
    setConnection("online");
    try {
      saveSession({ ...saved, profile: created.profile });
    } catch {
      setError(
        "프로필을 기기에 저장하지 못했습니다. 앱을 닫으면 로그인 정보가 사라질 수 있어요. 기기 저장 공간과 저장소 접근을 확인해 주세요.",
      );
    }
  }

  function showOnboarding() {
    changeSession(null);
    setState(null);
    setCode("");
    setRemoving(null);
    setOnboarding("create");
    setConnection("connecting");
    setPanel("friends");
    setNotice("");
    setError("");
  }

  function selectedServer() {
    try {
      return serverUrl(server);
    } catch {
      throw new ApiError(
        400,
        "올바른 서버 주소를 입력해 주세요. 예: http://localhost:3001",
      );
    }
  }

  function updateProfile(profile: ProfileInput) {
    if (session && currentSession.current === session) setProfileDraft(profile);
    // Keep writes ordered even when the editor is closed and reopened.
    const save = profileSave.current
      .catch(() => {})
      .then(async () => {
        if (!session || currentSession.current !== session)
          throw new ApiError(409, "현재 프로필에서 다시 시도해 주세요.");
        const revision = stateRevision.current;
        const updated = parseSidebarState({
          self: await request(session, "PATCH /profile", profile),
          friends: [],
        }).self;
        if (updated.id !== state?.self.id)
          throw new ApiError(502, "프로필 저장 결과를 확인하지 못했어요.");
        if (
          currentSession.current !== session ||
          stateRevision.current !== revision
        )
          return;
        setState((current) =>
          current ? { ...current, self: updated } : current,
        );
      });
    const completed = save.finally(() => {
      if (currentSession.current === session)
        setProfileDraft((current) => (current === profile ? null : current));
    });
    profileSave.current = completed;
    return completed;
  }

  function toggleSleep() {
    if (
      !session ||
      currentSession.current !== session ||
      connection !== "online" ||
      !state?.presence
    )
      return;
    const sharing = !state.presence.sharing;
    void action(async () => {
      // Preview locally while the subscription updates the confirmed server state.
      setPresenceDraft(sharing);
      try {
        const presence = parsePresenceSettings(
          await request(session, "PATCH /presence", { sharing }),
        );
        if (currentSession.current !== session) return;
        setState((current) =>
          current
            ? reconcilePresence(current, { ...current, presence })
            : current,
        );
      } finally {
        if (currentSession.current === session) setPresenceDraft(null);
      }
    });
  }

  function createProfile(profile: ProfileInput) {
    void action(async () => {
      const received = onboarding === "join" ? receivedInvitation() : null;
      const address = received?.server ?? selectedServer();
      if (received) {
        if (verifiedInvitation !== invitationSource)
          throw new ApiError(400, "초대장을 먼저 확인해 주세요.");
        try {
          // A preview does not reserve the code. Check again before creating a profile.
          await previewInvitation(address, received.code);
        } catch (cause) {
          setVerifiedInvitation("");
          throw cause;
        }
      }
      const created = await request(
        { server: address },
        "POST /session",
        profile,
      );
      connectSession(address, created);
      if (received) {
        // Save the new session before accepting: failed acceptance must stay retryable.
        setCode(code);
        setPanel("invite");
        try {
          await joinRoom(
            { server: address, token: created.token },
            received.code,
          );
        } catch (cause) {
          throw new ApiError(
            400,
            `프로필은 만들었어요. 방 참여 결과를 확인하지 못했습니다. ${errorMessage(cause)}`,
          );
        }
        return;
      }
      setNotice("프로필을 만들었어요. 친구를 초대해 보세요.");
    });
  }

  function receivedInvitation() {
    try {
      return parseInvitation(code);
    } catch (cause) {
      throw new ApiError(400, (cause as Error).message);
    }
  }

  async function joinRoom(
    current: { server: string; token: string },
    inviteCode: string,
  ) {
    await request(current, "POST /invites/accept", {
      code: inviteCode,
    });
    setCode("");
    setNotice("방에 참여했어요. 같은 방의 친구들을 함께 만나요.");
    setPanel("friends");
    setFriendView("all");
    await refresh(current);
  }

  function acceptInvite(event: FormEvent) {
    event.preventDefault();
    if (!session) return;
    void action(async () => {
      const received = receivedInvitation();
      if (received.server && received.server !== session.server)
        throw new ApiError(
          400,
          "다른 서버의 초대장이에요. 현재 프로필과 같은 서버의 초대장을 받아 주세요.",
        );
      await joinRoom(session, received.code);
    });
  }

  async function windowAction(work: () => Promise<unknown>) {
    try {
      await work();
    } catch {
      setError("창 설정을 바꾸지 못했습니다. 다시 시도해 주세요.");
    }
  }
  function dragWindow(event: MouseEvent<HTMLElement>) {
    if (
      !desktop ||
      event.button !== 0 ||
      (event.target as HTMLElement).closest("button")
    )
      return;
    event.preventDefault();
    void windowAction(() => getCurrentWindow().startDragging());
  }
  const onlineCount =
    connection === "online"
      ? (state?.friends.filter((friend) => friend.online).length ?? 0)
      : 0;
  const listedFriends = filterFriends(
    state?.friends ?? [],
    friendView,
    connection === "online",
  );
  function characterVisibility(profile: { id: string; name: string }) {
    if (!desktop || !state) return null;
    const visible =
      charactersVisible && !selection.hiddenIds.includes(profile.id);
    return (
      <button
        type="button"
        className="
          character-visibility flex min-h-[30px] min-w-[55px] shrink-0 items-center justify-center
          gap-[5px] rounded-[16px] bg-[#e2e5db] p-[6px_8px] text-[10px] font-bold text-[#68745e]
          before:h-[10px] before:w-[10px] before:shrink-0 before:rounded-[50%] before:bg-[currentColor]
          before:content-[''] disabled:cursor-wait
          disabled:opacity-50 [&[aria-checked='true']]:bg-[#526c49] [&[aria-checked='true']]:text-[#fff]
        "
        role="switch"
        aria-label={`${profile.name} 캐릭터 표시`}
        aria-checked={selection.ready && visible}
        disabled={!selection.ready}
        title={visible ? "바탕화면에서 숨기기" : "바탕화면에 표시"}
        onClick={() => {
          selection.setHiddenIds((current) =>
            toggleResidentVisibility(
              state,
              current,
              charactersVisible,
              profile.id,
            ),
          );
          if (!charactersVisible)
            setPreferences((current) => ({ ...current, visible: true }));
        }}
      >
        {selection.ready ? (visible ? "ON" : "OFF") : "…"}
      </button>
    );
  }
  const sleeping = state?.presence?.sharing === false;
  const errorAlert = error && (
    <p
      className="
        error flex items-start gap-[5px] rounded-[9px] bg-[#f6e9df] p-[11px] text-[11px]
        leading-[1.65] wrap-anywhere text-[#9b6556] [&_button]:ml-auto [&_button]:bg-transparent [&_button]:p-[0_2px]
        [&_button]:text-inherit
      "
      role="alert"
    >
      {error}
      <button type="button" aria-label="오류 닫기" onClick={() => setError("")}>
        ×
      </button>
    </p>
  );

  return (
    <main
      className="
        sidebar relative flex h-dvh w-full flex-col overflow-hidden rounded-[22px] border
        border-solid border-[#e2e4db] bg-[#fbfbf7]
      "
    >
      <header
        className="
          app-header flex shrink-0 cursor-grab items-center justify-between p-[22px_20px_14px]
          select-none
        "
        onMouseDown={dragWindow}
        title="드래그해서 앱 이동"
      >
        <div className="brand flex cursor-grab items-center gap-[8px] text-[27px] font-[850] tracking-[-1.5px]">
          <span
            className="brand-icon text-[31px] leading-[1] text-[#638766]"
            aria-hidden="true"
          >
            ✳
          </span>
          <span>
            wappy<span className="brand-period text-[#8aaa70]">.</span>
          </span>
        </div>
        {desktop && (
          <div
            className="
              window-controls flex cursor-default gap-[6px] [&_.icon-button]:border
              [&_.icon-button]:border-solid [&_.icon-button]:border-[currentColor]
              [&_.quit-button]:text-[#b94343]
            "
          >
            <button
              className="
                icon-button grid h-[28px] w-[27px] place-items-center rounded-[8px] bg-transparent p-0
                text-[19px] text-[#68745e] [&:hover]:bg-[#e8eade] [&:hover]:text-[#343c31]
              "
              aria-label="최소화"
              title="최소화"
              onClick={() =>
                void windowAction(() => getCurrentWindow().minimize())
              }
            >
              −
            </button>
            <button
              type="button"
              className="
                icon-button quit-button grid h-[28px] w-[27px] place-items-center rounded-[8px] bg-transparent
                p-0 text-[19px] text-[#68745e] [&:hover]:bg-[#e8eade] [&:hover]:text-[#343c31]
              "
              onClick={() => quitDialog.current?.showModal()}
              disabled={busy || profileDraft !== null}
              aria-label="Wappy 종료"
              title="Wappy 종료"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden="true"
                focusable="false"
              >
                <path d="M18.36 6.64a9 9 0 1 1-12.73 0M12 2v10" />
              </svg>
            </button>
          </div>
        )}
      </header>

      {desktop && updates.version && panel !== "settings" && (
        <div className="update-banner m-[0_20px_12px] shrink-0">
          <UpdateSettings
            state={updates}
            disabled={busy || profileDraft !== null}
          />
        </div>
      )}

      {!session && panel !== "settings" ? (
        <div
          className="
            onboarding scroll-area min-h-0 [scrollbar-width:thin] [scrollbar-color:#d8ddd0_transparent]
            overflow-y-auto p-[0_22px_24px]
          "
        >
          <div
            className="
              intro-art relative flex justify-center p-[18px_0_20px] [&_.character]:w-[92px]
              [&_.character_+_.character]:ml-[-8px]
              [&_.character_+_.character]:[transform:rotate(8deg)_translateY(4px)]
              [@media(max-height:650px)]:p-[4px_0_14px]
              [@media(max-height:650px)]:[&_.character]:w-[65px]
            "
          >
            <Character kind="chiikawa" />
            <Character kind="hachiware" />
            <span
              className="sparkle absolute top-[6px] right-[40px] text-[35px] text-[#9bab73]"
              aria-hidden="true"
            >
              ✧
            </span>
          </div>
          <nav
            className="
              onboarding-tabs [&_[aria-current='page']]:rounded-0 mb-[24px] flex justify-center
              gap-[15px] [&_[aria-current='page']]:border-b-[2px]
              [&_[aria-current='page']]:[border-bottom-style:solid]
              [&_[aria-current='page']]:border-b-[#678b57] [&_[aria-current='page']]:font-bold
              [&_[aria-current='page']]:text-[#374936]
            "
            aria-label="시작 방법"
          >
            {(
              [
                ["create", "처음이에요"],
                ["join", "초대받았어요"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                className="
                  text-button bg-transparent p-[3px_0] text-[11px] text-[#68745e]
                  [&:hover]:text-[#41562e]
                "
                aria-current={onboarding === id ? "page" : undefined}
                disabled={busy}
                onClick={() => {
                  setOnboarding(id);
                  if (onboarding !== id) setVerifiedInvitation("");
                  setError("");
                }}
              >
                {label}
              </button>
            ))}
          </nav>
          <ProfileForm
            initial={emptyProfile}
            busy={busy}
            onSave={createProfile}
            canSave={
              onboarding !== "join" || verifiedInvitation === invitationSource
            }
            beforeProfile={
              onboarding === "join" && (
                <InviteField
                  value={code}
                  onChange={(value) => {
                    setCode(value);
                    try {
                      const destination = parseInvitation(value).server;
                      if (destination) setServer(destination);
                    } catch {
                      /* Validate on submit. */
                    }
                  }}
                  server={server}
                  onVerified={(source) => {
                    setVerifiedInvitation(source);
                    if (source) setError("");
                  }}
                />
              )
            }
          />
          {error && (
            <p
              className="
                error flex items-start gap-[5px] rounded-[9px] bg-[#f6e9df] p-[11px]
                text-[11px] leading-[1.65] wrap-anywhere text-[#9b6556] [&_button]:ml-auto
                [&_button]:bg-transparent [&_button]:p-[0_2px] [&_button]:text-inherit
              "
              role="alert"
            >
              {error}
            </p>
          )}
        </div>
      ) : (
        <>
          {session && connection !== "online" && (
            <div className="connection-line flex items-center gap-[7px] p-[0_22px_19px] text-[11px] text-[#68745e]">
              <span
                className="
                  online-dot offline inline-block h-[6px] w-[6px] shrink-0 rounded-[50%] bg-[#71a46b]
                  [&.offline]:bg-[#b6b9b0]
                "
              />
              {connection === "connecting"
                ? "아지트에 들어가는 중…"
                : connection === "unauthorized"
                  ? "프로필 인증이 만료되었어요"
                  : "연결을 다시 확인하는 중…"}
            </div>
          )}
          {session && connection === "offline" && (
            <div
              className="
                connection-warning m-[0_20px_12px] shrink-0 rounded-[9px] bg-[#f6e9df] p-[11px]
                text-[11px] leading-[1.65] wrap-anywhere text-[#9b6556] [&_p:not(.chat-bubble)]:m-[0_0_8px]
              "
              role="status"
            >
              <p>서버와 연결이 끊겼어요. 자동으로 다시 연결합니다.</p>
            </div>
          )}
          {session && connection === "unauthorized" && (
            <div
              className="
                connection-warning m-[0_20px_12px] shrink-0 rounded-[9px] bg-[#f6e9df] p-[11px]
                text-[11px] leading-[1.65] wrap-anywhere text-[#9b6556] [&_p:not(.chat-bubble)]:m-[0_0_8px]
              "
              role="alert"
            >
              <p>
                프로필 인증에 실패했어요. 연결할 서버 주소가 맞는지 확인해
                주세요.
              </p>
              <details>
                <summary>이 기기에서 다시 시작하기</summary>
                <p>
                  새 프로필로 시작할 수 있어요. 유효한 로그인 정보가 없으면 기존
                  프로필로 돌아올 수 없어요.
                </p>
                <button
                  className="
                    text-button danger bg-transparent p-[3px_0] text-[11px] text-[#ab5555]
                    [&:hover]:text-[#41562e]
                  "
                  disabled={busy}
                  onClick={() => {
                    try {
                      localStorage.removeItem(SESSION_KEY);
                    } catch {
                      setError(
                        "이 기기의 로그인 정보를 지우지 못했습니다. 다시 시도해 주세요.",
                      );
                      return;
                    }
                    showOnboarding();
                  }}
                >
                  시작 화면으로 이동
                </button>
              </details>
            </div>
          )}
          {session &&
            connection === "online" &&
            state?.sleepHitCount !== undefined && (
              <p
                className="m-[0_20px_12px] shrink-0 rounded-[9px] bg-[#edf1e5] p-[10px_12px] text-[12px] text-[#536447]"
                role="status"
              >
                자다가 맞은 횟수: {state.sleepHitCount}회
              </p>
            )}
          <nav
            className="
              tabs [&_button]:rounded-0 m-[0_20px_12px] flex shrink-0 gap-[18px]
              border-b [border-bottom-style:solid] border-b-[#e6e8df] [&_button]:border-b-[2px] [&_button]:[border-bottom-style:solid]
              [&_button]:border-b-[transparent] [&_button]:bg-transparent [&_button]:p-[11px_0]
              [&_button]:text-[12px] [&_button]:text-[#68745e]
              [&_button.selected]:border-b-[#678b57] [&_button.selected]:font-bold
              [&_button.selected]:text-[#374936]
            "
            aria-label="사이드바 메뉴"
          >
            {(
              [
                ["friends", session ? "친구들" : "시작 화면"],
                ["invite", "초대"],
                ["profile", "내 모습"],
                ["settings", "설정"],
              ] as const
            )
              .filter(
                ([id]) => session || id === "friends" || id === "settings",
              )
              .map(([id, label]) => (
                <button
                  key={id}
                  aria-current={panel === id ? "page" : undefined}
                  id={`sidebar-tab-${id}`}
                  className={panel === id ? "selected" : ""}
                  onClick={() => {
                    setPanel(id);
                    setError("");
                  }}
                >
                  {label}
                </button>
              ))}
          </nav>
          <div
            className="
              scroll-area content min-h-0 flex-1 [scrollbar-width:thin]
              [scrollbar-color:#d8ddd0_transparent] overflow-y-auto p-[14px_20px_20px]
            "
          >
            {desktopError && (
              <p
                className="
                  error flex items-start gap-[5px] rounded-[9px] bg-[#f6e9df] p-[11px]
                  text-[11px] leading-[1.65] wrap-anywhere text-[#9b6556] [&_button]:ml-auto
                  [&_button]:bg-transparent [&_button]:p-[0_2px] [&_button]:text-inherit
                "
                role="alert"
              >
                {desktopError}
              </p>
            )}
            {(!state || panel !== "invite") && errorAlert}
            {!state &&
              (panel === "friends" || panel === "invite") &&
              connection !== "unauthorized" && (
                <div
                  className="
                    empty-state p-[35px_2px_20px] text-center [&_.primary]:mt-[24px] [&_h2]:m-[21px_0_10px]
                    [&_h2]:text-[17px] [&_h2]:tracking-[-0.7px]
                    [&_p:not(.chat-bubble)]:text-[12px] [&_p:not(.chat-bubble)]:leading-[1.9]
                    [&_p:not(.chat-bubble)]:wrap-anywhere [&_p:not(.chat-bubble)]:text-[#68745e]
                  "
                >
                  <span
                    className="
                      loading-orbit inline-block h-[24px] w-[24px] animate-spin rounded-[50%]
                      border-[2px] border-solid border-[#e0e6d6] [border-top-color:#819c65]
                    "
                  />
                  <h2>친구들을 만나러 가는 중</h2>
                </div>
              )}
            {session && state && panel === "friends" && (
              <>
                {state.friends.length > 0 && (
                  <section
                    className="friend-filters mb-[16px]"
                    aria-label="친구 목록 필터"
                  >
                    <div
                      className="
                        friend-views flex gap-[5px] [&_button]:flex-1 [&_button]:rounded-[8px]
                        [&_button]:bg-[#f0f1e9] [&_button]:p-[9px_5px] [&_button]:text-[11px]
                        [&_button]:whitespace-nowrap [&_button]:text-[#68745e]
                        [&_button[aria-pressed='true']]:bg-[#e3edd3]
                        [&_button[aria-pressed='true']]:font-bold
                        [&_button[aria-pressed='true']]:text-[#374936] [&_span]:text-[10px]
                      "
                      role="group"
                      aria-label="친구 목록 보기"
                    >
                      {(
                        [
                          ["all", "전체", state.friends.length],
                          ["online", "접속 중", onlineCount],
                        ] as const
                      ).map(([view, label, count]) => (
                        <button
                          key={view}
                          id={`friend-view-${view}`}
                          aria-pressed={friendView === view}
                          onClick={() => setFriendView(view)}
                        >
                          {label} <span>{count}</span>
                        </button>
                      ))}
                    </div>
                  </section>
                )}
                {state.friends.length === 0 ? (
                  <div
                    className="
                      empty-state invitation-empty p-[35px_2px_20px] pt-0 text-center
                      [&_.primary]:mt-[24px] [&_h2]:m-[21px_0_10px]
                      [&_h2]:mt-[12px] [&_h2]:text-[17px]
                      [&_h2]:tracking-[-0.7px] [&_p:not(.chat-bubble)]:text-[12px]
                      [&_p:not(.chat-bubble)]:leading-[1.9] [&_p:not(.chat-bubble)]:wrap-anywhere [&_p:not(.chat-bubble)]:text-[#68745e]
                    "
                  >
                    <h2>옆자리를 비워뒀어요.</h2>
                    <p>
                      친구를 초대하면 이곳에서
                      <br />
                      서로의 캐릭터를 만날 수 있어요.
                    </p>
                    <button
                      className="
                        primary flex w-full items-center justify-between rounded-[10px] bg-[#d3e8af]
                        p-[13px_14px] text-[12px] font-semibold text-[#425335] [&_span]:text-[18px]
                        [&_span]:leading-[1] [&_span]:font-normal [&:hover]:bg-[#c7dda1]
                      "
                      onClick={() => setPanel("invite")}
                    >
                      친구 초대하기 <span aria-hidden="true">+</span>
                    </button>
                  </div>
                ) : listedFriends.length === 0 ? (
                  <div
                    className="
                      empty-state friend-filter-empty p-[35px_2px_20px] text-center [&_.primary]:mt-[24px]
                      [&_h2]:m-[21px_0_10px] [&_h2]:text-[17px]
                      [&_h2]:tracking-[-0.7px] [&_p:not(.chat-bubble)]:text-[12px]
                      [&_p:not(.chat-bubble)]:leading-[1.9] [&_p:not(.chat-bubble)]:wrap-anywhere
                      [&_p:not(.chat-bubble)]:text-[#68745e]
                    "
                  >
                    <h2>
                      {friendView === "online" && connection !== "online"
                        ? "접속 상태를 확인할 수 없어요."
                        : "지금 접속 중인 친구가 없어요."}
                    </h2>
                    <p>
                      {friendView === "online" && connection !== "online"
                        ? "다시 연결되면 접속 중인 친구가 표시돼요. 전체 목록은 계속 볼 수 있어요."
                        : "전체 목록으로 바꾸면 모든 친구를 볼 수 있어요."}
                    </p>
                  </div>
                ) : (
                  <ul className="friend-list m-0 flex list-none flex-col gap-[11px] p-0">
                    {listedFriends.map((friend) => (
                      <FriendCard
                        key={friend.id}
                        friend={friend}
                        connected={connection === "online"}
                        message={latestChat(state.messages, friend.id)}
                        busy={busy}
                        canKick={state.room?.ownerId === state.self.id}
                        removing={removing === friend.id}
                        onRemovingChange={(removing) =>
                          setRemoving(removing ? friend.id : null)
                        }
                        onRemove={() =>
                          void action(async () => {
                            await request(session, "POST /friends/remove", {
                              friendId: friend.id,
                            });
                            setRemoving(null);
                            await refresh();
                          })
                        }
                      >
                        {characterVisibility(friend)}
                      </FriendCard>
                    ))}
                  </ul>
                )}
              </>
            )}
            {session && state && panel === "invite" && (
              <div>
                <section
                  className="
                    invite-card rounded-[15px] border
                    border-solid border-[#e5e9db]
                    bg-[#f0f3e8] p-[20px_16px_13px] [&_>_p:not(.hint)]:m-[10px_0_17px] [&_>_p:not(.hint)]:text-[11px]
                    [&_>_p:not(.hint)]:leading-[1.8] [&_>_p:not(.hint)]:text-[#68745e] [&_h2]:text-[13px] [&.update-panel]:mt-[12px]
                    [&.update-panel]:pt-[12px] [&.update-panel]:text-[12px]
                    [&.update-panel_>_p[role='status']]:mt-0 [&.update-panel_>_p[role='status']]:text-[#000]
                  "
                >
                  <h2>방 초대 코드</h2>
                  <p>
                    {state.room && (
                      <>
                        현재 방: <strong>{state.room.name}</strong>
                        <br />
                      </>
                    )}
                    참여자 누구나 같은 방으로 초대할 수 있어요.
                  </p>
                  <InviteCode
                    key={`${profileKey}:${state.room?.id ?? ""}`}
                    session={session}
                    code={state.room?.inviteCode}
                    onCopied={() => setNotice("초대 코드를 복사했어요.")}
                  />
                  {session.server !== WAPPY_SERVER && (
                    <p
                      className="
                        hint server-address mt-[17px] border-t [border-top-style:dashed] border-t-[#d8dfcb]
                        pt-[14px] text-[10px] leading-[1.7] wrap-anywhere text-[#68745e]
                        [&_strong]:font-medium
                      "
                    >
                      친구도 같은 서버에 연결해야 해요.
                      <br />
                      <strong>{session.server}</strong>
                    </p>
                  )}
                  {isLocalServer(session.server) && (
                    <p className="hint text-[10px] leading-[1.7] text-[#68745e]">
                      현재 주소는 이 컴퓨터 안에서만 사용할 수 있어요. 다른
                      기기의 친구와 함께하려면 둘 다 접속할 수 있는 서버에서
                      시작해 주세요.
                    </p>
                  )}
                </section>
                <form
                  onSubmit={acceptInvite}
                  className="accept-form mt-[28px] [&_.field]:mt-[19px] [&_>_.error]:mt-[12px] [&_h2]:text-[13px]"
                >
                  <h2>초대를 받았나요?</h2>
                  <InviteField
                    value={code}
                    onChange={setCode}
                    server={session.server}
                    busy={busy}
                    sameServer
                  />
                  <button
                    className="
                      secondary w-full rounded-[10px] bg-[#e8eede] p-[13px_14px] text-[12px]
                      font-semibold text-[#526a3d] [&:hover]:bg-[#dee7ce]
                    "
                    disabled={busy || !code.trim()}
                    type="submit"
                  >
                    {busy ? "참여하는 중…" : "방에 참여하기"}
                  </button>
                  {errorAlert}
                  {state.room && (
                    <p className="hint text-[10px] leading-[1.7] text-[#68745e]">
                      다른 방의 초대를 수락하면 현재 방에서 나가고 새 방의
                      친구들과 함께하게 돼요.
                    </p>
                  )}
                </form>
              </div>
            )}
            {state && panel === "profile" && (
              <ProfileForm
                key={profileKey}
                initial={profileDraft ?? state.self}
                busy={busy}
                onChange={setProfileDraft}
                onSave={updateProfile}
                autoSave
                beforeProfile={
                  <button
                    type="button"
                    className="
                      secondary mb-[20px] w-full rounded-[10px] bg-[#e8eede] p-[13px_14px]
                      text-[12px] font-semibold text-[#526a3d] aria-pressed:bg-[#d3e8af]
                      [&:hover]:bg-[#dee7ce]
                    "
                    aria-pressed={sleeping}
                    disabled={
                      busy ||
                      !session ||
                      connection !== "online" ||
                      !state.presence
                    }
                    onClick={toggleSleep}
                  >
                    {sleeping ? "일어나기" : "자는 척하기"}
                  </button>
                }
              />
            )}
            {panel === "settings" && (
              <section
                className="
                  settings-panel [&_>_.field]:mt-0 [&_>_.field]:flex [&_>_.field]:items-center
                  [&_>_.field]:justify-between [&_>_.field]:gap-[12px] [&_>_.field_select]:mt-0
                  [&_>_.field_select]:w-[100px] [&_>_.setting-toggle]:m-[0_0_15px]
                  [&_>_.startup-panel]:mt-0
                "
                aria-label="앱 설정"
              >
                {desktop ? (
                  <>
                    <label
                      className="
                        field m-[15px_0] block text-[11px] text-[#68725d]
                        [&_:is(input,select,textarea)]:mt-[8px] [&_:is(input,select,textarea)]:block
                        [&_:is(input,select,textarea)]:w-full [&_:is(input,select,textarea)]:rounded-[9px]
                        [&_:is(input,select,textarea)]:border [&_:is(input,select,textarea)]:border-solid
                        [&_:is(input,select,textarea)]:border-[#e0e5d8]
                        [&_:is(input,select,textarea)]:bg-[#f4f5ef]
                        [&_:is(input,select,textarea)]:p-[12px]
                        [&_:is(input,select,textarea)]:text-[12px]
                        [&_:is(input,select,textarea)]:text-[#3e4935] [&_input::placeholder]:text-[11px]
                        [&_input::placeholder]:text-[#68745e] [&_textarea]:resize-y
                        [&_textarea]:leading-[1.6] [&_textarea]:wrap-anywhere
                      "
                    >
                      캐릭터 위치
                      <select
                        value={preferences.position}
                        onChange={(event) => {
                          const position = event.target.value;
                          if (isCharacterPosition(position))
                            setPreferences((current) => ({
                              ...current,
                              position,
                            }));
                        }}
                      >
                        {Object.entries(CHARACTER_POSITIONS).map(
                          ([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ),
                        )}
                      </select>
                    </label>
                    <label
                      className="
                        field m-[15px_0] block text-[11px] text-[#68725d]
                        [&_:is(input,select,textarea)]:mt-[8px] [&_:is(input,select,textarea)]:block
                        [&_:is(input,select,textarea)]:w-full [&_:is(input,select,textarea)]:rounded-[9px]
                        [&_:is(input,select,textarea)]:border [&_:is(input,select,textarea)]:border-solid
                        [&_:is(input,select,textarea)]:border-[#e0e5d8]
                        [&_:is(input,select,textarea)]:bg-[#f4f5ef]
                        [&_:is(input,select,textarea)]:p-[12px]
                        [&_:is(input,select,textarea)]:text-[12px]
                        [&_:is(input,select,textarea)]:text-[#3e4935] [&_input::placeholder]:text-[11px]
                        [&_input::placeholder]:text-[#68745e] [&_textarea]:resize-y
                        [&_textarea]:leading-[1.6] [&_textarea]:wrap-anywhere
                      "
                    >
                      캐릭터 크기
                      <select
                        value={preferences.size}
                        onChange={(event) => {
                          const size = event.target.value;
                          if (isCharacterSize(size))
                            setPreferences((current) => ({
                              ...current,
                              size,
                            }));
                        }}
                      >
                        {Object.entries(CHARACTER_SIZES).map(
                          ([value, { label }]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ),
                        )}
                      </select>
                    </label>
                    <label
                      className="
                        field m-[15px_0] block text-[11px] text-[#68725d]
                        [&_:is(input,select,textarea)]:mt-[8px] [&_:is(input,select,textarea)]:block
                        [&_:is(input,select,textarea)]:w-full [&_:is(input,select,textarea)]:rounded-[9px]
                        [&_:is(input,select,textarea)]:border [&_:is(input,select,textarea)]:border-solid
                        [&_:is(input,select,textarea)]:border-[#e0e5d8]
                        [&_:is(input,select,textarea)]:bg-[#f4f5ef]
                        [&_:is(input,select,textarea)]:p-[12px]
                        [&_:is(input,select,textarea)]:text-[12px]
                        [&_:is(input,select,textarea)]:text-[#3e4935] [&_input::placeholder]:text-[11px]
                        [&_input::placeholder]:text-[#68745e] [&_textarea]:resize-y
                        [&_textarea]:leading-[1.6] [&_textarea]:wrap-anywhere
                      "
                    >
                      캐릭터 활동
                      <select
                        value={
                          preferences.paused ? "stopped" : preferences.activity
                        }
                        onChange={(event) => {
                          const activity = event.target.value;
                          if (
                            activity === "stopped" ||
                            isCharacterActivity(activity)
                          )
                            setPreferences((current) => ({
                              ...current,
                              paused: activity === "stopped",
                              activity:
                                activity === "stopped"
                                  ? current.activity
                                  : activity,
                            }));
                        }}
                      >
                        <option value="stopped">정지</option>
                        {Object.entries(CHARACTER_ACTIVITIES).map(
                          ([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ),
                        )}
                      </select>
                    </label>
                    <label
                      className="
                        setting-toggle mt-[15px] flex cursor-pointer items-center gap-[9px] text-[12px]
                        leading-[1.7] [&_input]:h-[16px] [&_input]:w-[16px] [&_input]:shrink-0
                        [&_input]:accent-[#678b57]
                      "
                    >
                      <input
                        type="checkbox"
                        checked={preferences.hideSleeping}
                        onChange={(event) => {
                          const hideSleeping = event.target.checked;
                          setPreferences((current) => ({
                            ...current,
                            hideSleeping,
                          }));
                        }}
                      />
                      자고 있는 캐릭터 숨기기
                    </label>
                    <StartupSettings />
                    <UpdateSettings
                      state={updates}
                      disabled={busy || profileDraft !== null}
                    />
                  </>
                ) : (
                  <p className="hint text-[10px] leading-[1.7] text-[#68745e]">
                    자동 실행과 앱 업데이트는 데스크톱 앱에서 설정할 수 있어요.
                  </p>
                )}
              </section>
            )}
          </div>
          {state && (
            <footer
              className="
                self-card m-[0_12px_12px] flex shrink-0 items-center gap-[8px]
                rounded-[14px] bg-[#e8eddc] p-[10px_12px_9px_4px] [&_.character]:w-[54px] [&_.character]:shrink-0
                [&_>_div_>_p:not(.chat-bubble)]:m-[6px_0_0]
                [&_>_div_>_p:not(.chat-bubble)]:overflow-hidden [&_>_div_>_p:not(.chat-bubble)]:text-[10px]
                [&_>_div_>_p:not(.chat-bubble)]:text-ellipsis [&_>_div_>_p:not(.chat-bubble)]:whitespace-nowrap
                [&_>_div_>_p:not(.chat-bubble)]:text-[#68745e]
                [&_>_div:not(.character-chat-anchor)]:min-w-0
                [&_>_div:not(.character-chat-anchor)]:flex-1
                [&_strong]:text-[12px]
                [&_strong]:wrap-anywhere
              "
            >
              <div
                className="
                  character-chat-anchor relative shrink-0 [&_>_.chat-composer]:absolute
                  [&_>_.chat-composer]:bottom-[calc(100%_+_4px)] [&_>_.chat-composer]:left-0
                  [&_>_.chat-composer]:z-5
                "
              >
                {chatComposer(state.self.id)}
                <button
                  type="button"
                  className="character-chat shrink-0 bg-transparent p-0"
                  aria-label="내 캐릭터 위에 채팅 입력창 열기"
                  onClick={() => chat.open(state.self.id)}
                >
                  <Character kind={state.self.character} asleep={sleeping} />
                </button>
              </div>
              <div>
                <strong>
                  {state.self.name}
                  <span className="me-badge ml-[7px] rounded-[4px] bg-[#d6dec8] p-[2px_4px] text-[8px] text-[#71815e]">
                    나
                  </span>
                </strong>
                <ChatBubble message={chat.message} />
              </div>
              {characterVisibility(state.self)}
              <button
                className="
                  icon-button grid h-[28px] w-[27px] place-items-center rounded-[8px] bg-transparent p-0
                  text-[19px] text-[#68745e] [&:hover]:bg-[#e8eade] [&:hover]:text-[#343c31]
                "
                aria-label="내 프로필 수정"
                onClick={() => setPanel("profile")}
              >
                ✎
              </button>
            </footer>
          )}
        </>
      )}
      {desktop && (
        <dialog
          ref={quitDialog}
          className="
            quit-dialog w-[calc(100%_-_40px)] max-w-[320px] rounded-[14px] border border-solid border-[#e2e4db]
            bg-[#fbfbf7] p-[20px] text-[14px] text-inherit backdrop:bg-[#1c241b66]
            [&_.confirm-quit]:bg-[#b94343] [&_.confirm-quit]:text-[#fff]
          "
          aria-labelledby="quit-dialog-title"
        >
          <form method="dialog">
            <p id="quit-dialog-title">Wappy를 종료하시겠습니까?</p>
            <div className="quit-dialog-actions flex gap-[8px]">
              <button
                type="submit"
                className="
                  secondary w-full rounded-[10px] bg-[#e8eede] p-[13px_14px] text-[12px] font-semibold
                  text-[#526a3d] [&:hover]:bg-[#dee7ce]
                "
                autoFocus
              >
                취소
              </button>
              <button
                type="button"
                className="
                  secondary confirm-quit w-full rounded-[10px] bg-[#e8eede] p-[13px_14px] text-[12px]
                  font-semibold text-[#526a3d] [&:hover]:bg-[#dee7ce]
                "
                disabled={busy || profileDraft !== null}
                onClick={() =>
                  void exit(0).catch(() => {
                    quitDialog.current?.close();
                    setError("앱을 종료하지 못했어요. 다시 시도해 주세요.");
                  })
                }
              >
                종료
              </button>
            </div>
          </form>
        </dialog>
      )}
      <div
        className="
          toast pointer-events-none absolute right-[20px] bottom-[100px] left-[20px] rounded-[10px]
          bg-[#405137] p-[12px] text-center text-[11px] leading-[1.6] text-[#f5f7ed]
          [box-shadow:0_5px_15px_#1c241b15] empty:hidden
        "
        role="status"
        aria-live="polite"
      >
        {notice}
      </div>
    </main>
  );
}

export default App;
