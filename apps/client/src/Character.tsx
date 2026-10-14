import type { ComponentType } from "react";
import { CHARACTER_NAMES, type Character as CharacterKind } from "@wappy/api";
import {
  Chiikawa,
  Hachiware,
  Usagi,
  Momonga,
  Kurimanju,
  Furuhonya,
  Rakko,
  Shisa,
} from "./Chiikawa";
import {
  IronMan,
  CaptainAmerica,
  Thor,
  Hulk,
  BlackWidow,
  Hawkeye,
} from "./Avengers";
import {
  Pochacco,
  BadtzMaru,
  Hangyodon,
  Pekkle,
  Tuxedosam,
  Keroppi,
} from "./Sanrio";
import {
  Slime,
  OrangeMushroom,
  PinkBean,
  StoneSpirit,
  Yeti,
} from "./MapleStory";

const appearances: Record<CharacterKind, ComponentType<{ asleep: boolean }>> = {
  chiikawa: Chiikawa,
  hachiware: Hachiware,
  usagi: Usagi,
  momonga: Momonga,
  kurimanju: Kurimanju,
  rakko: Rakko,
  shisa: Shisa,
  furuhonya: Furuhonya,
  ironman: IronMan,
  "captain-america": CaptainAmerica,
  thor: Thor,
  hulk: Hulk,
  "black-widow": BlackWidow,
  hawkeye: Hawkeye,
  pochacco: Pochacco,
  "badtz-maru": BadtzMaru,
  hangyodon: Hangyodon,
  pekkle: Pekkle,
  tuxedosam: Tuxedosam,
  keroppi: Keroppi,
  slime: Slime,
  "orange-mushroom": OrangeMushroom,
  "pink-bean": PinkBean,
  "stone-spirit": StoneSpirit,
  yeti: Yeti,
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
      className={`character block w-full overflow-visible ${asleep ? "asleep [filter:saturate(0.45)] opacity-70" : "awake"}`}
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
        <g
          className={`character-body ${asleep ? "origin-[50px_96px] animate-sleeping-breathe" : "origin-[50px_100px] animate-breathe"}`}
        >
          <Artwork asleep={asleep} />
        </g>
      </g>
      {asleep && (
        <g
          className="sleep-marks animate-sleeping-marks"
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
