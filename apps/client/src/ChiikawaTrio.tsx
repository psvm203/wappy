export function Chiikawa({ asleep }: { asleep: boolean }) {
  return (
    <g
      fill="#fffefa"
      stroke="#302c2a"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M25 80Q16 84 21 88Q25 91 29 86" />
      <path d="M25 30C20 23 24 16 30 17Q36 19 36 25C47 22 59 23 68 27C68 19 74 17 78 22Q82 27 78 33C90 42 94 58 86 70Q82 77 76 80Q83 83 79 87Q76 89 72 84C68 92 61 95 55 95L54 98Q50 102 47 96Q44 102 40 97L39 94C30 91 25 86 23 79Q18 84 15 80Q13 78 19 72C10 65 8 53 13 42Q17 35 25 30Z" />
      <path d="M47 96v-5" fill="none" />
      <g fill="#f5bbc8" stroke="none">
        <ellipse cx="27" cy="58" rx="7.5" ry="5.2" />
        <ellipse cx="74" cy="61" rx="7.5" ry="5.2" />
      </g>
      <path d="M34 40q3-2 5-2m24 1 5 2" fill="none" strokeWidth="2" />
      {asleep ? (
        <path d="M32 51q5 5 10 0m17 2q5 5 10 0" fill="none" />
      ) : (
        <g fill="#302c2a" stroke="none">
          <ellipse cx="37" cy="51" rx="4.6" ry="5.3" />
          <ellipse cx="64" cy="53" rx="4.6" ry="5.3" />
          <g fill="#fffefa">
            <ellipse
              cx="37"
              cy="49"
              rx="1.8"
              ry="1.2"
              transform="rotate(-35 37 49)"
            />
            <path d="M33.8 52.4q3 2.9 6.2-.7q-1.8 5-6.2.7M60.8 54.4q3 2.9 6.2-.7q-1.8 5-6.2.7" />
            <ellipse
              cx="64"
              cy="51"
              rx="1.8"
              ry="1.2"
              transform="rotate(-35 64 51)"
            />
          </g>
        </g>
      )}
      {!asleep && (
        <path d="M46 64q-1 10 5 8q4-1 3-7" fill="#fffefa" strokeWidth="2" />
      )}
      <path d="M44 62q3 5 7 0q2 4 5 2m-8 12h3" fill="none" strokeWidth="2" />
      <path
        d="M23 55l-2 5m6-5-2 5m6-4-2 4m41-2-2 5m6-5-2 5m6-4-2 4"
        fill="none"
        strokeWidth="1.8"
      />
    </g>
  );
}

export function Hachiware({ asleep }: { asleep: boolean }) {
  return (
    <g
      fill="#fffefa"
      stroke="#302c2a"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M45 91L44 97Q44 101 48 100Q54 98 55 92" fill="#94bdcf" />
      <path d="M19 33L26 15Q28 10 32 14L42 24Q50 21 59 25L73 19Q78 16 79 22L82 38C91 47 93 61 84 71Q89 70 89 74Q88 78 81 79L79 85Q86 87 83 91Q80 94 74 90C60 95 40 94 26 87Q19 90 16 86Q14 83 22 81L21 73Q14 74 12 69Q11 66 18 67C9 58 9 43 19 33Z" />
      <path
        d="M19 33L26 15Q28 10 32 14L42 24Q50 21 59 25L73 19Q78 16 79 22L82 38Q62 40 50 31Q40 40 19 33Z"
        fill="#94bdcf"
      />
      <g fill="#f5bbc8" stroke="none">
        <ellipse cx="26" cy="57" rx="7.5" ry="5.2" />
        <ellipse cx="74" cy="60" rx="7.5" ry="5.2" />
      </g>
      <path d="M35 43h2m26 1 2 1" fill="none" strokeWidth="1.8" />
      {asleep ? (
        <path d="M32 51q5 5 10 0m17 2q5 5 10 0" fill="none" />
      ) : (
        <g fill="#302c2a" stroke="none">
          <ellipse cx="37" cy="51" rx="4.5" ry="5" />
          <ellipse cx="64" cy="53" rx="4.5" ry="5" />
          <g fill="#fffefa">
            <ellipse cx="37" cy="49.2" rx="1.8" ry="1.2" />
            <path d="M34 52.5q3 2 6-.5q-2 4-6 .5M61 54.5q3 2 6-.5q-2 4-6 .5" />
            <ellipse cx="64" cy="51.2" rx="1.8" ry="1.2" />
          </g>
        </g>
      )}
      {!asleep && (
        <path d="M46 64q0 10 5 8q4-1 3-7" fill="#efb2bc" strokeWidth="2" />
      )}
      <path d="M44 62q3 5 7 0q2 4 5 2m-7 11h2" fill="none" strokeWidth="2" />
      <path
        d="M22 55l-2 4m6-4-2 4m6-3-2 4m41-2-2 4m6-4-2 4m6-3-2 4"
        fill="none"
        strokeWidth="1.8"
      />
    </g>
  );
}

export function Usagi({ asleep }: { asleep: boolean }) {
  return (
    <g
      fill="#fff0bf"
      stroke="#302c2a"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M37 36C33 23 37 7 42 5Q48 3 48 10L45 33L49 33C50 21 55 5 60 6Q65 7 63 16L58 35C76 38 88 49 87 63Q87 73 80 79Q87 79 85 84Q83 89 77 85C73 91 64 95 56 95Q55 101 50 99Q47 98 49 95C39 96 32 92 29 91Q23 96 20 92Q18 89 25 87C21 81 18 75 18 71Q7 66 8 61Q9 57 20 65C11 51 20 38 37 36Z" />
      <path
        d="M40 31C37 22 40 11 43 9Q45 7 44 14L42 31ZM52 32L57 12Q59 8 60 11L55 33Z"
        fill="#f2b8c1"
        stroke="none"
      />
      <path
        d="M39 42Q29 42 26 51M59 43Q71 42 76 55"
        fill="none"
        strokeWidth="2.2"
      />
      <g fill="#f5bbc8" stroke="none">
        <ellipse cx="27" cy="63" rx="7" ry="4.8" />
        <ellipse cx="73" cy="66" rx="7" ry="4.8" />
      </g>
      {asleep ? (
        <path d="M32 58q5 5 10 0m17 2q5 5 10 0" fill="none" />
      ) : (
        <g fill="#302c2a" stroke="none">
          <ellipse cx="37" cy="57" rx="4.2" ry="4.6" />
          <ellipse cx="64" cy="59" rx="4.2" ry="4.6" />
          <g fill="#fffefa">
            <ellipse cx="37" cy="55.5" rx="1.6" ry="1.1" />
            <path d="M34.5 58.3q2.5 1.8 5-.4q-1.6 3.3-5 .4M61.5 60.3q2.5 1.8 5-.4q-1.6 3.3-5 .4" />
            <ellipse cx="64" cy="57.5" rx="1.6" ry="1.1" />
          </g>
        </g>
      )}
      <ellipse cx="51" cy="65" rx="1.5" ry="1" fill="#302c2a" stroke="none" />
      {!asleep && (
        <path d="M47 69q-1 12 5 10q4-1 3-9" fill="#efb2bc" strokeWidth="2" />
      )}
      <path d="M44 67q3 5 7 0q2 5 6 2m-8 14h3" fill="none" strokeWidth="2" />
      <path
        d="M24 61l-1.5 3m5-2.5-1.5 3m5-2-1.5 3m40-.5-1.5 3m5-2.5-1.5 3m5-2-1.5 3"
        fill="none"
        strokeWidth="1.8"
      />
    </g>
  );
}
