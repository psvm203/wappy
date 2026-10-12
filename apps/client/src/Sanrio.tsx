export function Pochacco({ asleep }: { asleep: boolean }) {
  return (
    <g
      fill="#fffefa"
      stroke="#292522"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M69 81Q86 77 81 69Q77 65 74 70" />
      <path d="M36 85L31 94Q27 100 37 100H44Q49 99 47 88M54 88L53 96Q54 101 63 100H70Q75 98 68 94L65 85" />
      <path d="M28 68Q15 71 19 80Q23 85 32 78M72 68Q84 71 81 80Q77 85 68 78" />
      <path
        d="M34 64L25 72L30 80L35 78L33 90Q50 95 69 89L67 78L72 80L76 72L65 64Z"
        fill="#479bd0"
      />
      <path
        d="M40 65L43 74L50 70L57 74L61 65M50 72v8"
        fill="none"
        strokeWidth="2"
      />
      <path
        d="M27 31C20 21 13 15 9 22C5 30 9 50 15 53Q23 54 27 39M73 31C80 21 87 15 91 22C95 30 91 50 85 53Q77 54 73 39"
        fill="#292522"
      />
      <path d="M22 43C19 28 31 16 42 17L40 12L49 16L53 10L57 17C70 17 81 28 79 43Q87 52 77 61Q67 68 51 68Q33 68 23 61Q13 52 22 43Z" />
      {asleep ? (
        <path d="M32 43q4 5 8 0M61 43q4 5 8 0" fill="none" />
      ) : (
        <g fill="#292522" stroke="none">
          <ellipse cx="36" cy="43" rx="2.7" ry="3.7" />
          <ellipse cx="65" cy="43" rx="2.7" ry="3.7" />
        </g>
      )}
      <ellipse
        cx="50.5"
        cy="51"
        rx="3.5"
        ry="2.7"
        fill="#292522"
        stroke="none"
      />
    </g>
  );
}

export function BadtzMaru({ asleep }: { asleep: boolean }) {
  return (
    <g
      fill="#29282c"
      stroke="#292522"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path
        d="M35 89Q27 88 24 97Q34 101 45 97L44 89M57 89L56 97Q68 101 78 97Q74 87 65 89"
        fill="#f7da50"
      />
      <path d="M33 62Q25 74 28 91Q50 97 72 91Q76 75 67 62Z" />
      <path d="M43 68Q35 77 34 90Q50 94 66 90Q65 76 57 68Z" fill="#fffefa" />
      <path d="M32 66Q16 73 20 82Q25 87 37 74M67 65Q82 68 83 76Q80 83 63 73" />
      <path d="M24 31Q17 20 20 9Q28 10 36 22L46 5Q50 0 53 22L70 8Q77 4 73 25L88 17Q91 29 79 38C86 54 74 69 51 70C28 70 13 54 21 38Z" />
      <path
        d="M26 39H44Q49 55 35 56Q22 55 26 39ZM56 39H75Q79 55 65 56Q52 55 56 39Z"
        fill="#fffefa"
        stroke="none"
      />
      {asleep ? (
        <path d="M28 45q6 6 12 0M59 45q6 6 12 0" fill="none" />
      ) : (
        <g fill="#29282c" stroke="none">
          <ellipse cx="39" cy="40" rx="3.1" ry="4.2" />
          <ellipse cx="67" cy="40" rx="3.1" ry="4.2" />
        </g>
      )}
      <path
        d="M41 61Q50 47 60 61Q50 57 41 61ZM41 64Q50 59 60 64"
        fill="#f7da50"
        strokeWidth="1.8"
      />
    </g>
  );
}

export function Hangyodon({ asleep }: { asleep: boolean }) {
  return (
    <g
      fill="#26b4bd"
      stroke="#292522"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M34 72Q27 80 29 90Q18 92 22 98Q31 103 46 98L49 94L54 98Q69 103 79 98Q83 92 72 90Q76 80 66 72Z" />
      <path d="M30 74Q22 69 17 75L12 77Q9 82 15 84Q11 90 18 90L23 87Q26 93 30 87M69 74Q77 69 83 75L88 77Q91 82 85 84Q89 90 82 90L77 87Q74 93 70 87" />
      <path
        d="M22 38Q10 34 10 49Q10 64 24 59M78 38Q90 34 90 49Q90 64 76 59"
        fill="#239fd0"
      />
      <path
        d="M11 44l9 2M11 52l9-1M80 46l9-2M80 51l9 1"
        fill="none"
        strokeWidth="2"
      />
      <path
        d="M36 24Q21 20 26 12Q29 7 35 10Q34 1 43 5Q50 8 55 19"
        fill="#239fd0"
      />
      <path d="M30 15l6 4M40 10l5 6" fill="none" strokeWidth="2.2" />
      <path d="M19 53C16 34 29 18 48 18C68 16 84 33 81 54L77 67Q51 79 24 67Z" />
      <ellipse cx="35" cy="43" rx="13" ry="16" fill="#fffefa" />
      <ellipse cx="64" cy="40" rx="13" ry="16" fill="#fffefa" />
      {asleep ? (
        <path d="M28 43q6 6 12 0M58 40q6 6 12 0" fill="none" />
      ) : (
        <g fill="#292522" stroke="none">
          <ellipse cx="39" cy="43" rx="3.6" ry="4" />
          <ellipse cx="60" cy="40" rx="3.6" ry="4" />
        </g>
      )}
      <path
        d="M23 62Q47 56 77 58Q85 60 79 66Q53 76 25 73Q17 71 23 62Z"
        fill="#f5b2ca"
      />
      <path
        d="M23 68Q50 61 79 62M37 79q4 4 8 0M56 79q4 4 8 0M46 87q4 4 8 0"
        fill="none"
        strokeWidth="2"
      />
    </g>
  );
}

export function Pekkle({ asleep }: { asleep: boolean }) {
  return (
    <g
      fill="#fffefa"
      stroke="#292522"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path
        d="M34 86L33 92Q22 91 23 97Q31 102 45 98L44 87M57 87L56 98Q70 102 79 97Q79 91 67 92L66 86"
        fill="#ffc832"
      />
      <path d="M33 77Q26 86 37 91Q50 96 65 90Q75 86 67 77Z" />
      <path d="M25 65Q14 65 13 76Q15 82 29 76M74 65Q86 61 88 70Q87 77 73 77" />
      <path
        d="M34 59L22 65L27 78L33 76L31 85Q50 91 70 84L68 75L75 77L79 64L66 59Z"
        fill="#078ac4"
      />
      <path
        d="M48 81V70H52Q60 70 55 76H48"
        fill="none"
        stroke="#fffefa"
        strokeWidth="3.5"
      />
      <path d="M23 44C18 29 28 16 40 16Q32 9 41 8L47 12Q45 3 53 6L56 11Q64 6 65 12L62 16C79 20 83 33 78 46Q86 56 73 61Q51 71 29 61Q16 56 23 44Z" />
      <path d="M34 26q4-4 8-3M59 23q4-2 8 2" fill="none" strokeWidth="2" />
      {asleep ? (
        <path d="M31 37q4 5 8 0M60 37q4 5 8 0" fill="none" />
      ) : (
        <g fill="#292522" stroke="none">
          <ellipse cx="35" cy="37" rx="2.5" ry="3.4" />
          <ellipse cx="64" cy="37" rx="2.5" ry="3.4" />
        </g>
      )}
      <path
        d="M28 49L41 44Q49 40 58 44L73 47Q79 53 66 56Q53 61 39 57L28 57Q21 54 28 49Z"
        fill="#ffc832"
      />
      <path d="M29 54Q49 57 70 51" fill="none" strokeWidth="1.8" />
    </g>
  );
}

export function Tuxedosam({ asleep }: { asleep: boolean }) {
  return (
    <g
      fill="#709fd0"
      stroke="#292522"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <g transform="translate(2 -.5) rotate(27 69 15)">
        <path
          d="M55 13C54 8 57 4 64 4C73 3 79 8 81 14Q68 11 55 13Z"
          fill="#fffefa"
        />
        <path
          d="M55 9C64 7 75 9 81 12Q83 14 82 17C72 13 63 12 55 14Q52 12 55 9Z"
          fill="#ee87ad"
          strokeWidth="1.8"
        />
        <path
          d="M53 13C64 11 77 13 84 17Q87 19 84 22C73 18 61 16 52 18Q48 17 50 14Q51 13 53 13Z"
          fill="#fffefa"
        />
        <path
          d="M81 13Q85 9 87 11L86 15Q90 19 87 20L81 18Z"
          fill="#ee87ad"
          strokeWidth="1.8"
        />
      </g>
      <path
        d="M64 93Q74 90 83 92C91 93 91 101 84 102Q81 102 80 99C80 104 72 106 70 101C67 105 60 103 60 99Z"
        fill="#ffe270"
      />
      <path d="M19 62C9 44 13 23 29 14C44 3 64 8 75 20C81 27 85 37 87 46Q89 35 95 38C100 43 94 60 93 74C93 90 81 99 62 99L35 99Q21 98 21 84Q10 88 8 81Q8 78 16 71Q21 65 19 62Z" />
      <path
        d="M29 73C31 59 43 51 57 51C74 48 89 61 91 78C93 91 79 99 61 98Q44 100 30 97C24 93 26 81 29 73Z"
        fill="#fffefa"
      />
      <g transform="rotate(-18 50 46)">
        {asleep ? (
          <path d="M32 44q3 3.5 6 0M62 44q3 3.5 6 0" fill="none" />
        ) : (
          <g fill="#292522" stroke="none">
            <ellipse cx="35" cy="46" rx="1.7" ry="3.5" />
            <ellipse cx="65" cy="46" rx="1.7" ry="3.5" />
          </g>
        )}
      </g>
      <path d="M69 47.8l.7 1M70.8 47.2l.7 1" fill="none" strokeWidth=".9" />
      <path
        d="M40 54.5Q43 48 47.5 46.6Q49 45.6 51 46L62.5 47.6Q66.5 48.3 64 51Q56 57 45.5 58.4Q37.5 60 40 54.5Z"
        fill="#ffe270"
      />
      <path
        d="M52 67C48 65 44 62 41 63C38 64 40 74 42 76C44 78 49 74 53 72Q55 71 57 72C62 74 67 77 69 75C71 72 71 65 69 63C67 61 62 65 58 67Q55 68 52 67Z"
        fill="#ee87ad"
        transform="rotate(-18 55 70)"
      />
      <path
        d="M22 85C20 77 26 73 29.5 79C31 74 36 76 39 81C43 88 44 96 39 100C33 105 23 101 18 95C13 89 16 85 22 85Z"
        fill="#ffe270"
      />
    </g>
  );
}

export function Keroppi({ asleep }: { asleep: boolean }) {
  return (
    <g
      fill="#b9d94b"
      stroke="#292522"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M31 84Q25 91 23 97Q29 102 43 98L45 87M56 87L57 98Q72 102 78 97Q75 90 68 84" />
      <path d="M30 67Q17 65 14 77Q19 83 30 81M70 67Q83 65 87 77Q82 83 71 81" />
      <path d="M32 64Q50 60 69 65L74 91Q51 97 27 91Z" fill="#fffefa" />
      <path
        d="M34 65L31 90M49 64v28M65 66l4 24"
        fill="none"
        stroke="#eb3444"
        strokeWidth="8"
      />
      <path d="M32 64Q50 60 69 65L74 91Q51 97 27 91Z" fill="none" />
      <path d="M22 37Q13 46 17 59Q23 72 49 72Q76 72 83 59Q88 47 77 36Z" />
      <ellipse cx="31" cy="31" rx="19" ry="21" fill="#fffefa" />
      <ellipse cx="69" cy="31" rx="19" ry="21" fill="#fffefa" />
      {asleep ? (
        <path d="M21 33q9 8 18 0M60 33q9 8 18 0" fill="none" />
      ) : (
        <g fill="#292522" stroke="none">
          <ellipse cx="38" cy="33" rx="5" ry="5.5" />
          <ellipse cx="62" cy="33" rx="5" ry="5.5" />
        </g>
      )}
      <g fill="#f2aec4" stroke="none">
        <circle cx="26" cy="56" r="6" />
        <circle cx="74" cy="56" r="6" />
      </g>
      <path d="M37 60L50 69L63 60" fill="none" />
      <path
        d="M50 78Q39 68 39 78Q39 87 50 80Q61 87 61 78Q61 68 50 78Z"
        fill="#292522"
        strokeWidth="1.8"
      />
    </g>
  );
}
