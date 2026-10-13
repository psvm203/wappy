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
      transform="translate(-10 -20) scale(1.2)"
      fill="#f9edc6"
      stroke="#14120f"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path
        d="M39.1 31.7C36.4 27.3 34.1 19.8 32.3 15.5C30.1 10.2 29.8 7.8 32.9 7.3C35.8 6.5 38.7 10 40.1 12.8C39.5 8.9 39.2 5.3 41.6 5.2C45.1 3.7 49.4 10.8 51.4 15.4C53.4 20.3 54.1 26.4 53.5 29.6L56 30C67 30.1 75.6 35.9 79.1 45.7C82.7 55.2 80.9 65.3 76 69.6L77 72.2C80.4 74.2 79.1 78.6 76.7 80Q74.9 81.2 73.5 80.1C71.8 87.4 67.4 92.2 61.1 93Q64.1 96.4 61.1 98Q58.9 99.1 56.7 96.9Q52.4 100.9 50.9 97L50.8 94.3C43.4 94.1 37.3 90.6 34.4 85.3L31.7 83.1C27.7 84.1 25.3 81.7 25.7 77.8Q25.9 75.2 28.3 72.7C19.6 70.5 16.8 60.8 17.9 52.8C18.5 45.8 23.7 37.5 29.5 34.8Q34 32.4 39.1 31.7Z"
        stroke="none"
      />
      <g fill="#f3b9c4" stroke="none">
        <path d="M35.2 11.4C34.2 14.7 38.6 25.6 41 28.1Q43.3 30.2 44.5 28.4C44.2 23.8 38.8 13.3 35.2 11.4ZM43.8 8.6C42.5 11.4 46.2 20.8 47.7 25.5Q48.7 28.5 52 28.3C51.8 22.8 49 13.3 43.8 8.6Z" />
        <ellipse
          cx="31.8"
          cy="60"
          rx="6.5"
          ry="4.9"
          transform="rotate(-10 31.8 60)"
        />
        <ellipse
          cx="68.9"
          cy="56.1"
          rx="6.2"
          ry="4.9"
          transform="rotate(-10 68.9 56.1)"
        />
      </g>
      <path
        d="M46.6 30.1C46.5 23.4 39.9 8.7 34.2 7.4C27.5 5.2 31.4 15.1 33.1 19.6L39.1 31.7C30.4 32.8 24.2 36.6 20.1 45.5C14.3 55 17.9 69.8 28.3 72.7M40.1 12.8C39.5 8.9 39.2 5.3 41.6 5.2C45.1 3.7 49.4 10.8 51.4 15.4C53.4 20.3 54.1 26.4 53.5 29.3M56 30C67 30.1 75.6 35.9 79.1 45.7C82.7 55.2 80.9 65.3 76 69.6M28.3 72.7C24.8 75.6 24.8 80.4 28.1 82.7C32.3 85 35.9 81.3 32.1 79.4Q31.1 78.6 30.5 79M77 72.2C80.4 74.2 79.1 78.6 76.7 80Q74.9 81.2 73.5 80.1M73.5 76.5C73.9 84.3 67.4 92.2 61.1 93M34.4 85.3C37.3 90.6 43.4 94.1 50.8 94.3L55.1 93.9M50.8 94.3Q50.5 99.7 54 98.5L56.7 96.9M55.1 93.9C56.7 96 57.7 98.8 60.5 98.2C64 97.5 62.1 93 59.9 92.2"
        fill="none"
      />
      <path
        d="M29.2 49.1C29.5 44.2 34.3 37.2 38 38.2M53.7 36.8C59.5 34.8 67.4 39.8 68.7 47.7"
        fill="none"
        strokeWidth="1.7"
      />
      {asleep ? (
        <path
          d="M37.2 52.5q3.4 3.6 6.8-.6M55.7 50.7q3.4 3.6 6.8-.6"
          fill="none"
          strokeWidth="1.6"
        />
      ) : (
        <g fill="#14120f" stroke="none">
          <path d="M37 52.2C37.5 49.4 41.6 48.6 43.5 50.9C45.2 53.8 42.9 57 40 56.4C37.8 56.3 36.3 54.4 37 52.2ZM55.7 50.2C56.4 47.7 60 47.1 62 49.4C64 52.1 62 55.1 59.2 54.8C56.7 54.8 55.1 52.6 55.7 50.2Z" />
          <g fill="#fffef8">
            <ellipse
              cx="40"
              cy="51.8"
              rx="1.2"
              ry=".7"
              transform="rotate(-35 40 51.8)"
            />
            <ellipse cx="58.8" cy="50" rx="1.2" ry=".75" />
            <path d="M40.2 54.3q1.1.1 1.9-.8q.6 1.3-1.2 1.7q-1.1.2-.7-.9ZM58.8 52.4q1.3.3 2.3-.3q.2 1.5-1.5 1.3q-1-.1-.8-1Z" />
          </g>
        </g>
      )}
      <path
        d="M51.6 57.9v1.6M47.3 59.5q2.1 2.8 4.5-.1q3.9 2.8 4.1-1M51.9 60.5q2.5 2.9.8 3.2l-1.4-.3"
        fill="none"
        strokeWidth="1.6"
      />
      <path
        d="M29.3 58.6l-.2 2.6M32.5 58.3l-.2 1.9M35.4 58.3v1.7M65.5 55.2l-.3 2M68.7 54.8l-.2 1.8M71.7 54.5v1.4"
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
      fill="#ffe4b8"
      stroke="#33251f"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M87.5 52.7C93 62.1 90.4 74.7 87.4 82.5Q83.7 91 74.8 92.7L75.8 95.6Q73.8 96.2 71.2 94.7C63.9 97.2 57.8 99.5 52 98.8C41.3 98.2 30.9 93.2 26.1 83.4Q21.8 83.3 23 77C12.4 71.7 9 62.4 8.5 53.8Q7.7 47.8 9.4 42.8C5.9 41.7 7.2 39.4 10.8 38.4L11.1 37.3C12.6 29.5 20.4 21.1 29.7 15.9C37.5 11.5 47.4 10.3 55.2 11.5Q57.5 13 60.2 11.8Q66 10 64.3 16.8C77.6 20.3 84.7 35.6 84 50.1" />
      <path
        d="M12 34C15.5 26.4 22.2 19.9 29.7 15.9C37.5 11.5 47.4 10.3 55.2 11.5C54.1 19.3 47.7 26.1 40.7 30.6C32.1 36.2 20.8 38 12 34Z"
        fill="#986b50"
      />
      <path d="M84 50.1Q86 47.7 87.4 46.3Q89.8 42.8 91.1 45.9Q92.3 49.4 87.5 52.7" />
      <g fill="#ffb5bd" stroke="none">
        <ellipse
          cx="28"
          cy="52.4"
          rx="6.5"
          ry="4.5"
          transform="rotate(-24 28 52.4)"
        />
        <ellipse
          cx="63"
          cy="35.5"
          rx="6.5"
          ry="4.8"
          transform="rotate(-24 63 35.5)"
        />
      </g>
      {asleep ? (
        <path
          d="M30.8 44.1q3.4 3.5 6.1-1.5M50.1 34q3.4 3.5 6.1-1.5"
          fill="none"
        />
      ) : (
        <g fill="#33251f" stroke="none">
          <ellipse
            cx="33.8"
            cy="44.3"
            rx="2.9"
            ry="3.3"
            transform="rotate(24 33.8 44.3)"
          />
          <ellipse
            cx="53.2"
            cy="34.1"
            rx="3"
            ry="3.4"
            transform="rotate(24 53.2 34.1)"
          />
          <g fill="#fffdf3">
            <ellipse
              cx="34.1"
              cy="43.1"
              rx="1.2"
              ry=".8"
              transform="rotate(-30 34.1 43.1)"
            />
            <ellipse
              cx="53.5"
              cy="32.9"
              rx="1.3"
              ry=".9"
              transform="rotate(-30 53.5 32.9)"
            />
            <path d="M32.2 45.2q1.4.7 2.6-.6q-.9 1.9-2.6.6M51.5 35.1q1.5.7 2.8-.6q-1 2-2.8.6" />
          </g>
        </g>
      )}
      <path
        d="M24.4 52.3l-.2 3.1M27 51.5v3M29.6 50.7l.1 2.8M32 50.3v2.3M59.5 35.8l-.1 2.6M62.1 34.3l.1 2.8M64.7 32.8l.1 2.8M67.1 32.5v2.6"
        fill="none"
        strokeWidth="1.3"
      />
      <path
        d="M41.7 46.3q1.8 1.5.2 4.1M42.9 48.1q3.1.1 3.2-2.3M45.9 44.3q-.6 2.2 1.5 3M49.1 44.8q-1.2 1.3-.3 2.4"
        fill="none"
        strokeWidth="1.5"
      />
      <path
        d="M48.1 47Q54 46.9 60.2 49.4L60.5 51.9Q54.2 51.5 47.5 48.9Z"
        fill="#dfbd70"
        strokeWidth="1.5"
      />
      <path d="M50.2 48.7l7.8 1.7" fill="none" strokeWidth=".8" />
      <path
        d="M73 68.5Q72.8 63.1 76.1 62.5Q78.6 62 79.6 67M47.6 81.8Q48.4 74 51.6 74.3Q54.6 74.7 54.4 79.3M54.5 77.8Q61.5 77.1 65.1 74"
        fill="none"
        strokeWidth="1.6"
      />
      <g fill="#fffdf3" stroke="none">
        <path d="M33 60Q30.6 58.7 33.6 57.1Q33.3 54.5 35.9 54.4Q38 54.5 38 57Q40.7 56.6 41 59.1Z" />
        <circle cx="40.8" cy="54.3" r=".9" />
      </g>
      <g transform="rotate(-20 37 72)">
        <path
          d="M32.5 61.5Q27.7 57.9 30.1 57.5Q34.2 57.4 36.2 61"
          fill="#e8e7e1"
          strokeWidth="1.4"
        />
        <path
          d="M29.7 63Q29.5 60.3 37 60.3Q44.5 60.3 44.3 63L44.8 78.8Q44.2 81.7 37.2 81.7Q30.5 81.7 29.4 79Z"
          fill="#d2d3ce"
          strokeWidth="1.5"
        />
        <path
          d="M30.2 63.6Q36.8 60.8 43.8 63.6M30.6 78.5Q36.9 81.1 43.5 78.5"
          fill="none"
          strokeWidth="1.1"
        />
        <path
          d="M33.3 66.5v1.8M36.6 65.5v1.8M40 66.1v1.6M33 70q2 2.1 4 .5M32.8 72.6l3.1.5M37.6 71.2l3.1-.8M33.2 77.1q3.8-2.7 8.1-.9M35 78.7q2.9-1.5 6.4-1.4"
          fill="none"
          strokeWidth="1.1"
        />
      </g>
      <path
        d="M26.1 79Q28.3 76.1 29.1 76Q31.5 75 33.3 77.1Q34.4 80.5 31.8 82.9Q29.8 84.8 26.1 83.4"
        strokeWidth="1.6"
      />
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
      fill="#fff2cb"
      stroke="#302c2a"
      strokeWidth="2.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <g fill="#627c75" strokeWidth="1.8">
        <path d="M80 17L82 10Q85 7 86 11L85 16M85 17L88 10Q92 8 91 12L89 18" />
        <path d="M77 20Q80 13 87 17C97 22 95 36 89 43L87 50L80 47L82 38Q74 28 77 20Z" />
        <path d="M83 54L88 56L81 73Q78 76 77 72Z" fill="#302c2a" />
        <path d="M85 43L94 46L90 60L82 57Z" fill="#fffef4" />
        <path
          d="M84 47L92 50M83 51L91 54M83 55L89 57"
          fill="none"
          strokeWidth="1.4"
        />
      </g>
      <path
        d="M24 66Q13 77 5 73L8 85Q13 84 18 88Q23 93 31 94L25 86Q17 80 28 74Z"
        fill="#fffef4"
        strokeWidth="1.8"
      />
      <path
        d="M13 80L17 78M17 85L20 82M25 91L27 89"
        fill="none"
        strokeWidth="1.3"
      />
      <path
        d="M52 12Q59 12 65 15L67 14L70 18Q76 19 79 24L82 24L83 29Q87 34 87 40L90 42L88 47Q90 53 87 59L89 61L87 65Q90 73 87 79L89 81L86 84Q85 90 80 93L80 95L74 95Q68 99 62 97L59 99L55 97Q47 99 42 97L39 99L36 96Q28 96 24 91L21 92L21 87Q16 83 17 77L14 74L16 70Q13 64 16 59L14 56L16 51Q13 45 17 40L15 37L19 33Q19 26 24 23L24 20L30 19Q34 14 41 14L43 11L47 13Z"
        stroke="none"
      />
      <path
        d="M43 13L44 16M53 13L53 16M64 16L63 19M73 21L71 23M81 29L78 30M86 43L83 43M87 54L85 53M87 62L85 63M88 80L86 81M83 89L81 88M75 95L74 92M65 97L64 94M44 97L44 94M34 95L35 92M25 91L27 89M19 83L22 82M16 73L18 73M16 61L18 60M16 51L18 50M18 39L20 39M22 28L24 29M31 20L33 22"
        fill="none"
        strokeWidth="1.5"
      />
      <g fill="#302c2a" stroke="none">
        <path d="M15 34Q10 34 11 38Q13 40 16 38Z" />
        <path d="M85 33Q90 32 91 36Q90 39 86 38Z" />
        <path d="M45 94Q43 100 47 100Q51 100 50 95Z" />
        <path d="M57 95Q55 100 59 100Q63 100 62 94Z" />
      </g>
      <path
        d="M37 28L36 35L40 38L34 38L28 43L30 36L27 33L33 33Z"
        fill="#fff9e6"
        strokeWidth="1.9"
      />
      <path d="M33 41L40 42M60 41L63 40" fill="none" strokeWidth="1.7" />
      {asleep ? (
        <path
          d="M30 47Q35 51 40 47M59 47Q64 51 69 47"
          fill="none"
          strokeWidth="2"
        />
      ) : (
        <g strokeWidth="1.9">
          <ellipse cx="35" cy="47" rx="4.5" ry="3" fill="#fffef3" />
          <ellipse cx="64" cy="47" rx="4.5" ry="3" fill="#fffef3" />
          <path d="M32 46H38M61 46H67" fill="none" strokeWidth="1.6" />
          <path d="M34 48H36M63 48H65" fill="none" strokeWidth="1.8" />
        </g>
      )}
      <g fill="#f3a8b1" stroke="none">
        <ellipse cx="28" cy="54" rx="5.5" ry="3.8" />
        <ellipse cx="73" cy="54" rx="5.5" ry="3.8" />
      </g>
      <path
        d="M25 53L24 55M28 53L27 55M31 53L30 55M70 53L69 55M73 53L72 55M76 53L75 55"
        fill="none"
        strokeWidth="1.1"
      />
      <path d="M49 48H51M49 51H51" fill="none" strokeWidth="1.1" />
      <path d="M47 54Q50 53 53 54L50 57Z" fill="#302c2a" strokeWidth="1.2" />
      <path
        d="M44 58Q47 62 50 58Q54 61 56 57M49 63H52"
        fill="none"
        strokeWidth="1.8"
      />
      <path
        d="M18 62Q49 76 86 61L87 68Q83 79 52 79Q26 79 18 72Q15 68 18 62Z"
        fill="#fffef4"
        strokeWidth="2"
      />
      <path
        d="M20 66L22 67M26 69Q40 74 58 73M79 68L83 66M20 71L23 72"
        fill="none"
        strokeWidth="1.2"
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
