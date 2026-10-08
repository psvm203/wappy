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
import {
  ATTACK_COOLDOWN_MS,
  type AttackEvent,
  type ChatMessage,
} from "@wappy/api";
import { Character } from "./Character";
import { OPEN_CHAT_EVENT, OPEN_GREETING_EVENT } from "./desktop";
import { ChatBubble } from "./ChatPanel";
import { latestChat, movedForDrag } from "./chat";
import { requestDesktopAttack } from "./attack-bridge";
import { collectAttacks, nextAttack, type AttackInbox } from "./online-attacks";
import {
  advanceAttack,
  cancelAttack,
  createAttack,
  type Attack,
} from "./desktop-attack";
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

function draw({ body, element, walking }: Resident, attack: Attack | null) {
  element.dataset.attack = attack?.attacker === body ? attack.phase : "";
  element.dataset.hit = String(
    attack?.target === body && attack.phase === "impact",
  );
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
  attacks,
  attackInbox,
  connected,
}: {
  residents: DesktopResident[];
  paused: boolean;
  profileKey: string | null;
  messages?: ChatMessage[];
  attacks?: AttackEvent[];
  attackInbox: AttackInbox;
  connected: boolean;
}) {
  const [failedGreeting, setFailedGreeting] = useState<string | null>(null);
  const [failedChat, setFailedChat] = useState<string | null>(null);
  const [attackNotice, setAttackNotice] = useState<string | null>(null);
  const entries = useRef(new Map<string, Resident>());
  const drag = useRef<Drag | null>(null);
  const lastAttackAt = useRef(-Infinity);
  const attack = useRef<
    (Attack & { attackerId: string; targetId: string }) | null
  >(null);
  const wakeAnimation = useRef(() => {});

  useEffect(() => {
    if (!attackNotice) return;
    const timer = setTimeout(() => setAttackNotice(null), 3200);
    return () => clearTimeout(timer);
  }, [attackNotice]);

  useLayoutEffect(() => {
    const ids = new Set(residents.map((profile) => profile.id));
    for (const id of entries.current.keys())
      if (!ids.has(id)) entries.current.delete(id);
    if (drag.current && !ids.has(drag.current.id)) drag.current = null;
    const active = attack.current;
    if (active && (!ids.has(active.attackerId) || !ids.has(active.targetId)))
      stopAttack();
  }, [residents]);

  useLayoutEffect(() => {
    const online = new Set(
      residents
        .filter((resident) => resident.online)
        .map((resident) => resident.id),
    );
    collectAttacks(
      attackInbox,
      attacks ?? [],
      online,
      connected && !paused,
      performance.now(),
    );
    const active = attack.current;
    if (
      active &&
      (!connected ||
        paused ||
        !online.has(active.attackerId) ||
        !online.has(active.targetId))
    )
      stopAttack();
    startNextAttack();
    wakeAnimation.current();
  }, [attacks, residents, connected, paused, attackInbox]);

  useEffect(() => {
    let frame: number | null = null;
    let previous = performance.now();
    const moving = (resident: Resident) =>
      needsAnimation(resident.body, resident.walking);
    const schedule = () => {
      if (paused) return;
      if (attack.current) {
        frame = requestAnimationFrame(animate);
        return;
      }
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
      startNextAttack();
      for (const resident of entries.current.values()) {
        const active = attack.current;
        if (
          active &&
          (resident.body === active.attacker ||
            (resident.body === active.target && active.phase === "impact"))
        )
          continue;
        if (!moving(resident)) continue;
        advanceBody(
          resident.body,
          elapsed,
          innerWidth,
          innerHeight,
          resident.walking,
        );
        const held = drag.current;
        if (held?.moved && entries.current.get(held.id) === resident)
          moveHeldBody(resident.body, held);
        draw(resident, attack.current);
      }
      const active = attack.current;
      if (active) {
        const attacker = entries.current.get(active.attackerId);
        const target = entries.current.get(active.targetId);
        if (!attacker || !target) stopAttack();
        else {
          if (
            advanceAttack(
              active,
              elapsed,
              innerWidth,
              innerHeight,
              target.walking,
            ) === "done"
          )
            attack.current = null;
          draw(attacker, attack.current);
          draw(target, attack.current);
        }
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
        draw(resident, attack.current);
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
  }, [paused, connected, attackInbox]);

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
      (event.target as Element).closest("button, .chat-bubble")
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
  }

  function moveDrag(event: PointerEvent<HTMLElement>) {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const resident = entries.current.get(current.id);
    if (!resident) return;
    const moved = movedForDrag(
      current.startX,
      current.startY,
      event.clientX,
      event.clientY,
    );
    if (!current.moved) {
      if (!moved) return;
      const active = attack.current;
      if (
        active &&
        (active.attackerId === current.id || active.targetId === current.id)
      )
        stopAttack();
      current.moved = true;
      resident.body.mode = "drag";
      resident.body.vx = resident.body.vy = resident.body.dragTilt = 0;
    }
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
    draw(resident, attack.current);
    wakeAnimation.current();
  }

  function endDrag(event: PointerEvent<HTMLElement>, cancelled = false) {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    if (!cancelled) moveDrag(event);
    const resident = entries.current.get(current.id);
    if (resident && current.moved) {
      Object.assign(
        resident.body,
        cancelled || !resident.walking
          ? { vx: 0, vy: 0 }
          : releaseVelocity(current.samples, event.timeStamp),
      );
      resident.body.mode = "air";
      resident.body.angle += resident.body.dragTilt;
      resident.body.dragTilt = 0;
      draw(resident, attack.current);
      wakeAnimation.current();
    }
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    if (!cancelled && !current.moved) activateResident(current.id);
  }

  function stopAttack() {
    const active = attack.current;
    if (!active) return;
    cancelAttack(active);
    attack.current = null;
    for (const id of [active.attackerId, active.targetId]) {
      const resident = entries.current.get(id);
      if (resident) draw(resident, null);
    }
  }

  function startAttack(attackerId: string, targetId: string): boolean {
    const attacker = entries.current.get(attackerId);
    const target = entries.current.get(targetId);
    if (!attacker?.walking || !target?.walking) return false;
    const next = createAttack(attacker.body, target.body);
    if (!next) return false;
    attack.current = { ...next, attackerId, targetId };
    draw(attacker, attack.current);
    return true;
  }

  function startNextAttack() {
    if (attack.current || drag.current || paused || !connected) return;
    let event: AttackEvent | undefined;
    while ((event = nextAttack(attackInbox, performance.now())))
      if (startAttack(event.attackerId, event.targetId)) break;
  }

  async function activateResident(id: string) {
    const targetProfile = residents.find((resident) => resident.id === id);
    if (!targetProfile) return;
    if (targetProfile.isSelf) {
      void openChat(id);
      return;
    }
    if (paused) {
      setAttackNotice("움직임을 다시 시작하면 공격할 수 있어요.");
      return;
    }
    if (!profileKey || !connected || attacks === undefined) {
      setAttackNotice("온라인 공격을 지원하는 서버에 연결해 주세요.");
      return;
    }
    if (!targetProfile.online) {
      setAttackNotice("접속 중인 친구에게 공격할 수 있어요.");
      return;
    }
    const self = residents.find((resident) => resident.isSelf);
    if (!self) {
      setAttackNotice("내 캐릭터를 표시하면 공격할 수 있어요.");
      return;
    }
    if (attack.current || drag.current) return;
    const now = performance.now();
    if (now - lastAttackAt.current < ATTACK_COOLDOWN_MS) {
      setAttackNotice("공격은 2초에 한 번 보낼 수 있어요.");
      return;
    }
    if (!startAttack(self.id, id)) return;
    lastAttackAt.current = now;
    wakeAnimation.current();
    setAttackNotice(null);
    try {
      const event = await requestDesktopAttack(profileKey, id);
      if (event.attackerId !== self.id)
        throw new Error("공격한 캐릭터를 확인하지 못했어요.");
    } catch (cause) {
      setAttackNotice(
        cause instanceof Error
          ? cause.message
          : "공격을 보내지 못했어요. 다시 시도해 주세요.",
      );
    }
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
      {attackNotice && (
        <p className="attack-notice" role="status">
          {attackNotice}
        </p>
      )}
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
              draw(entry, attack.current);
            }}
            title={`${name} · ${resident.isSelf ? "클릭해서 채팅" : "클릭해서 공격"} · 드래그해서 이동`}
            onPointerDown={(event) => startDrag(event, resident.id)}
            onPointerMove={moveDrag}
            onPointerUp={(event) => endDrag(event)}
            onPointerCancel={(event) => endDrag(event, true)}
            onLostPointerCapture={(event) => endDrag(event, true)}
            onContextMenu={(event) => event.preventDefault()}
          >
            <div
              className="resident-rotation"
              role={!resident.isSelf || profileKey ? "button" : undefined}
              tabIndex={!resident.isSelf || profileKey ? 0 : undefined}
              aria-label={
                resident.isSelf
                  ? profileKey
                    ? `${name} 캐릭터로 채팅 열기`
                    : undefined
                  : `내 캐릭터로 ${name} 공격하기`
              }
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  if (!event.repeat) activateResident(resident.id);
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
            <span className="resident-impact" aria-hidden="true">
              팡!
            </span>
            <figcaption
              className={resident.wave ? "has-wave" : undefined}
              onClick={(event) => {
                if ((event.target as Element).closest(".chat-bubble"))
                  void openChat(resident.id);
              }}
            >
              <ChatBubble message={chat} />
              {failedChat === resident.id && (
                <span role="alert">
                  채팅을 열지 못했어요. 말풍선이나 친구 목록에서 다시 열어
                  주세요.
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
