import type { CSSProperties } from "react";
import type { SidebarState } from "@wappy/api";
import { Character } from "./Character";
import "./DesktopCharacters.css";

// Stable paths keep the same pace and position when the API refreshes profiles.
function motionStyle(id: string): CSSProperties {
  const seed = Array.from(id).reduce(
    (hash, letter) => (Math.imul(hash, 31) + letter.charCodeAt(0)) >>> 0,
    0,
  );
  const x = [seed % 101, (seed >>> 5) % 101, (seed >>> 10) % 101];
  const y = [(seed >>> 3) % 101, (seed >>> 8) % 101, (seed >>> 13) % 101];
  return {
    "--x0": `${x[0]}%`,
    "--y0": `${y[0]}%`,
    "--x1": `${x[1]}%`,
    "--y1": `${y[1]}%`,
    "--x2": `${x[2]}%`,
    "--y2": `${y[2]}%`,
    "--direction0": x[1] >= x[0] ? 1 : -1,
    "--direction1": x[2] >= x[1] ? 1 : -1,
    "--direction2": x[0] >= x[2] ? 1 : -1,
    "--duration": `${90 + (seed % 31)}s`,
    "--delay": `${-(seed % 20)}s`,
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
      <div className="park-ground">
        <div className="park-track">
          {residents.map((resident) => {
            const asleep = !connected || !resident.online;
            const name = `${resident.name}${resident.id === state.self.id ? " (나)" : ""}`;
            return (
              <div
                key={resident.id}
                className={`park-path ${asleep ? "is-resting" : ""}`}
                style={motionStyle(resident.id)}
              >
                <figure
                  className="park-resident"
                  title={`${name} · ${resident.status || (asleep ? "쉬고 있어요" : "산책 중이에요")}`}
                >
                  <div className="park-facing">
                    <Character kind={resident.character} asleep={asleep} />
                  </div>
                  <figcaption>{name}</figcaption>
                </figure>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
