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
      transform="translate(100 0) scale(-1 1)"
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

export function Momonga({ asleep }: { asleep: boolean }) {
  return (
    <g
      transform="translate(100 0) scale(-1 1)"
      fill="#fffefd"
      stroke="#242622"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path
        d="M45 87C47 98 75 94 87 77C98 61 97 37 90 24C82 10 65 10 54 18C42 26 39 42 43 57Z"
        fill="#ccebf5"
        stroke="none"
      />
      <path
        d="M48 25l2 3M54 18q-2 4-1 7M60 15q-2 3-1 6M71 12q-3 1-4 5M81 16q-4-1-7 3M88 23q-4 0-7 3M93 31q-4-1-7 1M96 41q-4-2-7-1M96 52q-3-3-6-3M94 62q-3-3-6-3M90 73q-1-4-4-6M84 81q0-3-3-5M77 87q0-3-2-5M69 91q1-3-1-5M60 93q2-2 1-5"
        fill="none"
        strokeWidth="1.9"
      />
      <path
        d="M16 46Q19 39 25 37C15 35 16 25 19 21C24 12 36 12 39 18C43 23 38 31 36 35Q47 31 56 38C61 35 58 25 66 24C78 22 80 41 68 45Q74 53 75 63Q76 72 69 78C73 89 64 96 50 95L47 99Q44 102 41 98Q37 102 34 98Q31 97 32 93Q26 88 25 82C17 80 17 72 18 69Q8 65 10 56Q10 50 16 46Z"
        stroke="none"
      />
      <path
        d="M25 25C19 27 21 35 27 35Q27 29 29 23Z M67 31C72 33 73 40 68 42L64 40Q67 36 67 31Z"
        fill="#ccebf5"
        stroke="none"
      />
      <path
        d="M16 46Q19 39 25 37C15 35 16 25 19 21C24 12 36 12 39 18C43 23 38 31 36 35Q47 31 56 38M54 36C61 35 58 25 66 24C78 22 80 41 68 45L72 52"
        fill="none"
      />
      <path
        d="M31 21Q27 22 27 32L24 34M23 30Q28 29 29 32M66 31Q67 36 63 40L67 41M64 38Q68 37 69 39"
        fill="none"
        strokeWidth="2"
      />
      <path
        d="M8 48q3-1 6 1M5 55q2-2 6-2M6 62q1-3 5-4M9 69q0-3 3-5M72 56q4-1 7 1M73 63q4 0 6 3M72 70q3 1 4 4M70 76q2 2 2 5"
        fill="none"
        strokeWidth="2.1"
      />
      <g fill="#f6bac8" stroke="none">
        <ellipse
          cx="23"
          cy="64"
          rx="6.5"
          ry="4.5"
          transform="rotate(12 23 64)"
        />
        <ellipse
          cx="61"
          cy="68"
          rx="6.5"
          ry="4.5"
          transform="rotate(12 61 68)"
        />
      </g>
      {asleep ? (
        <path d="M25 56q5 5 11 1M48 59q5 5 11 1" fill="none" />
      ) : (
        <g fill="#242622" stroke="none">
          <g transform="rotate(12 31 57)">
            <ellipse cx="31" cy="57" rx="6.5" ry="5.7" />
            <path
              d="M27 56C27 51 35 51 35 56Q35 58 31 56Q29 58 27 56ZM27 59Q31 62 35 59Q31 64 27 59Z"
              fill="#fffefd"
            />
          </g>
          <g transform="rotate(12 54 60)">
            <ellipse cx="54" cy="60" rx="6.5" ry="5.7" />
            <path
              d="M50 59C50 54 58 54 58 59Q58 61 54 59Q52 61 50 59ZM50 62Q54 65 58 62Q54 67 50 62Z"
              fill="#fffefd"
            />
          </g>
        </g>
      )}
      <path d="M37 52l.5.8M49 53l1-.6" fill="none" strokeWidth="1.6" />
      <ellipse cx="42" cy="60" rx="4.2" ry="4.8" fill="#ccebf5" stroke="none" />
      <path
        d="M37 65q0 4 4 2q2 5 4 0q4 3 5-1M40 71q1 3 3 1"
        fill="none"
        strokeWidth="2"
      />
      <path
        d="M20 61l-2 2M23 62l-2 3M26 63l-1 2M29 64l-1 1M57 65l-2 2M60 66l-2 3M63 67l-1 2M66 68l-1 1"
        fill="none"
        strokeWidth="1.6"
      />
      <path
        d="M16 70Q17 73 20 74M29 69C23 68 18 74 20 79Q21 83 26 83C28 90 32 94 38 94M68 83C70 91 62 97 50 95M33 93Q32 96 35 97Q35 100 38 98Q40 102 42 97M43 93Q40 95 42 98Q44 102 46 98Q48 100 49 96"
        fill="none"
      />
      <path
        d="M29 69q2 2 0 4q2 3-1 5l1 2M54 71C59 71 65 78 63 82M54 71q-2 2 1 4q-3 2 0 5l1 2"
        fill="none"
        strokeWidth="2.2"
      />
    </g>
  );
}

export function Kurimanju({ asleep }: { asleep: boolean }) {
  return (
    <g
      fill="#ffe7bb"
      stroke="#302923"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path
        d="M86 51L82 27L86 26L90 50ZM90 50L88 26L92 26L94 49Z"
        fill="#f5d889"
        strokeWidth="1.8"
      />
      <path d="M62 13Q67 10 69 13L68 18C81 22 89 35 88 50L89 62C99 79 88 94 75 96L77 99L71 97Q54 104 36 97Q24 92 22 84C10 80 7 67 8 54Q7 44 11 39Q5 36 12 33C16 21 32 13 46 12Q54 11 62 13Z" />
      <path
        d="M12 33C19 19 37 9 62 13C58 26 48 34 35 37Q21 40 12 36Z"
        fill="#9d7256"
      />
      <path d="M88 50Q94 45 94 49Q95 53 89 56" />
      <g fill="#f5b6bc" stroke="none">
        <ellipse
          cx="25"
          cy="54"
          rx="6.5"
          ry="4.5"
          transform="rotate(-22 25 54)"
        />
        <ellipse
          cx="64"
          cy="39"
          rx="6.5"
          ry="4.5"
          transform="rotate(-22 64 39)"
        />
      </g>
      {asleep ? (
        <path d="M28 46q4 3 8-2M49 38q4 3 8-2" fill="none" strokeWidth="2" />
      ) : (
        <g fill="#302923" stroke="none">
          <ellipse
            cx="32"
            cy="45"
            rx="3.2"
            ry="3.8"
            transform="rotate(18 32 45)"
          />
          <ellipse
            cx="53"
            cy="36"
            rx="3.2"
            ry="3.8"
            transform="rotate(18 53 36)"
          />
          <g fill="#fff9e8">
            <ellipse
              cx="32"
              cy="43.7"
              rx="1.5"
              ry=".9"
              transform="rotate(-20 32 43.7)"
            />
            <ellipse
              cx="53"
              cy="34.7"
              rx="1.5"
              ry=".9"
              transform="rotate(-20 53 34.7)"
            />
            <path
              d="M30.8 46.5l1.3-.3M51.8 37.5l1.3-.3"
              stroke="#fff9e8"
              strokeWidth=".8"
            />
          </g>
        </g>
      )}
      <path
        d="M21 53v3M25 51v4M29 50v3M60 39v3M64 37v4M68 36v3"
        fill="none"
        strokeWidth="1.5"
      />
      <path
        d="M40 46q2 2 1 5M41 49q4 0 4-3M47 44q-1 3 2 4"
        fill="none"
        strokeWidth="1.9"
      />
      <path
        d="M48 47Q54 48 60 50L60 53Q53 53 47 50Z"
        fill="#e0bc6f"
        strokeWidth="1.8"
      />
      <path d="M50 49l7 2" fill="none" strokeWidth="1" />
      <path
        d="M75 67Q76 60 79 63Q81 65 81 68M48 84Q48 77 45 77Q41 77 41 85M49 81Q57 81 60 78"
        fill="none"
        strokeWidth="2.1"
      />
      <g transform="rotate(-18 29 75)">
        <path
          d="M22 65Q29 61 37 65L38 83Q30 88 22 84Z"
          fill="#d4d3cf"
          strokeWidth="2"
        />
        <ellipse
          cx="29.5"
          cy="65"
          rx="7.5"
          ry="2.5"
          fill="#ebe8df"
          strokeWidth="1.7"
        />
        <ellipse
          cx="29"
          cy="64.5"
          rx="2.1"
          ry=".8"
          fill="#302923"
          stroke="none"
        />
        <path
          d="M26 70v2M30 69v2M34 70v2M26 75q4 2 8-1M25 80q5-2 10-1M26 83l8-2"
          fill="none"
          strokeWidth="1.4"
        />
      </g>
      <path d="M23 78Q19 76 19 81Q19 85 24 85Q30 82 26 80" strokeWidth="2" />
    </g>
  );
}

export function Furuhonya({ asleep }: { asleep: boolean }) {
  return (
    <g
      transform="translate(100 0) scale(-1 1)"
      fill="#fceae4"
      stroke="#292925"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path
        d="M24 30C14 29 10 20 15 11L21 13L23 7C32 10 37 18 33 24Z"
        fill="#efb3c0"
      />
      <path
        d="M65 26C57 22 57 13 62 7L66 5L70 9L75 7C85 15 82 24 77 29Z"
        fill="#efb3c0"
      />
      <path
        d="M50 25C27 25 13 40 13 59C13 72 18 80 26 84Q21 96 36 98Q54 103 73 96C88 92 90 80 84 71C91 54 86 39 74 31Q63 25 50 25Z"
        stroke="none"
      />
      <path
        d="M17 43C23 31 35 25 50 25Q69 24 81 40Q50 30 17 43Z"
        fill="#efb3c0"
        stroke="none"
      />
      <path
        d="M24 82C16 75 13 68 13 59C13 40 27 25 50 25Q63 25 74 31C86 39 91 54 84 71M85 77C90 89 81 97 69 97M36 98Q48 101 61 98"
        fill="none"
      />
      <path d="M38 26l-1-2M42 25l1-2" fill="none" strokeWidth="1.6" />
      <path
        d="M31 47l4 1M32 51h3M55 45l4-2M56 49l4-1"
        fill="none"
        strokeWidth="1.7"
      />
      {asleep ? (
        <path d="M29 59q5 5 10 0M53 55q5 5 10 0" fill="none" strokeWidth="2" />
      ) : (
        <g fill="#20231e" stroke="none">
          <ellipse cx="34" cy="59" rx="4.2" ry="4.5" />
          <ellipse cx="58" cy="55" rx="4.2" ry="4.5" />
          <g fill="#fffdf5">
            <ellipse
              cx="34"
              cy="57.6"
              rx="1.9"
              ry="1.2"
              transform="rotate(-10 34 57.6)"
            />
            <ellipse
              cx="58"
              cy="53.6"
              rx="1.9"
              ry="1.2"
              transform="rotate(-10 58 53.6)"
            />
            <path d="M32 61q2 1 4-.5q-1 3-4 .5M56 57q2 1 4-.5q-1 3-4 .5" />
          </g>
        </g>
      )}
      <path d="M43 65q0 3 4 1q4 2 4-1M47 63v3" fill="none" strokeWidth="1.9" />
      <g fill="#f7bac6" stroke="none">
        <ellipse
          cx="24"
          cy="66"
          rx="6.5"
          ry="4.5"
          transform="rotate(-15 24 66)"
        />
        <ellipse
          cx="70"
          cy="61"
          rx="6.5"
          ry="4.5"
          transform="rotate(-15 70 61)"
        />
      </g>
      <path
        d="M20 65l-1 3M24 64l-1 3M28 63l-1 3M66 60l-1 3M70 59l-1 3M74 58l-1 3"
        fill="none"
        strokeWidth="1.5"
      />
      <path
        d="M35 94Q28 89 28 94Q25 99 34 99M62 96Q66 92 69 96Q69 100 63 99"
        strokeWidth="2"
      />
      <path
        d="M30 73Q39 69 50 75Q60 68 69 68L74 89Q63 89 53 95Q42 91 34 94Z"
        fill="#e4e6a7"
        strokeWidth="2"
      />
      <path
        d="M31 74Q41 73 49 78L52 93Q41 90 35 92Z"
        fill="#f0edbd"
        stroke="none"
      />
      <path
        d="M50 75l3 20M33 76q7-2 14 1M54 77q7-5 13-5"
        fill="none"
        strokeWidth="1.4"
      />
      <path
        d="M37 80h8l1 7h-7M58 79l9-3M59 82l9-3M60 85l7-2"
        fill="none"
        stroke="#bcc583"
        strokeWidth="1.3"
      />
      <path
        d="M30 82Q26 80 27 84Q28 90 33 87Q37 87 35 83M73 78Q69 75 69 80Q69 85 74 83"
        strokeWidth="2"
      />
    </g>
  );
}

export function Rakko({ asleep }: { asleep: boolean }) {
  return (
    <g
      transform="translate(100 0) scale(-1 1)"
      fill="#fff3d8"
      stroke="#171713"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path
        d="M77 64Q86 68 94 68Q91 72 90 79C89 85 87 88 83 89Q79 90 77 94Q74 97 70 94L65 90Z"
        fill="#fffefd"
      />
      <path d="M80 73q2 2.5 5 3M86 78l.5.3" fill="none" strokeWidth="1.1" />
      <path
        d="M10 51C7 33 15 16 32 12C50 6 70 13 78 27Q85 39 83 52Q82 59 82 67C82 82 74 94 62 97Q41 101 29 93C19 87 16 77 16 68Q10 61 10 51Z"
        stroke="none"
      />
      <path
        d="M10 40.5l1.3.1M13.5 29.5l1.3.7M18.5 21.7l1.8 1M22.8 17.6l1.4 1.6M31 13l.6 1.5M41 10l-.4 1.8M51.8 10.4l-.6 1.5M62.5 13.5l-1.1 1.7M73.2 21l-1.1 1M82 42l1.3.4M82 47.3l.9.1M81 53l.6.3M20 79l1.5.1M21.6 83.8l1.2-.2M24.5 87l1-.6M27.5 90l1-.9M30.5 93l.9-1.2M35 95.5l.6-1.1M42 96.5l-.2 1.1M48.5 96.5l-.2 1.5M56 96.6l.4 1.2M62.8 95.2l1 .9M68 92.5l1.3.6M73 88.5l1 1M78 83h1.4M79.3 77.5h1.4M80 71l.6.1"
        fill="none"
        strokeWidth="1.1"
      />
      <g fill="#171713" stroke="none">
        <path d="M9 49Q11 48 12 50Q13 53 10 53.5Q6.5 54 8 51Z" />
        <path d="M78 31Q81 30 82 32Q82.5 35 80 36Q77 36 77 33Z" />
        <path d="M36 95.8Q38 96.8 40.5 96Q41 98 39.5 100Q36 102 35.5 98Z" />
        <path d="M65 95Q67 93.5 69.5 95.5L71 99Q70 101 67.5 100Q65.5 98.5 65 95Z" />
      </g>
      <g fill="#fffefd" strokeWidth="1.1">
        <path d="M7 56L9.5 54.5L16 63L13.5 65Z" />
        <path
          d="M6 57L10.5 54M8 60L12 57.5M10 62.5L14 60M12 65L17 62"
          fill="none"
        />
      </g>
      <path
        d="M34 47.7l1.6.4M47.7 45.8l.8-1M40.7 47.8l.2.2M42.4 47.5l.1.3"
        fill="none"
        strokeWidth="1"
      />
      {asleep ? (
        <path
          d="M27.4 51.2q4 3 8.1-1.5M49.1 47.6q4 3 8.1-1.4"
          fill="none"
          strokeWidth="1.3"
        />
      ) : (
        <g fill="#171713" stroke="none">
          <g transform="rotate(-13 31.5 52)">
            <ellipse cx="31.5" cy="52" rx="4.6" ry="3.1" />
            <path
              d="M29 50.8Q31.8 49.4 34.2 50.8Q33 52 29 51.5ZM28.6 53Q31.6 54.1 34.6 52.6Q33 55 29.5 54Z"
              fill="#fffefd"
            />
          </g>
          <g transform="rotate(-10 53.1 48.2)">
            <ellipse cx="53.1" cy="48.2" rx="4.7" ry="3.2" />
            <path
              d="M50.5 47Q53.1 45.5 55.8 46.8Q55.4 48.3 51 47.9ZM50 49.2Q53.1 50.1 56.4 48.6Q54.3 51.3 51 50.1Z"
              fill="#fffefd"
            />
          </g>
        </g>
      )}
      <g fill="#f8b9c4" stroke="none">
        <ellipse
          cx="24.5"
          cy="58.7"
          rx="5.8"
          ry="3.8"
          transform="rotate(-14 24.5 58.7)"
        />
        <ellipse
          cx="64.2"
          cy="51.8"
          rx="5.8"
          ry="3.8"
          transform="rotate(-14 64.2 51.8)"
        />
      </g>
      <path
        d="M21.6 57.8l-.8 2M24 57.5l-.9 2.2M26.4 57.2l-.9 2M28.6 57l-.8 1.9M60.7 51.2l-1 2M63.3 50.7l-1 2.2M65.9 50.4l-1 2.1M68.2 50.2l-.8 1.8"
        fill="none"
        strokeWidth=".9"
      />
      <path
        d="M41.2 55.9Q43 55 45.3 55.5Q45.8 56.1 43.8 57.5L43.2 58.5L42.5 57.2Q40.8 56.7 41.2 55.9Z"
        fill="#171713"
        stroke="none"
      />
      <path
        d="M39.2 58.5Q39.7 60.7 43.2 58.5Q46.2 60.3 47 57.9M44 61.8q.7.4 1.4-.2"
        fill="none"
        strokeWidth="1.2"
      />
      <path
        d="M16 66Q36 70 59 64.5Q75 61 83 55Q85 57.3 84.2 60.3Q87 62.2 84.5 65.8C79 73.7 62 77.8 44 78.2Q23 78.9 17.4 74Q14 72.2 16.3 70.7Q13.7 69 16 66Z"
        fill="#fffefd"
        strokeWidth="1.4"
      />
      <path
        d="M15.8 67.6q.2 2.1 2.1 2.9M20.1 71l.8.4M83.9 58.8q-.6 2.7-2.2 3.7M79.5 61.3l.2.2M78.6 58.4l.2.1M76.9 59.5l.2.1M80.1 56.9l.2.1"
        fill="none"
        strokeWidth="1"
      />
      <path
        d="M42.7 75Q45.1 73.6 47.5 74.5Q50 73.7 52 74.4Q55.1 73.9 56.5 75.8Q57.2 77.6 54.8 79Q52 80.6 49.3 79.6Q47.2 81 45.2 79.7Q42.7 81.2 40.7 79.2Q39.4 77.3 42.7 75Z"
        fill="#171713"
        stroke="none"
      />
    </g>
  );
}

export function Shisa({ asleep }: { asleep: boolean }) {
  return (
    <g
      fill="#fff4d0"
      stroke="#302c2a"
      strokeWidth="2.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path
        d="M73 83Q83 82 85 89Q85 96 77 94Q73 92 77 89Q80 88 80 91"
        fill="#f7b286"
        strokeWidth="2"
      />
      <g fill="#f7b286">
        <path d="M25 25Q20 20 15 24L11 23Q8 30 15 36Q6 35 10 44Q4 49 11 54Q6 61 13 65Q10 72 23 73L29 61L30 32Z" />
        <path d="M75 25Q80 20 85 24L89 23Q92 30 85 36Q94 35 90 44Q96 49 89 54Q94 61 87 65Q90 72 77 73L71 61L70 32Z" />
      </g>
      <path
        d="M14 28Q19 33 16 37M11 45Q15 48 18 46M13 56Q18 60 15 65M86 28Q81 33 84 37M89 45Q85 48 82 46M87 56Q82 60 85 65"
        fill="none"
        strokeWidth="1.7"
      />
      <path d="M28 22Q22 18 25 13Q32 12 38 18Q50 14 62 18Q68 12 75 13Q78 19 72 23C86 30 88 50 83 65L87 69Q89 74 82 75C81 85 77 91 66 94L65 98Q61 101 58 98L58 95Q50 97 43 95L42 98Q38 101 35 98L35 94Q25 92 22 81L20 75Q14 78 14 72L18 67C12 47 15 32 28 22Z" />
      <path d="M29 17L33 20M71 17L68 20" fill="none" strokeWidth="1.7" />
      <g fill="#f7b286" strokeWidth="1.9">
        <path d="M37 38C32 37 28 34 30 31Q32 28 35 31Q35 27 38 28Q44 32 37 38Z" />
        <path d="M63 38C68 37 72 34 70 31Q68 28 65 31Q65 27 62 28Q56 32 63 38Z" />
      </g>
      {asleep ? (
        <path
          d="M28 44Q33 49 38 44M62 44Q67 49 72 44"
          fill="none"
          strokeWidth="2"
        />
      ) : (
        <g fill="#302c2a" strokeWidth="1.6">
          <ellipse cx="33" cy="44" rx="3.8" ry="4.3" />
          <ellipse cx="67" cy="44" rx="3.8" ry="4.3" />
          <g fill="#fffef3" stroke="none">
            <ellipse cx="32" cy="42.5" rx="1.8" ry="1.5" />
            <ellipse cx="66" cy="42.5" rx="1.8" ry="1.5" />
            <circle cx="34" cy="46" r=".9" />
            <circle cx="68" cy="46" r=".9" />
          </g>
        </g>
      )}
      <g fill="#f3a8b1" stroke="none">
        <ellipse cx="26" cy="52" rx="5.5" ry="3.5" />
        <ellipse cx="74" cy="52" rx="5.5" ry="3.5" />
      </g>
      <path
        d="M23 51L22 53M26 51L25 53M29 51L28 53M71 51L70 53M74 51L73 53M77 51L76 53"
        fill="none"
        strokeWidth="1.1"
      />
      <path d="M49 49H51" fill="none" strokeWidth="1.3" />
      <path
        d="M46 55Q50 58 54 55L53 61Q50 66 47 61Z"
        fill="#d88c7a"
        strokeWidth="1.7"
      />
      <path
        d="M43 53Q45 58 50 54Q55 58 57 53M49 67H51"
        fill="none"
        strokeWidth="1.8"
      />
    </g>
  );
}
