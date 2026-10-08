import { CHARACTER_NAMES, type Character as CharacterKind } from "@wappy/api";

const colors: Record<CharacterKind, string> = {
  bunny: "#e5b9f4",
  cat: "#f7c67b",
  bear: "#afc5f7",
  frog: "#a2d6a1",
};

export function Character({
  kind,
  asleep = false,
}: {
  kind: CharacterKind;
  asleep?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 100 110"
      role="img"
      aria-label={`${CHARACTER_NAMES[kind]} 캐릭터${asleep ? ", 오프라인" : ""}`}
      className={`character ${asleep ? "asleep" : "awake"}`}
    >
      <ellipse cx="50" cy="101" rx="29" ry="5" fill="#252a3b" opacity=".1" />
      <g
        className="character-body"
        fill={colors[kind]}
        stroke="#35303f"
        strokeWidth="2.4"
        strokeLinejoin="round"
      >
        {kind === "bunny" && (
          <>
            <path d="M31 42C13 8 30 0 39 34" />
            <path d="M61 35C64 0 84 7 73 43" />
          </>
        )}
        {kind === "cat" && (
          <>
            <path d="M22 48L19 18L43 32" />
            <path d="M60 32L83 18L81 49" />
          </>
        )}
        {kind === "bear" && (
          <>
            <circle cx="26" cy="32" r="13" />
            <circle cx="74" cy="32" r="13" />
          </>
        )}
        {kind === "frog" && (
          <>
            <circle cx="29" cy="32" r="15" />
            <circle cx="71" cy="32" r="15" />
          </>
        )}
        <path d="M25 69C11 83 17 89 27 84L29 96Q36 103 43 96L57 96Q65 103 72 96L74 84C86 90 89 79 76 69Z" />
        <rect x="16" y="30" width="68" height="48" rx="24" />
      </g>
      <ellipse cx="50" cy="87" rx="11" ry="8" fill="#fff" opacity=".4" />
      <g fill="none" stroke="#35303f" strokeWidth="2.8" strokeLinecap="round">
        {asleep ? (
          <>
            <path d="M31 51l8 2M61 53l8-2" />
          </>
        ) : (
          <>
            <path d="M35 49v5M65 49v5" />
          </>
        )}
        <path d="M44 59q6 7 12 0" />
        {kind === "cat" && (
          <path d="M16 55l8 2m-7 5 7-1m60-6-8 2m7 5-7-1" strokeWidth="1.5" />
        )}
      </g>
      <g fill="#df8298" opacity=".45">
        <ellipse cx="27" cy="60" rx="5" ry="3" />
        <ellipse cx="73" cy="60" rx="5" ry="3" />
      </g>
      {asleep && (
        <g
          className="sleep-marks"
          fill="#65745d"
          aria-hidden="true"
          fontFamily="sans-serif"
          fontWeight="700"
        >
          <text x="77" y="26" fontSize="13">
            z
          </text>
          <text x="87" y="15" fontSize="10">
            z
          </text>
        </g>
      )}
    </svg>
  );
}
