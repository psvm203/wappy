export function Slime({ asleep }: { asleep: boolean }) {
  return (
    <g
      fill="#c9df55"
      stroke="#a2b94c"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path
        d="M62 42C60 31 72 29 74 40L76 52Q78 61 89 53"
        fill="none"
        stroke="#d2b339"
        strokeWidth="4"
      />
      <path
        d="M62 42C60 31 72 29 74 40L76 52Q78 61 89 53"
        fill="none"
        stroke="#fff3bb"
        strokeWidth="1.8"
      />
      <circle cx="91" cy="48" r="6.5" />
      <ellipse cx="89" cy="46" rx="1.8" ry="2.5" fill="#e5ef94" stroke="none" />
      <path d="M61 40C49 49 23 50 12 67C-1 87 20 98 44 101C70 105 83 98 80 83C78 67 67 52 64 42Q63 39 61 40Z" />
      <g transform="rotate(20 45 76)" stroke="#634139" strokeWidth="1.8">
        {asleep ? (
          <path d="M25 69q5 6 10 0M53 69q5 6 10 0" fill="none" />
        ) : (
          <g fill="#634139" stroke="none">
            <circle cx="30" cy="69" r="6" />
            <circle cx="58" cy="69" r="6" />
            <g fill="#ffdf69">
              <path d="M30 64l1.5 3.5L35 69l-3.5 1.5L30 74l-1.5-3.5L25 69l3.5-1.5ZM58 64l1.5 3.5L63 69l-3.5 1.5L58 74l-1.5-3.5L53 69l3.5-1.5Z" />
            </g>
          </g>
        )}
        {!asleep && <path d="M39 79C37 95 49 94 49 79" fill="#f187ad" />}
        <path d="M37 77q3 5 7 0q3 5 7 0" fill="none" />
      </g>
    </g>
  );
}

export function OrangeMushroom({ asleep }: { asleep: boolean }) {
  return (
    <g
      fill="#fff0dc"
      stroke="#ddcbb1"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path
        d="M7 58C11 47 28 32 39 24C49 17 60 20 70 28C79 36 92 47 96 57Q101 70 83 75L18 75Q1 72 7 58Z"
        fill="#ffa52f"
        stroke="#df9e48"
      />
      <g fill="#ffe566" stroke="none">
        <path d="M30 32Q34 28 40 24C45 26 40 32 35 34Q31 35 30 32Z" />
        <ellipse cx="64" cy="37" rx="7" ry="5" transform="rotate(30 64 37)" />
        <path d="M11 56Q13 50 18 46C22 48 18 56 14 60Q10 61 11 56Z" />
        <ellipse cx="91" cy="61" rx="4.5" ry="7" transform="rotate(15 91 61)" />
        <path d="M34 60Q34 47 44 47Q54 47 54 60Z" />
      </g>
      <path
        d="M19 67C18 54 81 54 83 67L81 77H19Z"
        fill="#bd863d"
        stroke="none"
      />
      <path d="M22 65C18 73 14 84 17 93C22 103 72 103 80 94C86 87 79 71 77 65C64 58 34 58 22 65Z" />
      <g fill="#f2b29c" stroke="none">
        <ellipse cx="28" cy="77" rx="3" ry="1.8" />
        <ellipse cx="72" cy="77" rx="3" ry="1.8" />
      </g>
      <g stroke="#604039" strokeWidth="1.8">
        {asleep ? (
          <path d="M31 72q4 5 8 0M59 72q4 5 8 0" fill="none" />
        ) : (
          <g fill="#604039" stroke="none">
            <ellipse cx="35" cy="72" rx="2.8" ry="3.2" />
            <ellipse cx="63" cy="72" rx="2.8" ry="3.2" />
          </g>
        )}
        {!asleep && <path d="M44 76C42 91 56 91 55 76" fill="#f58e87" />}
        <path d="M41 74q3 4 8 1q4 3 8-1" fill="none" />
      </g>
    </g>
  );
}

export function PinkBean({ asleep }: { asleep: boolean }) {
  return (
    <g
      fill="#f8c0d7"
      stroke="#dea0bc"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <g fill="#d96598" stroke="#bd6e96">
        <ellipse cx="27" cy="100" rx="10" ry="3" />
        <ellipse cx="73" cy="100" rx="10" ry="3" />
      </g>
      <path
        d="M20 34L17 10Q16 5 22 6L43 14M60 14L77 7Q83 5 82 14L80 36"
        fill="#9567b0"
        stroke="#805697"
      />
      <path
        d="M18 13l12-3M19 23l17-10M69 10l13 6M64 13l17 12"
        fill="none"
        stroke="#875ca2"
        strokeWidth="2"
      />
      <path d="M17 51C12 30 25 11 49 11C75 10 85 29 83 54L84 77C83 94 68 99 50 99C28 99 13 94 14 76L16 62C7 60 3 50 7 49Q10 48 17 51Z" />
      <path
        d="M25 92C21 75 34 56 50 56C67 56 81 74 76 92L72 97Q50 101 28 97Z"
        fill="#fffefd"
        stroke="none"
      />
      <path d="M81 53C100 61 102 70 82 69" />
      <g fill="#efa0c1" stroke="none">
        <ellipse cx="27" cy="47" rx="3.8" ry="2.5" />
        <ellipse cx="74" cy="47" rx="3.8" ry="2.5" />
      </g>
      <g stroke="#65434f" strokeWidth="1.8">
        {asleep ? (
          <path d="M31 42q5 5 10 0M59 42q5 5 10 0" fill="none" />
        ) : (
          <>
            <ellipse
              cx="37"
              cy="42"
              rx="4.7"
              ry="5"
              fill="#65434f"
              stroke="none"
            />
            <ellipse
              cx="37"
              cy="42"
              rx="2.5"
              ry="2.8"
              fill="#fffefd"
              stroke="none"
            />
            <path
              d="M66 38l-7 4l7 4"
              fill="none"
              stroke="#fffefd"
              strokeWidth="6"
            />
            <path d="M66 38l-7 4l7 4" fill="none" strokeWidth="2" />
            <path d="M46 48C45 66 57 66 56 48" fill="#f383b0" />
          </>
        )}
        <path d="M44 46q3 4 7 1q3 3 7-1" fill="none" />
      </g>
    </g>
  );
}

export function StoneSpirit({ asleep }: { asleep: boolean }) {
  return (
    <g
      fill="#a8e1e2"
      stroke="#87bdba"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M25 91L24 97Q23 102 29 102Q33 102 34 94M65 94L68 101Q74 105 77 100L74 91" />
      <path d="M31 55C20 59 14 70 15 81C14 92 24 96 38 95L62 95C77 98 84 90 83 78C82 65 73 56 61 55Z" />
      <path d="M28 97v3M72 98l1 3" fill="none" strokeWidth="1" />
      <g fill="#d3f1ee" stroke="none">
        <ellipse cx="27" cy="85" rx="3" ry="1.6" />
        <ellipse cx="73" cy="85" rx="3" ry="1.6" />
      </g>
      <g stroke="#285f60" strokeWidth="1.8">
        {asleep ? (
          <path d="M31 78q5 6 10 0M58 78q5 6 10 0" fill="none" />
        ) : (
          <g fill="#285f60" stroke="none">
            <ellipse cx="36" cy="78" rx="4" ry="5.6" />
            <ellipse cx="63" cy="78" rx="4" ry="5.6" />
          </g>
        )}
        {!asleep && <path d="M47 83Q47 94 53 84" fill="#285f60" />}
        <path d="M45 82q4 3 9 0" fill="none" />
      </g>
      <g fill="#c3e9b0" stroke="#9bc48e">
        <path d="M35 33L35 23C30 20 33 15 37 16C42 16 42 21 39 23L39 32M42 31L46 18C42 14 46 9 50 11C54 13 52 17 49 18L47 31M50 31L54 23C53 18 58 15 61 19C65 23 61 26 58 25L55 33" />
        <path d="M21 47C22 34 36 28 50 28C65 27 75 34 76 45C80 57 72 61 61 59L38 60C23 64 17 59 21 47Z" />
        <path d="M29 58Q23 53 29 53L33 56M68 57q5-3 7 0" fill="none" />
      </g>
      <g stroke="#3f6737" strokeWidth="1.7">
        {asleep ? (
          <path d="M38 47q4 5 8 0M60 44q4 5 8 0" fill="none" />
        ) : (
          <g fill="#3f6737" stroke="none">
            <ellipse cx="42" cy="47" rx="3.3" ry="4.4" />
            <ellipse cx="64" cy="44" rx="3.3" ry="4.4" />
          </g>
        )}
        <path
          d="M50 49Q53 51 57 48Q56 53 52 52Z"
          fill="#3f6737"
          stroke="none"
        />
      </g>
    </g>
  );
}

export function Yeti({ asleep }: { asleep: boolean }) {
  return (
    <g
      fill="#fffefd"
      stroke="#d6d5d1"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 45C11 56 7 73 8 91Q15 97 25 91L31 64Z" />
      <path
        d={
          asleep
            ? "M73 45C85 48 92 65 92 88L80 91Q77 72 70 65Z"
            : "M73 43Q84 38 87 24L98 28C97 47 85 63 72 65Z"
        }
      />
      <path d="M29 69L28 94Q28 102 38 102H43Q50 102 50 94Q50 102 57 102H63Q72 102 72 94L72 69Z" />
      <path
        d="M28 96H49Q47 102 40 102Q30 102 28 96ZM51 96H71Q69 102 61 102Q53 102 51 96Z"
        fill="#dec2a8"
        stroke="none"
      />
      <path d="M41 91q9 1 17 0M50 92v7" fill="none" />
      <g fill="#f7e1b8" stroke="#d9c7a9">
        <path d="M8 89L11 86L14 89L17 86L20 89L23 86L27 90Q35 91 31 96L27 96Q29 102 19 102C9 102 8 97 8 89Z" />
        <path
          d={
            asleep
              ? "M80 87L84 90L87 87L90 90L93 87L95 91Q98 102 88 102Q78 102 79 95L75 95Q72 90 80 91Z"
              : "M85 24Q78 18 81 14Q83 12 86 15C91 7 100 13 98 26L97 31L93 28L89 29L87 25Z"
          }
        />
      </g>
      <path d="M18 30Q18 17 31 17H41L48 8Q51 4 54 8L62 17H68Q79 17 79 30L80 61Q81 74 66 75Q49 77 31 75Q16 74 17 62Z" />
      <g fill="#eeb6ac" stroke="none">
        <ellipse cx="27" cy="46" rx="3.2" ry="1.8" />
        <ellipse cx="72" cy="46" rx="3.2" ry="1.8" />
      </g>
      {asleep ? (
        <path
          d="M29 43q4 5 8 0M60 43q4 5 8 0"
          fill="none"
          stroke="#573e43"
          strokeWidth="1.8"
        />
      ) : (
        <g fill="#573e43" stroke="none">
          <ellipse cx="34" cy="43" rx="3" ry="3.4" />
          <ellipse cx="65" cy="43" rx="3" ry="3.4" />
        </g>
      )}
      <path
        d="M27 50l6 4l6-4l6 4l6-4l6 4l6-4l6 4l6-4"
        fill="none"
        stroke="#573e43"
        strokeWidth="2"
      />
    </g>
  );
}
