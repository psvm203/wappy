import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent,
} from "react";
import { isTauri, invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  parseSidebarState,
  parsePresenceSettings,
  parseProfile,
  parseChatMessage,
  parseBlockingSettings,
  parseAttackEvent,
  CHAT_HISTORY_LIMIT,
  type Invite,
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
import { DesktopControls } from "./DesktopControls";
import { ResidentSelection } from "./ResidentSelection";
import { residentSelectionKey } from "./resident-selection";
import { ProfileForm } from "./ProfileForm";
import { KakaoLogin } from "./KakaoLogin";
import { ChatBubble } from "./ChatBubble";
import { ChatComposer } from "./ChatComposer";
import { latestChat } from "./chat";
import { useDesktopChatRequests } from "./chat-bridge";
import { LocalPreview } from "./LocalPreview";
import { InviteField } from "./InviteField";
import { SavedProfiles } from "./SavedProfiles";
import { StartupSettings } from "./StartupSettings";
import { ServerCheck } from "./ServerCheck";
import { SupportPanel } from "./SupportPanel";
import { filterFriends, type FriendView } from "./friend-filter";
import { PresenceControl } from "./PresenceControl";
import { BlockedProfiles } from "./BlockedProfiles";
import { applyBlockingSettings, reconcileBlocking } from "./blocking";
import { reconcilePresence } from "./presence";
import {
  forgetSavedSession,
  loadSavedSessions,
  parkSession,
  saveSession,
  type SavedProfile,
  type SavedSession,
} from "./sessions";
import {
  formatInvitation,
  isLocalServer,
  loadSavedInvite,
  parseInvitation,
  savedInviteKey,
  saveInvite,
  WAPPY_SERVER,
} from "./invitations";
import { subscribeState } from "./state-sync";
import { useDesktopAttackRequests } from "./attack-bridge";
import "./App.css";

const emptyProfile: ProfileInput = {
  name: "",
  character: "chiikawa",
};

function App() {
  const [session, setSession] = useState(loadSession);
  const currentSession = useRef(session);
  const [savedSessions, setSavedSessions] = useState(loadSavedSessions);
  const [server, setServer] = useState(session?.server ?? DEFAULT_SERVER);
  const [onboarding, setOnboarding] = useState<"create" | "join">("create");
  const [state, setState] = useState<SidebarState | null>(null);
  const [localPreview, setLocalPreview] = useState<SidebarState | null>(null);
  const previewStart = useRef<HTMLButtonElement>(null);
  const [panel, setPanel] = useState<"friends" | "invite" | "profile">(
    "friends",
  );
  const [savedInvite, setSavedInvite] = useState<{
    key: string;
    value: Invite | null;
  } | null>(null);
  const [code, setCode] = useState("");
  const [verifiedInvitation, setVerifiedInvitation] = useState("");
  const invitationSource = JSON.stringify([code, server]);
  const [busy, setBusy] = useState(false);
  const [presenceStatus, setPresenceStatus] = useState<
    "ready" | "pending" | "unknown"
  >("ready");
  const [error, setError] = useState("");
  const [connection, setConnection] = useState<
    "connecting" | "online" | "offline" | "unauthorized"
  >("connecting");
  const [notice, setNotice] = useState("");
  const [removing, setRemoving] = useState<string | null>(null);
  const [blockingFriend, setBlockingFriend] = useState<string | null>(null);
  const [compact, setCompact] = useState(false);
  const [friendQuery, setFriendQuery] = useState("");
  const [friendView, setFriendView] = useState<FriendView>("all");
  const friendSearch = useRef<HTMLInputElement>(null);
  const [chatTarget, setChatTarget] = useState<string | null>(null);
  const {
    preferences,
    setPreferences,
    error: preferencesError,
  } = useCharacterPreferences();
  const { paused: motionPaused, visible: charactersVisible } = preferences;
  const [pinned, setPinned] = useState(true);
  const desktop = isTauri();
  const profileKey =
    session && state
      ? residentSelectionKey(session.server, state.self.id)
      : null;
  const inviteStorageKey =
    session && state
      ? savedInviteKey(session.server, state.self.id, state.room?.id)
      : null;
  const invite =
    savedInvite?.key === inviteStorageKey ? savedInvite.value : null;
  const selection = useResidentSelection(desktop ? profileKey : null);
  const chatError = useDesktopChatRequests(profileKey, sendChat);
  const syncError = useDesktopSync({
    state: session ? (selection.ready ? state : null) : localPreview,
    profileKey,
    connected: !!session && connection === "online",
    paused: motionPaused,
    visible: charactersVisible,
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
    if (
      !state.friends.some(
        (friend) => friend.id === friendId && friend.online,
      ) ||
      state.presence?.sharing === false
    )
      throw new ApiError(
        409,
        "두 캐릭터가 접속 상태를 공개하고 온라인일 때 공격할 수 있어요.",
      );
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
    setSession(next);
    setLocalPreview(null);
    setPresenceStatus("ready");
    setVerifiedInvitation("");
    setFriendQuery("");
    setFriendView("all");
    setChatTarget(null);
    setBlockingFriend(null);
  }

  function applyState(next: SidebarState) {
    setState((current) =>
      reconcilePresence(current, reconcileBlocking(current, next)),
    );
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
      chatTarget === id &&
      state && (
        <ChatComposer
          key={profileKey ?? state.self.id}
          connected={connection === "online" && state.messages !== undefined}
          onSend={sendChat}
          onClose={() => setChatTarget(null)}
        />
      )
    );
  }

  async function changeBlocking(friendId: string, blocked: boolean) {
    if (!session || connection !== "online" || state?.blocking === undefined)
      throw new ApiError(
        503,
        "차단 기능을 지원하는 서버에 연결된 뒤 다시 시도해 주세요.",
      );
    const active = session;
    const result = parseBlockingSettings(
      await request(
        active,
        blocked ? "POST /friends/block" : "POST /friends/unblock",
        { friendId },
      ),
    );
    if (
      result.profiles.some((profile) => profile.id === state.self.id) ||
      result.profiles.some((profile) => profile.id === friendId) !== blocked
    )
      throw new ApiError(
        502,
        "차단 변경 결과를 확인하지 못했어요. 차단 목록을 다시 확인해 주세요.",
      );
    if (currentSession.current !== active) return;
    setState((current) =>
      current ? applyBlockingSettings(current, result) : current,
    );
    setBlockingFriend(null);
    setRemoving(null);
    setNotice(
      blocked
        ? "친구를 차단했어요. 내 모습에서 차단을 관리할 수 있어요."
        : "차단을 해제했어요. 다시 함께하려면 초대로 연결해 주세요.",
    );
  }

  function previewLocally(profile: ProfileInput) {
    if (session) return;
    try {
      setLocalPreview({
        self: { ...parseProfile(profile), id: "local-preview" },
        friends: [],
      });
      setError("");
    } catch (cause) {
      setError((cause as Error).message);
    }
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
    if (!inviteStorageKey || savedInvite?.key === inviteStorageKey) return;
    try {
      setSavedInvite({
        key: inviteStorageKey,
        value: loadSavedInvite(inviteStorageKey),
      });
    } catch {
      setSavedInvite({ key: inviteStorageKey, value: null });
      setError("저장된 초대 코드를 불러오지 못했어요. 새 코드를 만들어 주세요.");
    }
  }, [inviteStorageKey, savedInvite?.key]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 5000);
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

  async function refresh() {
    if (session) {
      const next = parseSidebarState(
        await request(session, "GET /state", undefined),
      );
      if (currentSession.current === session) {
        applyState(next);
        setConnection("online");
      }
      return next;
    }
  }

  function changePresence(sharing: boolean) {
    if (!session) return;
    void action(async () => {
      setPresenceStatus("pending");
      try {
        const presence = parsePresenceSettings(
          await request(session, "PATCH /presence", { sharing }),
        );
        setState((current) =>
          current
            ? reconcilePresence(current, { ...current, presence })
            : current,
        );
        setPresenceStatus("ready");
      } catch (cause) {
        // A lost response can still mean the server applied the change.
        setPresenceStatus("unknown");
        try {
          const next = await refresh();
          if (next?.presence) setPresenceStatus("ready");
        } catch {
          /* Keep the status unknown until an explicit retry succeeds. */
        }
        throw cause;
      }
    });
  }

  function retryPresence() {
    void action(async () => {
      setPresenceStatus("pending");
      try {
        const next = await refresh();
        setPresenceStatus(next?.presence ? "ready" : "unknown");
      } catch (cause) {
        setPresenceStatus("unknown");
        throw cause;
      }
    });
  }

  function connectSession(address: string, created: Session) {
    const saved = { server: address, token: created.token };
    changeSession(saved);
    setServer(address);
    setState({ self: created.profile, friends: [] });
    setSavedInvite(null);
    setCode("");
    setRemoving(null);
    setPanel("friends");
    setConnection("online");
    try {
      saveSession({ ...saved, profile: created.profile });
      setSavedSessions(loadSavedSessions());
    } catch {
      setError(
        "프로필을 기기에 저장하지 못했습니다. 앱을 닫으면 로그인 정보가 사라질 수 있어요. 기기 저장 공간과 저장소 접근을 확인해 주세요.",
      );
    }
  }

  function showOnboarding() {
    changeSession(null);
    setState(null);
    setSavedInvite(null);
    setCode("");
    setRemoving(null);
    setOnboarding("create");
    setConnection("connecting");
    setPanel("friends");
    setNotice("");
    setError("");
  }

  function switchServer() {
    if (!session || busy) return;
    try {
      setSavedSessions(
        parkSession({ ...session, ...(state ? { profile: state.self } : {}) }),
      );
      showOnboarding();
    } catch {
      setError(
        "프로필을 보관하지 못해 현재 연결을 유지했어요. 기기 저장 공간과 저장소 접근을 확인해 주세요.",
      );
    }
  }

  function selectSavedSession(saved: SavedProfile) {
    if (busy) return;
    try {
      saveSession(saved);
      showOnboarding();
      setServer(saved.server);
      changeSession({ server: saved.server, token: saved.token });
    } catch {
      setError(
        "보관한 프로필로 전환하지 못했습니다. 기기 저장 공간과 저장소 접근을 확인해 주세요.",
      );
    }
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

  function saveProfile(profile: ProfileInput) {
    void action(async () => {
      if (session) {
        const updated = await request(session, "PATCH /profile", profile);
        setState((current) =>
          current ? { ...current, self: updated } : current,
        );
        setPanel("friends");
        setNotice("새로운 모습으로 바꿨어요.");
      } else {
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
      }
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
    setSavedInvite(null);
    setNotice("방에 참여했어요. 같은 방의 친구들을 함께 만나요.");
    setPanel("friends");
    setFriendQuery("");
    setFriendView("all");
    applyState(
      parseSidebarState(await request(current, "GET /state", undefined)),
    );
    setConnection("online");
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
  function toggleCompact() {
    void windowAction(async () => {
      if (desktop) await invoke("set_sidebar_compact", { compact: !compact });
      setCompact(!compact);
    });
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
    friendQuery,
    friendView,
    connection === "online",
  );
  function resetFriendFilters() {
    setFriendQuery("");
    setFriendView("all");
    friendSearch.current?.focus();
  }
  const presenceHidden =
    connection === "online" &&
    presenceStatus === "ready" &&
    state?.presence?.sharing === false;
  const presenceControls = (
    <PresenceControl
      setting={state?.presence}
      connected={connection === "online"}
      busy={busy}
      pending={presenceStatus === "pending"}
      unknown={presenceStatus === "unknown"}
      onChange={changePresence}
      onRetry={retryPresence}
    />
  );

  const desktopControls = (
    <DesktopControls
      desktop={desktop}
      compact={compact}
      preferences={preferences}
      onChange={setPreferences}
    >
      {state && (
        <ResidentSelection
          state={state}
          hiddenIds={selection.hiddenIds}
          ready={selection.ready}
          visible={charactersVisible}
          onChange={selection.setHiddenIds}
        />
      )}
    </DesktopControls>
  );

  const support = (
    <SupportPanel
      desktop={desktop}
      connection={localPreview ? "preview" : session ? connection : "none"}
      server={localPreview ? null : (session?.server ?? server)}
      paused={motionPaused}
      visible={charactersVisible}
    />
  );

  if (compact && state)
    return (
      <main className="sidebar compact-sidebar">
        <div
          className="compact-drag-handle"
          onMouseDown={dragWindow}
          title="드래그해서 앱 이동"
          aria-label="앱 이동 영역"
        >
          ⠿
        </div>
        <button
          className="compact-open"
          onClick={toggleCompact}
          aria-label="사이드바 펼치기"
          title="사이드바 펼치기"
        >
          <span className="wordmark">w.</span>
          <Character kind={state.self.character} />
          <span
            className={`online-dot ${connection !== "online" || presenceHidden || presenceStatus !== "ready" ? "offline" : ""}`}
          />
          <span className="compact-count">{onlineCount}</span>
          {presenceHidden && (
            <span className="compact-presence">접속 숨김</span>
          )}
        </button>
        <div className="compact-friends">
          {state.friends.map((friend) => (
            <div key={friend.id} title={friend.name}>
              <Character
                kind={friend.character}
                asleep={!friend.online || connection !== "online"}
              />
            </div>
          ))}
        </div>
        {desktopControls}
        {desktopError && (
          <p className="error" role="alert">
            {desktopError}
          </p>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button
          className="icon-button"
          onClick={toggleCompact}
          aria-label="사이드바 펼치기"
        >
          ‹
        </button>
      </main>
    );

  return (
    <main className="sidebar">
      <header
        className="app-header"
        onMouseDown={dragWindow}
        title="드래그해서 앱 이동"
      >
        <div className="brand">
          <span className="brand-icon" aria-hidden="true">
            ✳
          </span>
          <span>
            wappy<span className="brand-period">.</span>
          </span>
        </div>
        {desktop && (
          <div className="window-controls">
            <button
              className={`icon-button ${pinned ? "active" : ""}`}
              aria-label="항상 위에 표시"
              aria-pressed={pinned}
              title="항상 위에 표시"
              onClick={() =>
                void windowAction(async () => {
                  await invoke("set_sidebar_pinned", { pinned: !pinned });
                  setPinned(!pinned);
                })
              }
            >
              ⌖
            </button>
            <button
              className="icon-button"
              aria-label="최소화"
              title="최소화"
              onClick={() =>
                void windowAction(() => getCurrentWindow().minimize())
              }
            >
              −
            </button>
            <button
              className="icon-button"
              aria-label="사이드바 숨기기"
              title="사이드바 숨기기 — 메뉴 막대·트레이에서 다시 열 수 있어요"
              onClick={() =>
                void windowAction(() => getCurrentWindow().close())
              }
            >
              ×
            </button>
          </div>
        )}
      </header>

      {!session && localPreview ? (
        <LocalPreview
          profile={localPreview.self}
          support={support}
          controls={desktopControls}
          error={error || desktopError}
          onChange={previewLocally}
          onExit={() => {
            setLocalPreview(null);
            setError("");
            requestAnimationFrame(() => previewStart.current?.focus());
          }}
        />
      ) : !session ? (
        <div className="onboarding scroll-area">
          <div className="intro-art">
            <Character kind="chiikawa" />
            <Character kind="hachiware" />
            <span className="sparkle" aria-hidden="true">
              ✧
            </span>
          </div>
          <p className="eyebrow">A LITTLE CLOSER</p>
          <h1>
            각자의 화면에서,
            <br />
            조금 더 가까이.
          </h1>
          <p className="intro-copy">
            친구들의 작은 존재감을
            <br />내 화면 한쪽에 놓아두세요.
          </p>
          {desktop && (
            <div className="local-preview-entry">
              <button
                ref={previewStart}
                className="secondary"
                disabled={busy}
                onClick={() =>
                  previewLocally({ ...emptyProfile, name: "체험 캐릭터" })
                }
              >
                서버 없이 체험하기
              </button>
              <p className="hint">
                프로필을 만들기 전에 바탕화면에서 함께 걸어봐요.
              </p>
            </div>
          )}
          <nav className="onboarding-tabs" aria-label="시작 방법">
            {(
              [
                ["create", "처음이에요"],
                ["join", "초대받았어요"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                className="text-button"
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
          <SavedProfiles
            sessions={savedSessions}
            busy={busy}
            onSelect={selectSavedSession}
            onForget={(saved) => {
              try {
                setSavedSessions(forgetSavedSession(saved));
                setError("");
              } catch {
                setError(
                  "보관한 프로필을 지우지 못했습니다. 다시 시도해 주세요.",
                );
              }
            }}
          />
          {onboarding !== "join" && (
            <KakaoLogin
              key={server}
              server={server}
              busy={busy}
              onBusyChange={(pending) => {
                setBusy(pending);
                if (pending) setError("");
              }}
              onLogin={connectSession}
            />
          )}
          <ProfileForm
            initial={emptyProfile}
            busy={busy}
            onSave={saveProfile}
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
          >
            <details className="server-settings">
              <summary>연결할 서버</summary>
              <label className="field">
                서버 주소
                <input
                  type="url"
                  required
                  value={server}
                  onChange={(event) => setServer(event.target.value)}
                />
              </label>
              <p className="hint">
                기본 서버에서는 초대 코드만 입력하면 돼요. 별도 서버를 사용하는
                경우에만 주소를 바꿔 주세요.
              </p>
              <ServerCheck key={server} server={server} busy={busy} />
            </details>
          </ProfileForm>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {desktop && <StartupSettings />}
          {support}
        </div>
      ) : (
        <>
          <div className="connection-line">
            <span
              className={`online-dot ${connection !== "online" || presenceHidden || presenceStatus !== "ready" ? "offline" : ""}`}
            />
            {connection === "online"
              ? presenceStatus !== "ready"
                ? "접속 공개 상태 확인 필요"
                : presenceHidden
                  ? "접속 숨김 · 친구에게 오프라인으로 표시"
                  : "우리의 작은 아지트"
              : connection === "connecting"
                ? "아지트에 들어가는 중…"
                : connection === "unauthorized"
                  ? "프로필 인증이 만료되었어요"
                  : "연결을 다시 확인하는 중…"}
            {state && (
              <button
                className="text-button"
                onClick={toggleCompact}
                disabled={busy}
                title="캐릭터만 보기"
              >
                접기 ⇥
              </button>
            )}
          </div>
          {connection === "offline" && (
            <div className="connection-warning" role="status">
              <p>서버와 연결이 끊겼어요. 자동으로 다시 연결합니다.</p>
              <button
                className="text-button"
                onClick={() => setPanel("profile")}
              >
                서버 설정 보기
              </button>
            </div>
          )}
          {connection === "unauthorized" && (
            <div className="connection-warning" role="alert">
              <p>
                프로필 인증이 만료되었어요. 다른 기기에서 로그인했다면 그
                기기에서 계속 이용할 수 있어요.
              </p>
              <details>
                <summary>이 기기에서 다시 시작하기</summary>
                <p>
                  카카오로 만든 프로필은 같은 서버에서 같은 카카오 계정으로 다시
                  로그인할 수 있어요. 보관한 다른 프로필을 선택하거나 새
                  프로필로 시작할 수도 있어요.
                </p>
                <button
                  className="text-button danger"
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
          <nav className="tabs" aria-label="사이드바 메뉴">
            {(
              [
                ["friends", "친구들"],
                ["invite", "초대하기"],
                ["profile", "내 모습"],
              ] as const
            ).map(([id, label]) => (
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
          <div className="scroll-area content">
            {desktopError && (
              <p className="error" role="alert">
                {desktopError}
              </p>
            )}
            {error && (
              <p className="error" role="alert">
                {error}
                <button aria-label="오류 닫기" onClick={() => setError("")}>
                  ×
                </button>
              </p>
            )}
            {!state && panel !== "profile" && connection !== "unauthorized" && (
              <div className="empty-state">
                <span className="loading-orbit" />
                <h2>친구들을 만나러 가는 중</h2>
                <p>{session.server}</p>
              </div>
            )}
            {state && panel === "friends" && (
              <>
                <div className="section-heading">
                  <h1>
                    함께 있는 친구들<span>{state.friends.length}</span>
                  </h1>
                  <span className="count-badge">{onlineCount} online</span>
                </div>
                {desktopControls}
                {presenceControls}
                {state.friends.length > 0 && (
                  <>
                    <section className="friend-filters" aria-label="친구 찾기">
                      <label className="field friend-search">
                        이름으로 찾기
                        <input
                          ref={friendSearch}
                          type="search"
                          maxLength={120}
                          value={friendQuery}
                          placeholder="이름 검색"
                          onChange={(event) =>
                            setFriendQuery(event.target.value)
                          }
                        />
                      </label>
                      <div
                        className="friend-views"
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
                      <div className="friend-results">
                        <p role="status">
                          {listedFriends.length}명 표시 · 전체{" "}
                          {state.friends.length}명
                        </p>
                        {(friendQuery || friendView !== "all") && (
                          <button
                            className="text-button"
                            onClick={resetFriendFilters}
                          >
                            필터 초기화
                          </button>
                        )}
                      </div>
                    </section>
                  </>
                )}
                {state.friends.length === 0 ? (
                  <div className="empty-state invitation-empty">
                    <h2>옆자리를 비워뒀어요.</h2>
                    <p>
                      친구를 초대하면 이곳에서
                      <br />
                      서로의 캐릭터를 만날 수 있어요.
                    </p>
                    <button
                      className="primary"
                      onClick={() => setPanel("invite")}
                    >
                      첫 친구 초대하기 <span aria-hidden="true">+</span>
                    </button>
                  </div>
                ) : listedFriends.length === 0 ? (
                  <div className="empty-state friend-filter-empty">
                    <h2>
                      {friendView === "online" && connection !== "online"
                        ? "접속 상태를 확인할 수 없어요."
                        : "조건에 맞는 친구가 없어요."}
                    </h2>
                    <p>
                      {friendView === "online" && connection !== "online"
                        ? "다시 연결되면 접속 중인 친구가 표시돼요. 전체 목록은 계속 볼 수 있어요."
                        : "검색어나 목록 보기를 바꾸면 다른 친구도 볼 수 있어요."}
                    </p>
                  </div>
                ) : (
                  <ul className="friend-list">
                    {listedFriends.map((friend) => (
                      <FriendCard
                        key={friend.id}
                        friend={friend}
                        connected={connection === "online"}
                        message={latestChat(state.messages, friend.id)}
                        busy={busy}
                        blockingSupported={state.blocking !== undefined}
                        confirmation={
                          removing === friend.id
                            ? "remove"
                            : blockingFriend === friend.id
                              ? "block"
                              : null
                        }
                        onConfirmationChange={(confirmation) => {
                          setRemoving(
                            confirmation === "remove" ? friend.id : null,
                          );
                          setBlockingFriend(
                            confirmation === "block" ? friend.id : null,
                          );
                        }}
                        onRemove={() =>
                          void action(async () => {
                            await request(session, "POST /friends/remove", {
                              friendId: friend.id,
                            });
                            setRemoving(null);
                            await refresh();
                          })
                        }
                        onBlock={() =>
                          void action(() => changeBlocking(friend.id, true))
                        }
                      />
                    ))}
                  </ul>
                )}
              </>
            )}
            {state && panel === "invite" && (
              <div className="invite-panel">
                <section className="invite-card">
                  <span className="invite-symbol" aria-hidden="true">
                    ↗
                  </span>
                  <h2>방 초대 코드</h2>
                  {state.room && (
                    <p>
                      현재 방: <strong>{state.room.name}</strong>
                    </p>
                  )}
                  <p>
                    참여자 누구나 같은 방으로 초대할 수 있어요.
                    <br />
                    인원과 기간 제한 없이 사용할 수 있어요.
                    <br />새 코드를 만들면 이 방의 이전 코드는 사용할 수 없어요.
                  </p>
                  {invite && (
                    <>
                      <label className="field">
                        친구에게 보낼 코드
                        <input
                          className="invite-code"
                          readOnly
                          value={invite.code}
                          onFocus={(event) => event.target.select()}
                        />
                      </label>
                      <button
                        className="primary"
                        onClick={async () => {
                          setError("");
                          try {
                            await navigator.clipboard.writeText(
                              formatInvitation(session.server, invite.code),
                            );
                            setNotice("초대 코드를 복사했어요.");
                          } catch {
                            setError(
                              "코드 입력란을 선택한 뒤 직접 복사해 주세요.",
                            );
                          }
                        }}
                      >
                        초대 코드 복사 <span aria-hidden="true">↗</span>
                      </button>
                      <p className="hint">
                        친구가 첫 화면의 ‘초대받았어요’에 붙여넣으면 바로 시작할
                        수 있어요.
                      </p>
                    </>
                  )}
                  <button
                    className={invite ? "text-button regenerate" : "primary"}
                    disabled={busy}
                    onClick={() =>
                      void action(async () => {
                        const created = await request(
                          session,
                          "POST /invites",
                          {},
                        );
                        formatInvitation(session.server, created.code);
                        if (currentSession.current !== session) return;
                        if (inviteStorageKey)
                          setSavedInvite({
                            key: inviteStorageKey,
                            value: created,
                          });
                        const next = state.room ? state : await refresh();
                        if (!next || currentSession.current !== session) return;
                        const key = savedInviteKey(
                          session.server,
                          next.self.id,
                          next.room?.id,
                        );
                        setSavedInvite({ key, value: created });
                        try {
                          saveInvite(key, created);
                        } catch {
                          setError(
                            "초대 코드를 기기에 저장하지 못했어요. 앱을 닫기 전에 코드를 복사해 주세요.",
                          );
                        }
                      })
                    }
                  >
                    {busy
                      ? "만드는 중…"
                      : invite
                        ? "새 코드 만들기"
                        : "초대 코드 만들기"}
                  </button>
                  {session.server !== WAPPY_SERVER && (
                    <p className="hint server-address">
                      친구도 같은 서버에 연결해야 해요.
                      <br />
                      <strong>{session.server}</strong>
                    </p>
                  )}
                  {isLocalServer(session.server) && (
                    <p className="hint">
                      현재 주소는 이 컴퓨터 안에서만 사용할 수 있어요. 다른
                      기기의 친구와 함께하려면 둘 다 접속할 수 있는 서버에서
                      시작해 주세요.
                    </p>
                  )}
                </section>
                <form onSubmit={acceptInvite} className="accept-form">
                  <h2>초대를 받았나요?</h2>
                  <InviteField
                    value={code}
                    onChange={setCode}
                    server={session.server}
                    busy={busy}
                    sameServer
                  />
                  <button
                    className="secondary"
                    disabled={busy || !code.trim()}
                    type="submit"
                  >
                    {busy ? "참여하는 중…" : "방에 참여하기"}
                  </button>
                  {state.room && (
                    <p className="hint">
                      다른 방의 초대를 수락하면 현재 방에서 나가고 새 방의
                      친구들과 함께하게 돼요.
                    </p>
                  )}
                </form>
              </div>
            )}
            {panel === "profile" && (
              <>
                {state && (
                  <>
                    <p className="eyebrow">THIS IS ME</p>
                    <h1 className="profile-title">오늘의 나는.</h1>
                    {presenceControls}
                    <ProfileForm
                      key={state.self.id}
                      initial={state.self}
                      busy={busy}
                      onSave={saveProfile}
                    />
                    <BlockedProfiles
                      blocking={state.blocking}
                      disabled={busy || connection !== "online"}
                      onUnblock={(id) =>
                        void action(() => changeBlocking(id, false))
                      }
                    />
                  </>
                )}
                <section
                  className="invite-card server-panel"
                  aria-label="서버 설정"
                >
                  <h2>함께할 서버</h2>
                  <p className="hint server-address">
                    현재 서버: <strong>{session.server}</strong>
                  </p>
                  <ServerCheck
                    key={session.server}
                    server={session.server}
                    busy={busy}
                  />
                  <p>
                    현재 프로필을 이 기기에 보관하고 첫 화면으로 돌아갑니다.
                    다른 서버에서 새로 시작하거나, 보관한 프로필로 다시 돌아올
                    수 있어요.
                  </p>
                  <p className="hint">
                    기기 저장소가 지워지면 보관한 로그인 정보도 사라집니다.
                    이름으로 만든 프로필은 로그인 정보를 잃으면 다시 불러올 수
                    없어요.
                  </p>
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={switchServer}
                  >
                    프로필 보관하고 서버 바꾸기
                  </button>
                </section>
                {desktop && <StartupSettings />}
                {support}
              </>
            )}
          </div>
          {state && (
            <footer className="self-card">
              <div className="character-chat-anchor">
                {chatComposer(state.self.id)}
                <button
                  type="button"
                  className="character-chat"
                  aria-label="내 캐릭터 위에 채팅 입력창 열기"
                  onClick={() => setChatTarget(state.self.id)}
                >
                  <Character kind={state.self.character} />
                </button>
              </div>
              <div>
                <strong>
                  {state.self.name}
                  <span className="me-badge">나</span>
                </strong>
                <ChatBubble
                  message={latestChat(state.messages, state.self.id)}
                />
              </div>
              <button
                className="icon-button"
                aria-label="내 프로필 수정"
                onClick={() => setPanel("profile")}
              >
                ✎
              </button>
            </footer>
          )}
        </>
      )}
      <div className="toast" role="status" aria-live="polite">
        {notice}
      </div>
    </main>
  );
}

export default App;
