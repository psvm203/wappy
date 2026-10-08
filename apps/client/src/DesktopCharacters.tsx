import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import { isTauri, invoke } from "@tauri-apps/api/core";
import { emitTo } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { DesktopResident } from "./resident-selection";
import type { ChatMessage } from "@wappy/api";
import { Character } from "./Character";
import { OPEN_CHAT_EVENT, OPEN_GREETING_EVENT } from "./desktop";
import { ChatBubble } from "./ChatPanel";
import { latestChat, movedForDrag } from "./chat";
import {
  advanceBody,
  CHARACTER_SIZE,
  createBody,
  moveBody,
  needsAnimation,
  releaseVelocity,
  type Body,
  type DragSample,
} from "./desktop-physics";
import "./DesktopCharacters.css";

type Resident = { body: Body; element: HTMLElement; walking: boolean };
type Drag = {
  id: string;
  pointerId: number;
  offsetX: number;
  offsetY: number;
  pointerX: number;
  pointerY: number;
  samples: DragSample[];
  startX: number;
  startY: number;
  moved: boolean;
};

function moveHeldBody(body: Body, held: Drag) {
  // Keep the grip under the pointer as a wall or ceiling character turns upright.
  const cos = Math.cos(body.angle),
    sin = Math.sin(body.angle);
  moveBody(
    body,
    held.pointerX - held.offsetX * cos + held.offsetY * sin,
    held.pointerY - held.offsetX * sin - held.offsetY * cos,
    innerWidth,
    innerHeight,
  );
}

function draw({ body, element, walking }: Resident) {
  element.style.transform = `translate3d(${body.x - CHARACTER_SIZE / 2}px, ${body.y - CHARACTER_SIZE / 2}px, 0)`;
  element.style.setProperty("--angle", `${body.angle}rad`);
  element.style.setProperty("--facing", `${-body.direction}`);
  element.style.setProperty(
    "--drag-tilt",
    `${-body.direction * body.dragTilt}rad`,
  );
  element.style.setProperty(
    "--step-duration",
    `${Math.max(0.32, Math.min(0.85, 28 / Math.max(1, body.walkSpeed)))}s`,
  );
  const flight = Math.min(1, Math.hypot(body.vx, body.vy) / 1600);
  element.style.setProperty("--flight-x", `${1 - flight * 0.08}`);
  element.style.setProperty("--flight-y", `${1 + flight * 0.14}`);
  element.style.setProperty(
    "--trail-opacity",
    `${Math.max(0, flight - 0.12) * 0.8}`,
  );
  const hasChat = element.dataset.chat === "true";
  const nameInset = hasChat ? 96 : 46;
  const nameX = Math.max(
    nameInset,
    Math.min(innerWidth - nameInset, body.x + Math.sin(body.angle) * 92),
  );
  const labelInset = hasChat ? 64 : element.dataset.wave === "true" ? 24 : 12;
  const nameY = Math.max(
    labelInset,
    Math.min(innerHeight - labelInset, body.y - Math.cos(body.angle) * 68),
  );
  element.style.setProperty("--name-x", `${nameX - body.x}px`);
  element.style.setProperty("--name-y", `${nameY - body.y}px`);
  element.dataset.motion =
    body.mode === "drag"
      ? "drag"
      : !walking
        ? "sleep"
        : body.mode === "walk" && body.restTime > 0
          ? "idle"
          : body.mode;
}

export function DesktopCharacters({
  residents,
  paused,
  profileKey,
  messages,
}: {
  residents: DesktopResident[];
  paused: boolean;
  profileKey: string | null;
  messages?: ChatMessage[];
}) {
  const [failedGreeting, setFailedGreeting] = useState<string | null>(null);
  const [failedChat, setFailedChat] = useState<string | null>(null);
  const entries = useRef(new Map<string, Resident>());
  const drag = useRef<Drag | null>(null);
  const wakeAnimation = useRef(() => {});

  useLayoutEffect(() => {
    const ids = new Set(residents.map((profile) => profile.id));
    for (const id of entries.current.keys())
      if (!ids.has(id)) entries.current.delete(id);
    if (drag.current && !ids.has(drag.current.id)) drag.current = null;
  }, [residents]);

  useEffect(() => {
    let frame: number | null = null;
    let previous = performance.now();
    const moving = (resident: Resident) =>
      needsAnimation(resident.body, resident.walking);
    const schedule = () => {
      if (paused) return;
      for (const resident of entries.current.values()) {
        if (moving(resident)) {
          frame = requestAnimationFrame(animate);
          break;
        }
      }
    };
    const animate = (now: number) => {
      frame = null;
      const elapsed = (now - previous) / 1000;
      previous = now;
      for (const resident of entries.current.values()) {
        if (!moving(resident)) continue;
        advanceBody(
          resident.body,
          elapsed,
          innerWidth,
          innerHeight,
          resident.walking,
        );
        const held = drag.current;
        if (held && entries.current.get(held.id) === resident)
          moveHeldBody(resident.body, held);
        draw(resident);
      }
      schedule();
    };
    const wake = () => {
      if (frame !== null) return;
      previous = performance.now();
      schedule();
    };
    const resize = () => {
      for (const resident of entries.current.values()) {
        moveBody(
          resident.body,
          resident.body.x,
          resident.body.y,
          innerWidth,
          innerHeight,
        );
        draw(resident);
      }
      wake();
    };
    wakeAnimation.current = wake;
    wake();
    window.addEventListener("resize", resize);
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      wakeAnimation.current = () => {};
    };
  }, [paused]);

  useEffect(() => {
    // Presence changes can wake an idle scene without resetting a running frame clock.
    wakeAnimation.current();
  }, [residents]);

  useEffect(() => {
    if (!isTauri()) return;
    const window = getCurrentWindow();
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    let interactive = false;
    // Click-through windows do not receive pointermove. Poll the native cursor to
    // enable input over a character or greeting, and keep capture until a drag ends.
    const poll = async () => {
      try {
        const [x, y] = await invoke<[number, number]>(
          "desktop_cursor_position",
        );
        if (disposed) return;
        let hit = !!drag.current;
        for (const { element } of entries.current.values()) {
          if (hit) break;
          for (const target of element.querySelectorAll(
            "svg, .resident-wave, .chat-bubble",
          )) {
            const rect = target.getBoundingClientRect();
            if (
              x >= rect.left - 6 &&
              x <= rect.right + 6 &&
              y >= rect.top - 6 &&
              y <= rect.bottom + 6
            ) {
              hit = true;
              break;
            }
          }
        }
        if (hit !== interactive) {
          await window.setIgnoreCursorEvents(!hit);
          interactive = hit;
        }
      } catch (error) {
        if (interactive) {
          await window.setIgnoreCursorEvents(true).catch(console.error);
          interactive = false;
        }
        console.error("Desktop pointer tracking failed:", error);
      } finally {
        if (!disposed) timer = setTimeout(poll, 24);
      }
    };
    void poll();
    return () => {
      disposed = true;
      clearTimeout(timer);
      void window.setIgnoreCursorEvents(true).catch(console.error);
    };
  }, []);

  function startDrag(event: PointerEvent<HTMLElement>, id: string) {
    if (
      event.button !== 0 ||
      drag.current ||
      (event.target as Element).closest("button")
    )
      return;
    const resident = entries.current.get(id)!;
    const body = resident.body;
    const svg = resident.element.querySelector(
      "svg.character",
    ) as SVGSVGElement;
    const matrix = svg.getScreenCTM();
    if (matrix) {
      const grip = new DOMPoint(event.clientX, event.clientY).matrixTransform(
        matrix.inverse(),
      );
      resident.element.style.setProperty("--grip-x", `${grip.x}px`);
      resident.element.style.setProperty("--grip-y", `${grip.y}px`);
    }
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    body.mode = "drag";
    body.vx = body.vy = 0;
    body.dragTilt = 0;
    const dx = event.clientX - body.x,
      dy = event.clientY - body.y;
    const cos = Math.cos(body.angle),
      sin = Math.sin(body.angle);
    drag.current = {
      id,
      pointerId: event.pointerId,
      offsetX: dx * cos + dy * sin,
      offsetY: -dx * sin + dy * cos,
      pointerX: event.clientX,
      pointerY: event.clientY,
      samples: [{ x: event.clientX, y: event.clientY, time: event.timeStamp }],
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    };
    draw(resident);
    wakeAnimation.current();
  }

  function moveDrag(event: PointerEvent<HTMLElement>) {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const resident = entries.current.get(current.id);
    if (!resident) return;
    current.moved ||= movedForDrag(
      current.startX,
      current.startY,
      event.clientX,
      event.clientY,
    );
    current.pointerX = event.clientX;
    current.pointerY = event.clientY;
    moveHeldBody(resident.body, current);
    current.samples = current.samples.filter(
      (sample) => event.timeStamp - sample.time <= 100,
    );
    // Turning upright moves the body, but only pointer movement should cause a throw.
    current.samples.push({
      x: event.clientX,
      y: event.clientY,
      time: event.timeStamp,
    });
    const { vx } = releaseVelocity(current.samples, event.timeStamp);
    resident.body.dragTilt = Math.max(-0.4, Math.min(0.4, vx / 2500));
    draw(resident);
    wakeAnimation.current();
  }

  function endDrag(event: PointerEvent<HTMLElement>, cancelled = false) {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    if (!cancelled) moveDrag(event);
    const resident = entries.current.get(current.id);
    if (resident) {
      Object.assign(
        resident.body,
        cancelled || !resident.walking
          ? { vx: 0, vy: 0 }
          : releaseVelocity(current.samples, event.timeStamp),
      );
      resident.body.mode = "air";
      resident.body.angle += resident.body.dragTilt;
      resident.body.dragTilt = 0;
      draw(resident);
      wakeAnimation.current();
    }
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    if (!cancelled && !current.moved) void openChat(current.id);
  }

  async function openChat(id: string) {
    if (!profileKey) return;
    try {
      await emitTo("main", OPEN_CHAT_EVENT, { profileKey, friendId: id });
      setFailedChat(null);
    } catch {
      setFailedChat(id);
    }
  }

  return (
    <section
      className={`desktop-characters ${paused ? "is-paused" : ""}`}
      aria-label="바탕화면 캐릭터"
    >
      {residents.map((resident) => {
        const name = `${resident.name}${resident.isSelf ? " (나)" : ""}`;
        const chat = latestChat(messages, resident.id);
        return (
          <figure
            key={resident.id}
            className={`desktop-resident ${resident.online ? "" : "is-resting"}`}
            data-wave={!!resident.wave}
            data-chat={!!chat}
            ref={(element) => {
              if (!element) return;
              const entry = {
                body:
                  entries.current.get(resident.id)?.body ??
                  createBody(resident.id, innerWidth, innerHeight),
                element,
                walking: resident.online,
              };
              entries.current.set(resident.id, entry);
              if (!resident.online) entry.body.vx = entry.body.vy = 0;
              draw(entry);
            }}
            title={`${name} · 클릭해서 채팅 · 드래그해서 이동`}
            onPointerDown={(event) => startDrag(event, resident.id)}
            onPointerMove={moveDrag}
            onPointerUp={(event) => endDrag(event)}
            onPointerCancel={(event) => endDrag(event, true)}
            onLostPointerCapture={(event) => endDrag(event, true)}
            onContextMenu={(event) => event.preventDefault()}
          >
            <div
              className="resident-rotation"
              role={profileKey ? "button" : undefined}
              tabIndex={profileKey ? 0 : undefined}
              aria-label={profileKey ? `${name} 캐릭터로 채팅 열기` : undefined}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  void openChat(resident.id);
                }
              }}
            >
              <div className="resident-facing">
                <Character
                  kind={resident.character}
                  asleep={!resident.online}
                />
              </div>
            </div>
            <figcaption className={resident.wave ? "has-wave" : undefined}>
              <ChatBubble message={chat} />
              {failedChat === resident.id && (
                <span role="alert">
                  채팅을 열지 못했어요. 다시 클릭해 주세요.
                </span>
              )}
              {resident.wave && (
                <button
                  type="button"
                  className="resident-wave"
                  aria-label={`${resident.name} 님의 인사 보기`}
                  title={
                    failedGreeting === resident.id
                      ? "열지 못했어요. 다시 누르거나 트레이에서 사이드바를 열어 주세요."
                      : "사이드바에서 인사 보기"
                  }
                  onClick={async () => {
                    if (!profileKey) return;
                    try {
                      await emitTo("main", OPEN_GREETING_EVENT, {
                        profileKey,
                        friendId: resident.id,
                      });
                      setFailedGreeting(null);
                    } catch {
                      setFailedGreeting(resident.id);
                    }
                  }}
                >
                  {failedGreeting === resident.id ? "다시 열기" : "👋 안녕!"}
                </button>
              )}
              <span className="resident-name">{name}</span>
            </figcaption>
          </figure>
        );
      })}
    </section>
  );
}
