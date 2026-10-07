import type { CSSProperties } from "react";
import type { SidebarState } from "@wappy/api";
import { Character } from "./Character";
import "./DesktopCharacters.css";

// Stable starting points keep polling from restarting each character's walk.
function motionStyle(id: string): CSSProperties {
  const seed = Array.from(id).reduce(
    (hash, letter) => (Math.imul(hash, 31) + letter.charCodeAt(0)) >>> 0,
    0,
  );
  const start = seed % 100;
  const direction = seed % 2 === 0 ? 1 : -1;
  return {
    "--start": `${start}%`,
    "--finish": `${start + direction * 100}%`,
    "--facing": -direction,
    "--duration": `${90 + (seed % 31)}s`,
  } as CSSProperties;
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
  const residents = [{ ...state.self, online: connected }, ...state.friends];
  return (
    <section
      className={`desktop-characters ${paused ? "is-paused" : ""}`}
      aria-label="바탕화면 캐릭터"
    >
      {residents.map((resident) => {
        const asleep = !connected || !resident.online;
        const name = `${resident.name}${resident.id === state.self.id ? " (나)" : ""}`;
        return (
          <figure
            key={resident.id}
            className={`edge-walker ${asleep ? "is-resting" : ""}`}
            style={motionStyle(resident.id)}
            title={`${name} · ${resident.status || (asleep ? "쉬고 있어요" : "산책 중이에요")}`}
          >
            <figcaption>{name}</figcaption>
            <div className="edge-facing">
              <Character kind={resident.character} asleep={asleep} />
            </div>
          </figure>
        );
      })}
    </section>
  );
}
