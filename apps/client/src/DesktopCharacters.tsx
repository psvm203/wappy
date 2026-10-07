import { useEffect, useLayoutEffect, useRef, type PointerEvent } from "react";
import { isTauri, invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { SidebarState } from "@wappy/api";
import { Character } from "./Character";
import {
  advanceBody,
  CHARACTER_SIZE,
  createBody,
  moveBody,
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
  samples: DragSample[];
};

function draw({ body, element }: Resident) {
  element.style.transform = `translate3d(${body.x - CHARACTER_SIZE / 2}px, ${body.y - CHARACTER_SIZE / 2}px, 0)`;
  element.style.setProperty("--angle", `${body.angle}rad`);
  element.style.setProperty("--facing", `${-body.direction}`);
  const nameX = Math.max(
    46,
    Math.min(innerWidth - 46, body.x + Math.sin(body.angle) * 92),
  );
  const nameY = Math.max(
    12,
    Math.min(innerHeight - 12, body.y - Math.cos(body.angle) * 68),
  );
  element.style.setProperty("--name-x", `${nameX - body.x}px`);
  element.style.setProperty("--name-y", `${nameY - body.y}px`);
  element.dataset.motion =
    body.mode === "walk" && body.restTime > 0 ? "idle" : body.mode;
}

export function DesktopCharacters({
  state,
  connected,
  paused,
}: {
  state: SidebarState;
  connected: boolean;
  paused: boolean;
}) {
  const entries = useRef(new Map<string, Resident>());
  const drag = useRef<Drag | null>(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  // The local pet keeps walking even if the presence server is temporarily unreachable.
  const residents = [
    { ...state.self, online: true },
    ...state.friends.map((friend) => ({
      ...friend,
      online: connected && friend.online,
    })),
  ];

  useLayoutEffect(() => {
    const ids = new Set([
      state.self.id,
      ...state.friends.map((friend) => friend.id),
    ]);
    for (const id of entries.current.keys())
      if (!ids.has(id)) entries.current.delete(id);
    if (drag.current && !ids.has(drag.current.id)) drag.current = null;
  }, [state]);

  useEffect(() => {
    let frame: number;
    let previous = performance.now();
    const animate = (now: number) => {
      const elapsed = (now - previous) / 1000;
      previous = now;
      for (const resident of entries.current.values()) {
        if (!pausedRef.current)
          advanceBody(
            resident.body,
            elapsed,
            innerWidth,
            innerHeight,
            resident.walking,
          );
        else
          moveBody(
            resident.body,
            resident.body.x,
            resident.body.y,
            innerWidth,
            innerHeight,
          );
        draw(resident);
      }
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!isTauri()) return;
    const window = getCurrentWindow();
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    let interactive = false;
    // Click-through windows do not receive pointermove. Poll the native cursor to
    // enable input only over a character, and keep capture until a drag ends.
    const poll = async () => {
      try {
        const [x, y] = await invoke<[number, number]>(
          "desktop_cursor_position",
        );
        if (disposed) return;
        const hit =
          !!drag.current ||
          [...entries.current.values()].some(({ element }) => {
            const rect = element.querySelector("svg")!.getBoundingClientRect();
            return (
              x >= rect.left - 6 &&
              x <= rect.right + 6 &&
              y >= rect.top - 6 &&
              y <= rect.bottom + 6
            );
          });
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
    if (event.button !== 0 || drag.current) return;
    const resident = entries.current.get(id)!;
    const body = resident.body;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    body.mode = "drag";
    body.vx = body.vy = 0;
    drag.current = {
      id,
      pointerId: event.pointerId,
      offsetX: event.clientX - body.x,
      offsetY: event.clientY - body.y,
      samples: [{ x: body.x, y: body.y, time: event.timeStamp }],
    };
    draw(resident);
  }

  function moveDrag(event: PointerEvent<HTMLElement>) {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    const resident = entries.current.get(current.id);
    if (!resident) return;
    moveBody(
      resident.body,
      event.clientX - current.offsetX,
      event.clientY - current.offsetY,
      innerWidth,
      innerHeight,
    );
    current.samples = current.samples.filter(
      (sample) => event.timeStamp - sample.time <= 100,
    );
    current.samples.push({
      x: resident.body.x,
      y: resident.body.y,
      time: event.timeStamp,
    });
    draw(resident);
  }

  function endDrag(event: PointerEvent<HTMLElement>, cancelled = false) {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    if (!cancelled) moveDrag(event);
    const resident = entries.current.get(current.id);
    if (resident) {
      Object.assign(
        resident.body,
        cancelled
          ? { vx: 0, vy: 0 }
          : releaseVelocity(current.samples, event.timeStamp),
      );
      resident.body.mode = "air";
      draw(resident);
    }
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  }

  return (
    <section
      className={`desktop-characters ${paused ? "is-paused" : ""}`}
      aria-label="바탕화면 캐릭터"
    >
      {residents.map((resident) => {
        const name = `${resident.name}${resident.id === state.self.id ? " (나)" : ""}`;
        return (
          <figure
            key={resident.id}
            className={`desktop-resident ${resident.online ? "" : "is-resting"}`}
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
              draw(entry);
            }}
            title={`${name} · 드래그해서 옮기고 빠르게 놓아 던져보세요`}
            onPointerDown={(event) => startDrag(event, resident.id)}
            onPointerMove={moveDrag}
            onPointerUp={(event) => endDrag(event)}
            onPointerCancel={(event) => endDrag(event, true)}
            onLostPointerCapture={(event) => endDrag(event, true)}
            onContextMenu={(event) => event.preventDefault()}
          >
            <div className="resident-rotation">
              <div className="resident-facing">
                <Character
                  kind={resident.character}
                  asleep={!resident.online}
                />
              </div>
            </div>
            <figcaption>{name}</figcaption>
          </figure>
        );
      })}
    </section>
  );
}
