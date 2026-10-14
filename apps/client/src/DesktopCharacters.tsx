import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import { isTauri, invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { DesktopResident } from "./resident-selection";
import {
  CHARACTER_SIZES,
  type CharacterActivity,
  type CharacterPosition,
  type CharacterSize,
} from "./preferences";
import {
  ATTACK_COOLDOWN_MS,
  type AttackEvent,
  type ChatMessage,
  type Character as CharacterKind,
} from "@wappy/api";
import { Character } from "./Character";
import { AttackEffects, drawAttackEffect } from "./AttackEffects";
import { ChatBubble } from "./ChatBubble";
import { ChatComposer } from "./ChatComposer";
import { requestDesktopChat } from "./chat-bridge";
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
  setBodyPosition,
  type Body,
  type DragSample,
} from "./desktop-physics";

type Resident = {
  body: Body;
  element: HTMLElement;
  captionHeight: number;
  walking: boolean;
  character: CharacterKind;
};
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

function draw(
  { body, element, captionHeight, walking }: Resident,
  attack: Attack | null,
) {
  element.dataset.attack = attack?.attacker === body ? attack.phase : "";
  element.dataset.attackStyle = attack?.attacker === body ? attack.kind : "";
  element.dataset.hit = String(
    attack?.target === body && attack.phase === "impact",
  );
  element.style.transform = `translate3d(${body.x - body.size / 2}px, ${body.y - body.size / 2}px, 0)`;
  element.style.setProperty("--character-size", `${body.size}px`);
  element.style.setProperty(
    "--character-scale",
    `${body.size / CHARACTER_SIZE}`,
  );
  element.style.setProperty("--angle", `${body.angle}rad`);
  element.style.setProperty("--facing", `${-body.direction}`);
  element.style.setProperty(
    "--drag-tilt",
    `${-body.direction * body.dragTilt}rad`,
  );
  element.style.setProperty("--step-delay", `${-body.stepPhase}s`);
  const flight = Math.min(1, Math.hypot(body.vx, body.vy) / 1600);
  element.style.setProperty("--flight-x", `${1 - flight * 0.08}`);
  element.style.setProperty("--flight-y", `${1 + flight * 0.14}`);
  element.style.setProperty(
    "--trail-opacity",
    `${Math.max(0, flight - 0.12) * 0.8}`,
  );
  element.style.setProperty("--resident-x", `${body.x}px`);
  element.style.setProperty("--resident-y", `${body.y}px`);
  element.dataset.captionBelow = String(
    body.y < captionHeight + body.size / 2 + 8,
  );
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
  position,
  size,
  activity,
  profileKey,
  messages,
  attacks,
  attackInbox,
  connected,
}: {
  residents: DesktopResident[];
  paused: boolean;
  position: CharacterPosition;
  size: CharacterSize;
  activity: CharacterActivity;
  profileKey: string | null;
  messages?: ChatMessage[];
  attacks?: AttackEvent[];
  attackInbox: AttackInbox;
  connected: boolean;
}) {
  const characterSize = CHARACTER_SIZES[size].pixels;
  const [chatTarget, setChatTarget] = useState<string | null>(null);
  const chatTargetRef = useRef(chatTarget);
  chatTargetRef.current = chatTarget;
  const composing = chatTarget !== null;
  const self = residents.find((resident) => resident.isSelf);
  const [attackNotice, setAttackNotice] = useState<string | null>(null);
  const entries = useRef(new Map<string, Resident>());
  const drag = useRef<Drag | null>(null);
  const attackEffect = useRef<SVGSVGElement | null>(null);
  const lastAttackAt = useRef(-Infinity);
  const attack = useRef<
    (Attack & { attackerId: string; targetId: string }) | null
  >(null);
  const wakeAnimation = useRef(() => {});

  useLayoutEffect(() => {
    stopAttack();
    const held = drag.current;
    drag.current = null;
    if (held) {
      const element = entries.current.get(held.id)?.element;
      if (element?.hasPointerCapture(held.pointerId))
        element.releasePointerCapture(held.pointerId);
    }
    for (const resident of entries.current.values()) {
      resident.body.size = characterSize;
      setBodyPosition(resident.body, position, innerWidth, innerHeight);
      draw(resident, null);
    }
    wakeAnimation.current();
  }, [position, characterSize]);

  useLayoutEffect(() => {
    wakeAnimation.current();
  }, [chatTarget]);

  useEffect(() => {
    if (!composing || !isTauri()) return;
    const currentWindow = getCurrentWindow();
    let disposed = false;
    void (async () => {
      await currentWindow.setFocusable(true);
      if (disposed) return;
      await currentWindow.setFocus();
      if (!disposed)
        entries.current
          .get(chatTargetRef.current ?? "")
          ?.element.querySelector("textarea")
          ?.focus();
    })().catch(() => {
      if (!disposed)
        setAttackNotice(
          "채팅 입력창에 포커스를 주지 못했어요. 닫고 다시 열어 주세요.",
        );
    });
    return () => {
      disposed = true;
      void currentWindow.setFocusable(false).catch(console.error);
    };
  }, [composing]);

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
    if (chatTargetRef.current && !ids.has(chatTargetRef.current))
      setChatTarget(null);
    const active = attack.current;
    if (active && (!ids.has(active.attackerId) || !ids.has(active.targetId)))
      stopAttack();
  }, [residents]);

  useLayoutEffect(() => {
    const visiblePresence = new Map(
      residents.map((resident) => [resident.id, resident.online]),
    );
    collectAttacks(
      attackInbox,
      attacks ?? [],
      visiblePresence,
      connected && !paused,
      performance.now(),
    );
    const active = attack.current;
    if (
      active &&
      (!connected ||
        paused ||
        !visiblePresence.get(active.attackerId) ||
        !visiblePresence.has(active.targetId))
    )
      stopAttack();
    startNextAttack();
    wakeAnimation.current();
  }, [attacks, residents, connected, paused, attackInbox]);

  useEffect(() => {
    let frame: number | null = null;
    let previous = performance.now();
    const moving = (resident: Resident) =>
      resident.element.dataset.composing !== "true" &&
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
          activity,
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
      drawAttackEffect(attackEffect.current, attack.current);
      schedule();
    };
    const wake = () => {
      if (frame !== null) return;
      previous = performance.now();
      schedule();
    };
    const resize = () => {
      for (const resident of entries.current.values()) {
        advanceBody(resident.body, 0, innerWidth, innerHeight, false);
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
  }, [paused, activity, connected, attackInbox]);

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
    // enable input over a character or chat input, and keep capture until a drag ends.
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
            "svg, .chat-composer",
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
      (event.target as Element).closest("button, .chat-composer")
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
        cancelled
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
    drawAttackEffect(attackEffect.current, null);
    for (const id of [active.attackerId, active.targetId]) {
      const resident = entries.current.get(id);
      if (resident) draw(resident, null);
    }
  }

  function startAttack(attackerId: string, targetId: string): boolean {
    const attacker = entries.current.get(attackerId);
    const target = entries.current.get(targetId);
    if (!attacker?.walking || !target) return false;
    const next = createAttack(attacker.body, target.body, attacker.character);
    if (!next) return false;
    attack.current = { ...next, attackerId, targetId };
    draw(attacker, attack.current);
    drawAttackEffect(attackEffect.current, attack.current);
    return true;
  }

  function startNextAttack() {
    if (
      attack.current ||
      drag.current ||
      chatTargetRef.current ||
      paused ||
      !connected
    )
      return;
    let event: AttackEvent | undefined;
    while ((event = nextAttack(attackInbox, performance.now())))
      if (startAttack(event.attackerId, event.targetId)) break;
  }

  function activateResident(id: string) {
    if (!residents.find((resident) => resident.id === id)?.isSelf) {
      void attackResident(id);
      return;
    }
    if (!profileKey || !self) return;
    stopAttack();
    setChatTarget(id);
  }

  async function attackResident(id: string) {
    const targetProfile = residents.find((resident) => resident.id === id);
    if (!targetProfile) return;
    if (targetProfile.isSelf) return;
    setChatTarget(null);
    if (paused) {
      setAttackNotice("움직임을 다시 시작하면 공격할 수 있어요.");
      return;
    }
    if (!profileKey || !connected || attacks === undefined) {
      setAttackNotice("온라인 공격을 지원하는 서버에 연결해 주세요.");
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

  return (
    <section
      className={`desktop-characters fixed inset-0 pointer-events-none overflow-hidden ${paused ? "is-paused" : ""}`}
      aria-label="바탕화면 캐릭터"
    >
      <AttackEffects effectRef={attackEffect} />
      {attackNotice && (
        <p
          className="
            attack-notice absolute left-[50%] bottom-[22px] [transform:translateX(-50%)] m-0 p-[9px_14px]
            rounded-[18px] bg-[#fbfbf7ef] text-[#536447] text-[12px] pointer-events-none
          "
          role="status"
        >
          {attackNotice}
        </p>
      )}
      {residents.map((resident) => {
        const name = `${resident.name}${resident.isSelf ? " (나)" : ""}`;
        const chat = latestChat(messages, resident.id);
        return (
          <figure
            key={resident.id}
            className="
              desktop-resident absolute top-0 left-0 w-[var(--character-size)] h-[var(--character-size)]
              [--caption-offset:calc(var(--character-size)_/_2_+_4px)] m-0 pointer-events-auto touch-none
              select-none cursor-grab [&[data-motion='drag']]:cursor-grabbing
              [&_.character]:w-[calc(var(--character-size)_*_38_/_42)]
              [&_.character]:h-[var(--character-size)] [&_.character]:m-auto
              [&_.character]:[filter:drop-shadow(0_2px_3px_#0002)] [&_.chat-bubble]:m-[0_0_4px]
              [&_.chat-bubble]:text-[11px] resident-motion
            "
            data-composing={chatTarget === resident.id}
            ref={(element) => {
              if (!element) return;
              const caption = element.querySelector("figcaption")!;
              const entry = {
                body:
                  entries.current.get(resident.id)?.body ??
                  createBody(
                    resident.id,
                    innerWidth,
                    innerHeight,
                    position,
                    characterSize,
                  ),
                element,
                captionHeight: caption.offsetHeight,
                walking: resident.online,
                character: resident.character,
              };
              entries.current.set(resident.id, entry);
              draw(entry, attack.current);
              const observer = new ResizeObserver(() => {
                entry.captionHeight = caption.offsetHeight;
                draw(entry, attack.current);
              });
              observer.observe(caption);
              return () => observer.disconnect();
            }}
            title={`${name} · ${resident.isSelf ? "클릭해서 채팅" : "클릭해서 공격"} · 드래그해서 이동`}
            onPointerDown={(event) => startDrag(event, resident.id)}
            onPointerMove={moveDrag}
            onPointerUp={(event) => endDrag(event)}
            onPointerCancel={(event) => endDrag(event, true)}
            onLostPointerCapture={(event) => endDrag(event, true)}
            onContextMenu={(event) => {
              if (!(event.target as Element).closest(".chat-composer"))
                event.preventDefault();
            }}
          >
            <div
              className="
                resident-rotation [transform:rotate(var(--angle))]
                focus-visible:[outline:2px_solid_#73985c] focus-visible:rounded-[12px]
              "
              role={!resident.isSelf || profileKey ? "button" : undefined}
              tabIndex={!resident.isSelf || profileKey ? 0 : undefined}
              aria-label={
                resident.isSelf
                  ? profileKey
                    ? `${name} 캐릭터 채팅 입력창 열기`
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
              <div className="resident-facing [transform:scaleX(var(--facing))]">
                <Character
                  kind={resident.character}
                  asleep={!resident.online}
                />
              </div>
            </div>
            <span
              className="
                resident-impact hidden absolute z-2 left-[calc(3.5px_*_var(--character-scale))]
                top-[calc(-6.5px_*_var(--character-scale))] w-[calc(35px_*_var(--character-scale))]
                h-[calc(35px_*_var(--character-scale))] items-center justify-center text-[#754925]
                text-[calc(8.5px_*_var(--character-scale))] font-black pointer-events-none
                before:content-['✹'] before:absolute before:-z-1 before:text-[#ffe294]
                before:text-[calc(38px_*_var(--character-scale))] before:[transform:translateY(-0.06em)]
                before:[text-shadow:1px_1px_#bd7c3f,_-1px_-1px_#bd7c3f]
              "
              aria-hidden="true"
            >
              팡!
            </span>
            <figcaption
              className="
              resident-caption absolute left-[50%] top-[50%] w-max max-w-[84px] p-[3px_4px] rounded-[6px]
              bg-[#fbfbf7e8] text-[#536447] text-[9px] text-center whitespace-nowrap overflow-hidden
              text-ellipsis pointer-events-none has-[.chat-bubble]:w-[184px]
              has-[.chat-bubble]:max-w-[184px] has-[.chat-bubble]:whitespace-normal
              has-[.chat-bubble]:overflow-visible has-[.chat-composer]:w-max
              has-[.chat-composer]:max-w-[calc(100vw_-_8px)] has-[.chat-composer]:p-0
              has-[.chat-composer]:bg-transparent has-[.chat-composer]:overflow-visible
              [.desktop-resident[data-caption-below='true']_&]:[--caption-y:var(--caption-offset)]
            "
            >
              {chatTarget === resident.id && self && profileKey ? (
                <ChatComposer
                  connected={connected && messages !== undefined}
                  onSend={(text) => requestDesktopChat(profileKey, text)}
                  onClose={() => setChatTarget(null)}
                />
              ) : (
                <>
                  <ChatBubble message={chat} />
                  <span className="resident-name block overflow-hidden text-ellipsis">
                    {name}
                  </span>
                </>
              )}
            </figcaption>
          </figure>
        );
      })}
    </section>
  );
}
