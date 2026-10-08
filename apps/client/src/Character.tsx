import type { ComponentType } from "react";
import { CHARACTER_NAMES, type Character as CharacterKind } from "@wappy/api";
import { Chiikawa, Hachiware, Usagi } from "./ChiikawaTrio";
import { Momonga, Kurimanju, Furuhonya } from "./ChiikawaFriends";
import { Rakko, Shisa } from "./ChiikawaGuardians";

const appearances: Record<CharacterKind, ComponentType<{ asleep: boolean }>> = {
  chiikawa: Chiikawa,
  hachiware: Hachiware,
  usagi: Usagi,
  momonga: Momonga,
  kurimanju: Kurimanju,
  rakko: Rakko,
  shisa: Shisa,
  furuhonya: Furuhonya,
};

export function Character({
  kind,
  asleep = false,
}: {
  kind: CharacterKind;
  asleep?: boolean;
}) {
  const Artwork = appearances[kind];
  return (
    <svg
      viewBox="0 0 100 110"
      role="img"
      aria-label={`${CHARACTER_NAMES[kind]} 캐릭터${asleep ? ", 오프라인" : ""}`}
      className={`character ${asleep ? "asleep" : "awake"}`}
    >
      <ellipse
        className="character-shadow"
        cx="50"
        cy="101"
        rx="29"
        ry="5"
        fill="#252a3b"
        opacity=".1"
      />
      <g
        className="character-flight-trail"
        opacity="0"
        fill="none"
        stroke="#829880"
        strokeWidth="2.4"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <path d="M31 101v12M50 105v17M69 101v12" />
      </g>
      <g className="character-pose">
        <g className="character-body">
          <Artwork asleep={asleep} />
        </g>
      </g>
      {asleep && (
        <g
          className="sleep-marks"
          fill="#65745d"
          aria-hidden="true"
          fontFamily="sans-serif"
          fontWeight="700"
        >
          <text x="90" y="23" fontSize="11">
            z
          </text>
          <text x="95" y="12" fontSize="8">
            z
          </text>
        </g>
      )}
    </svg>
  );
}
