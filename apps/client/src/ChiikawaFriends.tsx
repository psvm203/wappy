export function Momonga({ asleep }: { asleep: boolean }) {
  return (
    <g
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
