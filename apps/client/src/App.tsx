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
  request,
  serverUrl,
} from "./api";
import { Character } from "./Character";
import {
  useCharacterPreferences,
  useDesktopGreeting,
  useDesktopSync,
  useResidentSelection,
  type GreetingTarget,
} from "./desktop";
import { ResidentSelection } from "./ResidentSelection";
import { residentSelectionKey } from "./resident-selection";
import { ProfileForm } from "./ProfileForm";
import { RecoveryCode, RecoveryForm } from "./Recovery";
import { InviteField } from "./InviteField";
import { SavedProfiles } from "./SavedProfiles";
import { StartupSettings } from "./StartupSettings";
import { FriendGreeting } from "./FriendGreeting";
import { PresenceControl } from "./PresenceControl";
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
  parseInvitation,
} from "./invitations";
import { subscribeState } from "./state-sync";
import "./App.css";

const emptyProfile: ProfileInput = { name: "", character: "bunny", status: "" };

function App() {
  const [session, setSession] = useState(loadSession);
  const currentSession = useRef(session);
  const [savedSessions, setSavedSessions] = useState(loadSavedSessions);
  const [server, setServer] = useState(session?.server ?? DEFAULT_SERVER);
  const [onboarding, setOnboarding] = useState<"create" | "join" | "recover">(
    "create",
  );
  const [state, setState] = useState<SidebarState | null>(null);
  const [panel, setPanel] = useState<"friends" | "invite" | "profile">(
    "friends",
  );
  const [invite, setInvite] = useState<Invite | null>(null);
  const [code, setCode] = useState("");
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
  const [compact, setCompact] = useState(false);
  const [greetingTarget, setGreetingTarget] = useState<GreetingTarget | null>(
    null,
  );
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
  const selection = useResidentSelection(desktop ? profileKey : null);
  const greetingError = useDesktopGreeting((target) => {
    if (
      !session ||
      currentSession.current !== session ||
      target.profileKey !== profileKey ||
      !state?.friends.some((friend) => friend.id === target.friendId)
    )
      return;
    void windowAction(async () => {
      await invoke("open_sidebar");
      if (currentSession.current !== session) return;
      if (compact) await invoke("set_sidebar_compact", { compact: false });
      if (currentSession.current !== session) return;
      setCompact(false);
      setPanel("friends");
      setGreetingTarget(target);
    });
  });
  const syncError = useDesktopSync({
    state: selection.ready ? state : null,
    profileKey,
    connected: connection === "online",
    paused: motionPaused,
    visible: charactersVisible,
    hiddenIds: selection.hiddenIds,
  });
  const desktopError =
    preferencesError || selection.error || greetingError || syncError;

  useEffect(() => {
    if (!greetingTarget) return;
    if (
      greetingTarget.profileKey === profileKey &&
      !compact &&
      panel === "friends"
    ) {
      const card = document.getElementById(`friend-${greetingTarget.friendId}`);
      card?.focus({ preventScroll: true });
      card?.scrollIntoView({ block: "center" });
    }
    setGreetingTarget(null);
  }, [greetingTarget, profileKey, compact, panel]);

  function changeSession(next: SavedSession | null) {
    // Invalidate old callbacks immediately, before React runs effect cleanup.
    currentSession.current = next;
    setSession(next);
    setPresenceStatus("ready");
  }

  function applyState(next: SidebarState) {
    setState((current) => reconcilePresence(current, next));
  }

  useEffect(() => {
    if (!session) return;
    return subscribeState(session, (update) => {
      if (currentSession.current !== session) return;
      if (update.connection === "online") applyState(update.state);
      setConnection(update.connection);
    });
  }, [session]);

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
    setInvite(null);
    setCode("");
    setRemoving(null);
    setPanel("friends");
    setConnection("online");
    try {
      saveSession({ ...saved, profile: created.profile });
      setSavedSessions(loadSavedSessions());
    } catch {
      setError(
        "프로필을 기기에 저장하지 못했습니다. 앱을 닫기 전에 ‘내 모습’에서 복구 코드를 보관해 주세요.",
      );
    }
  }

  function showOnboarding(mode: "create" | "recover") {
    changeSession(null);
    setState(null);
    setInvite(null);
    setCode("");
    setRemoving(null);
    setOnboarding(mode);
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
      showOnboarding("create");
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
      showOnboarding("create");
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

  function recoverProfile(recoveryCode: string) {
    void action(async () => {
      const address = selectedServer();
      const recovered = await request(
        { server: address },
        "POST /session/recover",
        { code: recoveryCode },
      );
      connectSession(address, recovered);
      setNotice("프로필을 복구했어요. 기존 기기는 로그아웃됩니다.");
    });
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
            await connectFriend(
              { server: address, token: created.token },
              received.code,
            );
          } catch (cause) {
            throw new ApiError(
              400,
              `프로필은 만들었어요. 친구 연결 결과를 확인하지 못했습니다. ${errorMessage(cause)}`,
            );
          }
          return;
        }
        setNotice(
          "‘내 모습’에서 복구 코드를 보관하면 기기를 바꿔도 돌아올 수 있어요.",
        );
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

  async function connectFriend(
    current: { server: string; token: string },
    inviteCode: string,
  ) {
    const friend = await request(current, "POST /invites/accept", {
      code: inviteCode,
    });
    setCode("");
    setNotice(`${friend.name} 님과 친구가 되었어요.`);
    setPanel("friends");
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
      await connectFriend(session, received.code);
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
  const waveCount = state?.friends.filter((friend) => friend.wave).length ?? 0;
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
    <section className="desktop-controls" aria-label="바탕화면 캐릭터 설정">
      <p>
        {desktop
          ? motionPaused
            ? "캐릭터가 쉬고 있어요. ‘다시 걷기’로 자동 이동을 시작하세요."
            : "가장자리를 따라 걷는 캐릭터를 잡아서 던져보세요."
          : "데스크톱 앱에서 바탕화면 산책을 시작하세요."}
      </p>
      <div>
        <button
          className="text-button"
          disabled={!desktop}
          onClick={() =>
            setPreferences((current) => ({
              ...current,
              paused: !current.paused,
            }))
          }
          aria-label={
            motionPaused ? "캐릭터 움직임 다시 시작" : "캐릭터 움직임 멈추기"
          }
          aria-pressed={motionPaused}
        >
          {compact
            ? motionPaused
              ? "▶"
              : "Ⅱ"
            : motionPaused
              ? "다시 걷기"
              : "잠깐 쉬기"}
        </button>
        <button
          className="text-button"
          disabled={!desktop}
          onClick={() =>
            setPreferences((current) => ({
              ...current,
              visible: !current.visible,
            }))
          }
          aria-label={
            charactersVisible
              ? "바탕화면 캐릭터 숨기기"
              : "바탕화면 캐릭터 표시"
          }
          aria-pressed={charactersVisible}
        >
          {compact
            ? charactersVisible
              ? "◉"
              : "○"
            : charactersVisible
              ? "캐릭터 숨기기"
              : "캐릭터 표시"}
        </button>
      </div>
      {desktop && state && !compact && (
        <ResidentSelection
          state={state}
          hiddenIds={selection.hiddenIds}
          ready={selection.ready}
          visible={charactersVisible}
          onChange={selection.setHiddenIds}
        />
      )}
      {desktop && (
        <p className="hint">
          닫아도 캐릭터는 남아요. 메뉴 막대·트레이에서 다시 열거나 종료할 수
          있어요.
        </p>
      )}
    </section>
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
            <div
              key={friend.id}
              title={`${friend.name}${friend.wave ? " · 새 인사" : ""}`}
            >
              <Character
                kind={friend.character}
                asleep={!friend.online || connection !== "online"}
              />
              {friend.wave && (
                <span
                  className="compact-wave"
                  aria-label={`${friend.name} 님의 새 인사`}
                >
                  👋
                </span>
              )}
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

      {!session ? (
        <div className="onboarding scroll-area">
          <div className="intro-art">
            <Character kind="bunny" />
            <Character kind="frog" />
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
          <nav className="onboarding-tabs" aria-label="시작 방법">
            {(
              [
                ["create", "처음이에요"],
                ["join", "초대받았어요"],
                ["recover", "다시 돌아왔어요"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                className="text-button"
                aria-current={onboarding === id ? "page" : undefined}
                disabled={busy}
                onClick={() => {
                  setOnboarding(id);
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
          {onboarding === "recover" ? (
            <RecoveryForm
              server={server}
              onServerChange={setServer}
              busy={busy}
              onRecover={recoverProfile}
            />
          ) : (
            <ProfileForm
              initial={emptyProfile}
              busy={busy}
              onSave={saveProfile}
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
                  코드만 받았다면 친구와 같은 서버 주소를 입력하세요. 초대장을
                  붙여넣으면 초대장의 서버를 사용해요.
                </p>
              </details>
            </ProfileForm>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          {desktop && <StartupSettings />}
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
                프로필 인증이 만료되었어요. 다른 기기에서 복구했다면 그 기기에서
                계속 이용할 수 있어요.
              </p>
              <details>
                <summary>이 기기에서 다시 시작하기</summary>
                <p>
                  복구 코드가 있으면 같은 서버의 프로필과 친구 목록을 불러올 수
                  있어요.
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
                    showOnboarding("recover");
                  }}
                >
                  복구 화면으로 이동
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
                className={panel === id ? "selected" : ""}
                onClick={() => {
                  setPanel(id);
                  setError("");
                }}
              >
                {label}
                {id === "friends" && waveCount > 0 && (
                  <span
                    className="wave-count"
                    aria-label={`새 인사 ${waveCount}개`}
                  >
                    {waveCount}
                  </span>
                )}
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
                  <p className="hint greeting-hint">
                    손 인사로 안부를 전해요. 같은 친구에게 30초에 한 번, 확인
                    전까지 최근 인사 하나를 하루 동안 보관해요.
                  </p>
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
                ) : (
                  <ul className="friend-list">
                    {[...state.friends]
                      .sort((a, b) => Number(b.online) - Number(a.online))
                      .map((friend) => (
                        <li
                          id={`friend-${friend.id}`}
                          tabIndex={-1}
                          aria-label={`${friend.name} 님의 친구 카드`}
                          className={`friend-card ${friend.online && connection === "online" ? "is-online" : ""}`}
                          key={friend.id}
                        >
                          <div className="friend-scene">
                            <Character
                              kind={friend.character}
                              asleep={!friend.online || connection !== "online"}
                            />
                            <div className="scene-floor" />
                          </div>
                          <div className="friend-info">
                            <div className="friend-name">
                              <strong>{friend.name}</strong>
                              <span
                                className={`online-dot ${!friend.online || connection !== "online" ? "offline" : ""}`}
                              />
                            </div>
                            <p>{friend.status || "그냥, 함께 있는 중"}</p>
                            <small>
                              {connection !== "online"
                                ? "접속 상태 확인 중"
                                : friend.online
                                  ? "지금 함께 있어요"
                                  : "잠시 쉬고 있어요"}
                            </small>
                            <FriendGreeting
                              friend={friend}
                              disabled={busy || connection !== "online"}
                              onSend={() =>
                                void action(async () => {
                                  await request(session, "POST /friends/wave", {
                                    friendId: friend.id,
                                  });
                                  setNotice(
                                    `${friend.name} 님에게 인사를 보냈어요.`,
                                  );
                                })
                              }
                              onRead={() =>
                                void action(async () => {
                                  if (!friend.wave) return;
                                  await request(session, "POST /waves/read", {
                                    waveId: friend.wave.id,
                                  });
                                  await refresh();
                                })
                              }
                            />
                          </div>
                          <button
                            className="remove-button"
                            aria-label={`${friend.name} 친구 연결 해제`}
                            title="친구 연결 해제"
                            onClick={() =>
                              setRemoving(
                                removing === friend.id ? null : friend.id,
                              )
                            }
                          >
                            ×
                          </button>
                          {removing === friend.id && (
                            <div className="remove-confirm">
                              <p>{friend.name} 님과 연결을 해제할까요?</p>
                              <button
                                className="text-button"
                                onClick={() => setRemoving(null)}
                              >
                                취소
                              </button>
                              <button
                                className="text-button danger"
                                disabled={busy}
                                onClick={() =>
                                  void action(async () => {
                                    await request(
                                      session,
                                      "POST /friends/remove",
                                      { friendId: friend.id },
                                    );
                                    setRemoving(null);
                                    await refresh();
                                  })
                                }
                              >
                                연결 해제
                              </button>
                            </div>
                          )}
                        </li>
                      ))}
                  </ul>
                )}
                <div className="little-note">
                  <span aria-hidden="true">✧</span> 말하지 않아도, 곁에 있다는
                  것.
                </div>
              </>
            )}
            {state && panel === "invite" && (
              <div className="invite-panel">
                <p className="eyebrow">BETTER TOGETHER</p>
                <h1>작은 초대, 큰 반가움.</h1>
                <p className="muted">
                  같이 있고 싶은 친구에게 초대장을 보내세요.
                </p>
                <section className="invite-card">
                  <span className="invite-symbol" aria-hidden="true">
                    ↗
                  </span>
                  <h2>내 초대 코드</h2>
                  <p>
                    한 명에게, 하루 동안 유효해요.
                    <br />새 코드를 만들면 이전 코드는 만료돼요.
                  </p>
                  {invite && (
                    <>
                      <label className="field">
                        친구에게 보낼 초대장
                        <textarea
                          readOnly
                          rows={5}
                          value={formatInvitation(session.server, invite.code)}
                          onFocus={(event) => event.target.select()}
                        />
                      </label>
                      <p className="hint">
                        만료:{" "}
                        {new Date(invite.expiresAt).toLocaleString("ko-KR")}
                      </p>
                      <button
                        className="primary"
                        onClick={async () => {
                          setError("");
                          try {
                            await navigator.clipboard.writeText(
                              formatInvitation(session.server, invite.code),
                            );
                            setNotice(
                              "서버 주소와 초대 코드를 함께 복사했어요.",
                            );
                          } catch {
                            setError(
                              "초대장 입력란을 선택한 뒤 직접 복사해 주세요.",
                            );
                          }
                        }}
                      >
                        초대장 복사 <span aria-hidden="true">↗</span>
                      </button>
                      <p className="hint">
                        친구가 첫 화면의 ‘초대받았어요’에 붙여넣으면 바로 시작할
                        수 있어요.
                      </p>
                      <details className="server-settings">
                        <summary>코드만 따로 보내기</summary>
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
                            try {
                              await navigator.clipboard.writeText(invite.code);
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
                      </details>
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
                        setInvite(created);
                      })
                    }
                  >
                    {busy
                      ? "만드는 중…"
                      : invite
                        ? "새 코드 만들기"
                        : "초대 코드 만들기"}
                  </button>
                  <p className="hint server-address">
                    친구도 같은 서버에 연결해야 해요.
                    <br />
                    <strong>{session.server}</strong>
                  </p>
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
                  />
                  <button
                    className="secondary"
                    disabled={busy || !code.trim()}
                    type="submit"
                  >
                    {busy ? "연결하는 중…" : "친구와 연결하기"}
                  </button>
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
                    <RecoveryCode key={session.token} session={session} />
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
                  <p>
                    현재 프로필을 이 기기에 보관하고 첫 화면으로 돌아갑니다.
                    다른 서버에서 새로 시작하거나, 보관한 프로필로 다시 돌아올
                    수 있어요.
                  </p>
                  <p className="hint">
                    기기 저장소가 지워지면 보관한 로그인 정보도 사라집니다. 복구
                    코드를 함께 보관해 주세요.
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
              </>
            )}
          </div>
          {state && (
            <footer className="self-card">
              <Character kind={state.self.character} />
              <div>
                <strong>
                  {state.self.name}
                  <span className="me-badge">나</span>
                </strong>
                <p>{state.self.status || "함께 있는 것만으로도 좋아요"}</p>
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
