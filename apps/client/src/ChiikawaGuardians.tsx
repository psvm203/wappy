export function Rakko({ asleep }: { asleep: boolean }) {
  return (
    <g
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
