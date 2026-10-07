import { useEffect, useState, type FormEvent } from "react";
import { isTauri, invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  POLL_INTERVAL_MS,
  type Invite,
  type ProfileInput,
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
import { CharacterPark } from "./CharacterPark";
import { ProfileForm } from "./ProfileForm";
import "./App.css";

const emptyProfile: ProfileInput = { name: "", character: "bunny", status: "" };

function App() {
  const [session, setSession] = useState(loadSession);
  const [server, setServer] = useState(session?.server ?? DEFAULT_SERVER);
  const [state, setState] = useState<SidebarState | null>(null);
  const [panel, setPanel] = useState<"friends" | "invite" | "profile">(
    "friends",
  );
  const [invite, setInvite] = useState<Invite | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [connection, setConnection] = useState<
    "connecting" | "online" | "offline" | "unauthorized"
  >("connecting");
  const [notice, setNotice] = useState("");
  const [removing, setRemoving] = useState<string | null>(null);
  const [compact, setCompact] = useState(false);
  const [motionPaused, setMotionPaused] = useState(false);
  const [pinned, setPinned] = useState(true);
  const desktop = isTauri();

  useEffect(() => {
    if (!session) return;
    const controller = new AbortController();
    let timer: number;
    async function poll() {
      try {
        const next = await request(
          session!,
          "GET /state",
          undefined,
          controller.signal,
        );
        if (!controller.signal.aborted) {
          setState(next);
          setConnection("online");
        }
      } catch (cause) {
        if (!controller.signal.aborted)
          setConnection(
            cause instanceof ApiError && cause.status === 401
              ? "unauthorized"
              : "offline",
          );
      } finally {
        if (!controller.signal.aborted)
          timer = window.setTimeout(poll, POLL_INTERVAL_MS);
      }
    }
    void poll();
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
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
      setState(await request(session, "GET /state", undefined));
      setConnection("online");
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
        let address: string;
        try {
          address = serverUrl(server);
        } catch {
          throw new ApiError(
            400,
            "올바른 서버 주소를 입력해 주세요. 예: http://localhost:3001",
          );
        }
        const created = await request(
          { server: address },
          "POST /session",
          profile,
        );
        const saved = { server: address, token: created.token };
        setSession(saved);
        setState({ self: created.profile, friends: [] });
        setConnection("online");
        try {
          localStorage.setItem(SESSION_KEY, JSON.stringify(saved));
        } catch {
          setError(
            "프로필을 기기에 저장하지 못했습니다. 앱을 닫으면 이 프로필로 돌아올 수 없습니다.",
          );
        }
      }
    });
  }

  function acceptInvite(event: FormEvent) {
    event.preventDefault();
    if (!session) return;
    void action(async () => {
      const friend = await request(session, "POST /invites/accept", {
        code: code.trim(),
      });
      setCode("");
      setNotice(`${friend.name} 님과 친구가 되었어요.`);
      setPanel("friends");
      await refresh();
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
  const onlineCount =
    connection === "online"
      ? (state?.friends.filter((friend) => friend.online).length ?? 0)
      : 0;

  if (compact && state)
    return (
      <main className="sidebar compact-sidebar">
        <button
          className="compact-open"
          onClick={toggleCompact}
          aria-label="사이드바 펼치기"
          title="사이드바 펼치기"
        >
          <span className="wordmark">w.</span>
          <span
            className={`online-dot ${connection !== "online" ? "offline" : ""}`}
          />
          <span className="compact-count">{onlineCount}</span>
        </button>
        <CharacterPark
          state={state}
          connected={connection === "online"}
          paused={motionPaused}
          onTogglePause={() => setMotionPaused(!motionPaused)}
          compact
        />
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
      <header className="app-header">
        <div className="brand" data-tauri-drag-region>
          <span className="brand-icon" aria-hidden="true">
            ✳
          </span>
          <span data-tauri-drag-region>
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
                  await getCurrentWindow().setAlwaysOnTop(!pinned);
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
              aria-label="앱 종료"
              title="앱 종료"
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
          <ProfileForm initial={emptyProfile} busy={busy} onSave={saveProfile}>
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
              <p className="hint">친구와 같은 서버 주소를 사용해 주세요.</p>
            </details>
          </ProfileForm>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
        </div>
      ) : (
        <>
          <div className="connection-line">
            <span
              className={`online-dot ${connection !== "online" ? "offline" : ""}`}
            />
            {connection === "online"
              ? "우리의 작은 아지트"
              : connection === "connecting"
                ? "아지트에 들어가는 중…"
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
            <p className="connection-warning" role="status">
              서버와 연결이 끊겼어요. 자동으로 다시 연결합니다.
            </p>
          )}
          {connection === "unauthorized" && (
            <div className="connection-warning" role="alert">
              <p>이 서버에서 저장된 프로필을 찾을 수 없어요.</p>
              <details>
                <summary>새 프로필로 시작하기</summary>
                <p>기존 프로필과 친구 목록으로 돌아올 수 없게 됩니다.</p>
                <button
                  className="text-button danger"
                  onClick={() => {
                    try {
                      localStorage.removeItem(SESSION_KEY);
                    } catch {
                      /* State can still be reset. */
                    }
                    setSession(null);
                    setState(null);
                    setInvite(null);
                    setPanel("friends");
                    setError("");
                  }}
                >
                  저장된 프로필 지우기
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
              </button>
            ))}
          </nav>
          <div className="scroll-area content">
            {error && (
              <p className="error" role="alert">
                {error}
                <button aria-label="오류 닫기" onClick={() => setError("")}>
                  ×
                </button>
              </p>
            )}
            {!state && (
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
                <CharacterPark
                  state={state}
                  connected={connection === "online"}
                  paused={motionPaused}
                  onTogglePause={() => setMotionPaused(!motionPaused)}
                />
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
                  같이 있고 싶은 친구에게 코드를 보내세요.
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
                        친구에게 보낼 코드
                        <input
                          className="invite-code"
                          readOnly
                          value={invite.code}
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
                    </>
                  )}
                  <button
                    className={invite ? "text-button regenerate" : "primary"}
                    disabled={busy}
                    onClick={() =>
                      void action(async () =>
                        setInvite(await request(session, "POST /invites", {})),
                      )
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
                </section>
                <form onSubmit={acceptInvite} className="accept-form">
                  <h2>초대를 받았나요?</h2>
                  <label className="field">
                    친구의 초대 코드
                    <input
                      required
                      maxLength={128}
                      autoCapitalize="none"
                      autoComplete="off"
                      spellCheck={false}
                      placeholder="코드를 붙여넣어 주세요"
                      value={code}
                      onChange={(event) => setCode(event.target.value)}
                    />
                  </label>
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
            {state && panel === "profile" && (
              <>
                <p className="eyebrow">THIS IS ME</p>
                <h1 className="profile-title">오늘의 나는.</h1>
                <ProfileForm
                  initial={state.self}
                  busy={busy}
                  onSave={saveProfile}
                />
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
