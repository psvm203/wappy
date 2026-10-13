import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent,
} from "react";
import { isTauri, invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  parseSidebarState,
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
import { latestChat } from "./chat";
import { useDesktopChatRequests } from "./chat-bridge";
import { InviteField } from "./InviteField";
import { InviteCode } from "./InviteCode";
import { StartupSettings } from "./StartupSettings";
import { UpdateSettings, useAppUpdates } from "./UpdateSettings";
import { filterFriends, type FriendView } from "./friend-filter";
import { reconcileBlocking } from "./blocking";
import { reconcilePresence } from "./presence";
import { saveSession, type SavedSession } from "./sessions";
import {
  isLocalServer,
  parseInvitation,
  WAPPY_SERVER,
} from "./invitations";
import { subscribeState } from "./state-sync";
import { useDesktopAttackRequests } from "./attack-bridge";
import { CHARACTER_POSITIONS, isCharacterPosition } from "./preferences";
import "./App.css";

const emptyProfile: ProfileInput = {
  name: "",
  character: "chiikawa",
};

function App() {
  const [session, setSession] = useState(loadSession);
  const currentSession = useRef(session);
  const profileSave = useRef<Promise<void>>(Promise.resolve());
  const [profileDraft, setProfileDraft] = useState<ProfileInput | null>(null);
  const [server, setServer] = useState(session?.server ?? DEFAULT_SERVER);
  const [onboarding, setOnboarding] = useState<"create" | "join">("create");
  const [serverState, setState] = useState<SidebarState | null>(null);
  const state = useMemo(
    () =>
      serverState && profileDraft
        ? {
            ...serverState,
            self: {
              ...serverState.self,
              ...profileDraft,
              name: profileDraft.name.trim() || serverState.self.name,
            },
          }
        : serverState,
    [serverState, profileDraft],
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
  const [compact, setCompact] = useState(false);
  const [friendView, setFriendView] = useState<FriendView>("all");
  const [chatTarget, setChatTarget] = useState<string | null>(null);
  const {
    preferences,
    setPreferences,
    error: preferencesError,
  } = useCharacterPreferences();
  const { paused: motionPaused, visible: charactersVisible } = preferences;
  const desktop = isTauri();
  const updates = useAppUpdates(desktop);
  const profileKey =
    session && state
      ? residentSelectionKey(session.server, state.self.id)
      : null;
  const selection = useResidentSelection(desktop ? profileKey : null);
  const chatError = useDesktopChatRequests(profileKey, sendChat);
  const syncError = useDesktopSync({
    state: session && selection.ready ? state : null,
    profileKey,
    connected: !!session && connection === "online",
    paused: motionPaused,
    visible: charactersVisible,
    position: preferences.position,
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
    setProfileDraft(null);
    setVerifiedInvitation("");
    setFriendView("all");
    setChatTarget(null);
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
    const save = profileSave.current.catch(() => {}).then(async () => {
      if (!session || currentSession.current !== session)
        throw new ApiError(409, "현재 프로필에서 다시 시도해 주세요.");
      const updated = parseSidebarState({
        self: await request(session, "PATCH /profile", profile),
        friends: [],
      }).self;
      if (updated.id !== state?.self.id)
        throw new ApiError(502, "프로필 저장 결과를 확인하지 못했어요.");
      if (currentSession.current !== session) return;
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
    friendView,
    connection === "online",
  );
  function resetFriendFilters() {
    setFriendView("all");
    document.getElementById("friend-view-all")?.focus();
  }
  function characterVisibility(profile: { id: string; name: string }) {
    if (!desktop || !state) return null;
    const visible =
      charactersVisible && !selection.hiddenIds.includes(profile.id);
    return (
      <button
        type="button"
        className="character-visibility"
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
  const presenceHidden =
    connection === "online" &&
    state?.presence?.sharing === false;
  const errorAlert = error && (
    <p className="error" role="alert">
      {error}
      <button
        type="button"
        aria-label="오류 닫기"
        onClick={() => setError("")}
      >
        ×
      </button>
    </p>
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
          className="icon-button"
          onClick={toggleCompact}
          aria-label="사이드바 펼치기"
          title="사이드바 펼치기"
        >
          ‹
        </button>
        <button
          className="compact-open"
          onClick={toggleCompact}
          aria-label="사이드바 펼치기"
          title="사이드바 펼치기"
        >
          <Character kind={state.self.character} />
          <span
            className={`online-dot ${connection !== "online" || presenceHidden ? "offline" : ""}`}
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

      {desktop && updates.version && (!session || panel !== "settings") && (
        <div className="update-banner">
          <UpdateSettings
            state={updates}
            disabled={busy || profileDraft !== null}
          />
        </div>
      )}

      {!session ? (
        <div className="onboarding scroll-area">
          <div className="intro-art">
            <Character kind="chiikawa" />
            <Character kind="hachiware" />
            <span className="sparkle" aria-hidden="true">
              ✧
            </span>
          </div>
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
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {desktop && <StartupSettings />}
          {desktop && !updates.version && (
            <UpdateSettings state={updates} />
          )}
        </div>
      ) : (
        <>
          {(connection !== "online" || presenceHidden) && (
            <div className="connection-line">
              <span className="online-dot offline" />
              {connection === "online"
                ? "접속 숨김 · 친구에게 오프라인으로 표시"
                : connection === "connecting"
                  ? "아지트에 들어가는 중…"
                  : connection === "unauthorized"
                    ? "프로필 인증이 만료되었어요"
                    : "연결을 다시 확인하는 중…"}
            </div>
          )}
          {connection === "offline" && (
            <div className="connection-warning" role="status">
              <p>서버와 연결이 끊겼어요. 자동으로 다시 연결합니다.</p>
            </div>
          )}
          {connection === "unauthorized" && (
            <div className="connection-warning" role="alert">
              <p>
                프로필 인증에 실패했어요. 연결할 서버 주소가 맞는지 확인해
                주세요.
              </p>
              <details>
                <summary>이 기기에서 다시 시작하기</summary>
                <p>
                  새 프로필로 시작할 수 있어요.
                  유효한 로그인 정보가 없으면 기존 프로필로 돌아올 수 없어요.
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
                ["settings", "설정"],
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
            {state && (
              <button
                className="text-button collapse-button"
                onClick={toggleCompact}
                disabled={busy}
                title="캐릭터만 보기"
              >
                접기 ⇥
              </button>
            )}
          </nav>
          <div className="scroll-area content">
            {desktopError && (
              <p className="error" role="alert">
                {desktopError}
              </p>
            )}
            {(!state || panel !== "invite") && errorAlert}
            {!state &&
              (panel === "friends" || panel === "invite") &&
              connection !== "unauthorized" && (
                <div className="empty-state">
                  <span className="loading-orbit" />
                  <h2>친구들을 만나러 가는 중</h2>
                  <p>{session.server}</p>
                </div>
              )}
            {state && panel === "friends" && (
              <>
                {state.friends.length > 0 && (
                  <>
                    <div className="section-heading">
                      <h1>
                        함께 있는 친구들<span>{state.friends.length}</span>
                      </h1>
                      <span className="count-badge">{onlineCount} online</span>
                    </div>
                    <section
                      className="friend-filters"
                      aria-label="친구 목록 필터"
                    >
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
                        {friendView !== "all" && (
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
                      친구 초대하기 <span aria-hidden="true">+</span>
                    </button>
                  </div>
                ) : listedFriends.length === 0 ? (
                  <div className="empty-state friend-filter-empty">
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
                  <ul className="friend-list">
                    {listedFriends.map((friend) => (
                      <FriendCard
                        key={friend.id}
                        friend={friend}
                        connected={connection === "online"}
                        message={latestChat(state.messages, friend.id)}
                        busy={busy}
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
            {state && panel === "invite" && (
              <div className="invite-panel">
                <section className="invite-card">
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
                  {errorAlert}
                  {state.room && (
                    <p className="hint">
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
              />
            )}
            {panel === "settings" && (
              <section className="settings-panel" aria-label="앱 설정">
                {desktop ? (
                  <>
                    <label className="field">
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
                    <StartupSettings />
                    <UpdateSettings
                      state={updates}
                      disabled={busy || profileDraft !== null}
                    />
                  </>
                ) : (
                  <p className="hint">
                    자동 실행과 앱 업데이트는 데스크톱 앱에서 설정할 수
                    있어요.
                  </p>
                )}
              </section>
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
              {characterVisibility(state.self)}
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
