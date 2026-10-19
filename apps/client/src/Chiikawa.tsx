import sasumata from "./assets/chiikawa-sasumata.png";
import blueSasumata from "./assets/hachiware-sasumata.png";

function Sasumata({ blue = false }: { blue?: boolean }) {
  return (
    <g className="hero-attack-pose" visibility="hidden">
      <g className="sasumata">
        <path d="M48 81q5-10 13-5m7 2q8-12 13-8" fill="none" />
        <image
          href={blue ? blueSasumata : sasumata}
          width="420"
          height="420"
          transform="translate(55 80) rotate(116) scale(.24) translate(-350 -365)"
        />
        <path d="M51 77q3-5 7-2l4 5q1 5-4 6-5 1-7-4Zm22-7q3-4 7-1l3 4q1 5-3 6-5 1-7-4Z" />
      </g>
    </g>
  );
}

export function Chiikawa({ asleep }: { asleep: boolean }) {
  if (asleep)
    return (
      <g
        className="chiikawa-sleep"
        transform="translate(100 3) scale(-.5 .5)"
        fill="#fffefa"
        stroke="#302c2a"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <g className="animate-sleeping-marks" aria-hidden="true">
          <path
            d="M46 19C34 17 25 24 25 36C25 48 38 57 50 52Q60 49 61 38C52 45 41 41 40 34C37 28 41 22 46 19Z"
            stroke="#edb745"
          />
          <g stroke="none">
            <path d="m20 55 4 5-4 6-4-5Z" fill="#f7cc62" />
            <circle cx="18" cy="70" r="2.4" />
            <circle cx="79" cy="28" r="3.2" />
            <circle cx="71" cy="29" r="1.8" fill="#f7cc62" />
            <circle cx="97" cy="27" r="1.8" fill="#f7cc62" />
          </g>
        </g>
        <path d="M153 75Q158 68 164 74Q171 70 176 77Q184 74 186 82Q195 82 191 90Q197 96 191 101Q194 109 185 111Q184 120 175 118Q169 125 161 119L147 103Z" />
        <path d="M173 89q5-1 6 3m-9 6q5 0 5 5m-11 6 4 3" fill="none" />
        <path
          d="M69 88C69 71 79 56 95 50C93 46 97 41 101 42Q107 43 102 48C116 45 133 48 145 54Q148 47 153 51Q158 56 153 59L157 61C167 71 172 83 171 97C171 109 165 119 157 124L89 122L73 109Z"
          stroke="none"
        />
        <path
          d="M69 88C69 71 79 56 95 50C93 46 97 41 101 42Q107 43 102 48C116 45 133 48 145 54Q148 47 153 51Q158 56 153 59M157 61C167 71 172 83 171 97C171 109 165 119 157 124"
          fill="none"
        />
        <g fill="#f5bbc8" stroke="none">
          <ellipse
            cx="85"
            cy="74"
            rx="10.2"
            ry="6.2"
            transform="rotate(24 85 74)"
          />
          <ellipse
            cx="136"
            cy="86"
            rx="10.5"
            ry="6.8"
            transform="rotate(34 136 86)"
          />
        </g>
        <g fill="none" strokeWidth="2.4">
          <path d="M98 60.5Q101 59 104 60M122 63Q126 63 128 64.5" />
          <path d="M94 67.5Q98 66.5 102 68M123 71Q127 72 130 75" />
          <path d="M111 75L110.5 78.5M103 77Q105 81 110.5 78.5Q116 83 118 80.5" />
          <path d="M108.5 85Q110 87 112.5 86" />
          <path
            d="M82 69.5 78.5 73M86.5 71 83 75M91 73 88 76.5M95 75 93 77M130 80 127 83.5M134.5 82.5 131.5 86M139 85.5 136.5 89M143 89 141.5 92"
            strokeWidth="2"
          />
        </g>
        <g fill="#dba16e" strokeWidth="2.2">
          <circle cx="58" cy="86" r="4.5" />
          <circle cx="74" cy="83" r="4.5" />
          <path d="M54 92Q54 82 65 82Q78 79 81 91Q84 98 78 103L84 111Q87 118 79 119L57 118Q48 116 52 108L55 102Q50 98 54 92Z" />
          <ellipse cx="66" cy="96" rx="6" ry="5" fill="#fff0d8" />
          <g fill="#302c2a" stroke="none">
            <circle cx="60" cy="91" r="1.5" />
            <circle cx="74" cy="90" r="1.5" />
            <ellipse cx="66" cy="94" rx="1.8" ry="1.3" />
          </g>
          <path d="M66 95v3m-7 11q5-3 7 2m8-3 2 4" fill="none" />
        </g>
        <path d="M49 111q-1-7 5-8q6-1 9 5l3 6m8-2q-2-8 4-9q5-1 7 5l4 7" />
        <g className="origin-[99px_194px] animate-[pajama-breathe_4.8s_ease-in-out_infinite]">
          <path d="M43 119Q42 111 51 112Q55 105 62 111Q68 105 74 111Q81 105 88 112Q94 106 101 113Q108 107 114 114Q121 108 128 115Q135 109 141 116Q149 112 154 120Q164 116 166 125Q172 130 164 137Q168 144 160 149Q163 156 154 160Q154 168 145 171Q145 179 135 180Q132 188 123 187Q118 195 109 191Q101 198 93 191Q85 195 79 188Q69 192 63 185Q51 187 47 178Q35 180 32 171Q22 170 25 160Q19 154 25 147Q21 139 29 134Q26 126 35 125Q35 117 43 119Z" />
          <path
            d="M41 128q7-3 12 1m-13 8q6-1 11 3"
            fill="none"
            strokeWidth="2"
          />
        </g>
      </g>
    );

  return (
    <g
      className="chiikawa-awake"
      transform="translate(100 0) scale(-1 1)"
      fill="#ffffff"
      stroke="#171512"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path
        className="hero-rest-pose"
        d="M30.3 25.8C27.8 23.1 27.8 18 31.2 17.6C34.5 17.2 35.5 20.6 35.1 23.4C44.1 20.2 57.9 20.7 66.9 24.1C67.3 21.3 68.2 17.8 71.4 18.2C74.6 18.6 74.6 23.3 71.6 26.3C80.4 32.6 85.5 43.5 85.2 54Q85.1 64.4 76.6 69.1L77.4 76.3Q77.7 80.1 75 80.7Q72.6 80.9 73 76.7L73.1 74.1C71.9 81.2 67.9 87.8 64 90.8L62.6 98Q61.2 101.8 59.7 98.4L59 92.5Q50 94 41.4 92.4L41.5 97.4Q40.9 100.8 39.1 97.8L37 91.5C31.4 88.2 27.4 82 26.8 74.4L26.8 77.2Q27 80.3 24.4 79.9Q22 79.4 22.6 75.9L22.8 69.1C15.1 64.6 13.1 57.4 14.2 49.5C15.4 39 21.2 30.7 30.3 25.8Z"
      />
      <path
        className="hero-attack-pose"
        visibility="hidden"
        d="M30.3 25.8C27.8 23.1 27.8 18 31.2 17.6C34.5 17.2 35.5 20.6 35.1 23.4C44.1 20.2 57.9 20.7 66.9 24.1C67.3 21.3 68.2 17.8 71.4 18.2C74.6 18.6 74.6 23.3 71.6 26.3C80.4 32.6 85.5 43.5 85.2 54Q85.1 64.4 76.6 69.1L73.1 74.1C71.9 81.2 67.9 87.8 64 90.8L62.6 98Q61.2 101.8 59.7 98.4L59 92.5Q50 94 41.4 92.4L41.5 97.4Q40.9 100.8 39.1 97.8L37 91.5C31.4 88.2 27.4 82 26.8 74.4L22.8 69.1C15.1 64.6 13.1 57.4 14.2 49.5C15.4 39 21.2 30.7 30.3 25.8Z"
      />
      <g fill="#ffabbc" stroke="none">
        <ellipse
          cx="28.8"
          cy="54.3"
          rx="7.2"
          ry="5.6"
          transform="rotate(18 28.8 54.3)"
        />
        <ellipse
          cx="66.7"
          cy="55"
          rx="8"
          ry="5.7"
          transform="rotate(-9 66.7 55)"
        />
      </g>
      <path
        d="M34.8 37q2.4-1.6 5-1M63.2 37q-2.4-1.6-5-1"
        fill="none"
        strokeWidth="1.3"
      />
      <g fill="#171512" stroke="none">
        <path d="M41.3 42.8C40 39.7 34.5 40.8 33.6 44.4Q32.6 49.7 37.2 50.5Q42.1 50.9 41.8 46ZM64.1 42.8C62.8 39.7 57.3 40.8 56.4 44.4Q55.4 49.7 60 50.5Q64.9 50.9 64.6 46Z" />
        <g fill="#ffffff">
          <ellipse
            cx="37.6"
            cy="43.7"
            rx="2"
            ry="1.1"
            transform="rotate(-10 37.6 43.7)"
          />
          <path d="M39.9 47.1q-2.5 1.4-4.8-.7q.4 3 3 2.5q1.4-.2 1.8-1.8ZM62.7 47.1q-2.5 1.4-4.8-.7q.4 3 3 2.5q1.4-.2 1.8-1.8Z" />
          <ellipse
            cx="60.4"
            cy="43.7"
            rx="2"
            ry="1.1"
            transform="rotate(-10 60.4 43.7)"
          />
        </g>
      </g>
      <path
        d="M48.5 51.5v1.8M43.3 53.3q2.3 3.2 5.2.7q2.8 3.4 5.4.6m-6.5 1.2q1.1 3.3 3.6 1.5m-1.8 4.2 1.1.3"
        fill="none"
        strokeWidth="1.6"
      />
      <path
        d="m24.1 51.6-1.1 3.2m4.6-2.4-1.2 3.3m4.6-2.5-1.1 3.4m4.3-2.5-.9 2.9m27.8-4.6-1.2 3.3m4.7-3.3-1.2 3.4m4.7-3.4-1.1 3.5m4.5-3.2-.9 3"
        fill="none"
        strokeWidth="1.2"
      />
      <Sasumata />
    </g>
  );
}

export function Hachiware({ asleep }: { asleep: boolean }) {
  return (
    <g
      fill="#ffffff"
      stroke="#171512"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M71 86q6-4 9-1q2 3-9 5Z" fill="#78a9be" />
      <path
        className="hero-rest-pose"
        d="M26 33L30.5 21Q32.7 14.5 36.1 18.4Q40.5 20.4 43 24Q50 21.2 56.5 24Q60.7 19.5 65.2 18Q67.7 17 69.6 23L73.6 32.5Q76 30.7 75.4 33.8C83 39.4 87 49.5 85 59.4Q84 66.8 79.4 70.9Q86 73.7 83.4 76.2Q81.6 77.7 77.2 75.3C75.2 84.2 71.1 89.1 64.4 92.8L62.8 98.5Q60.2 102 58.4 98.2L57.4 94.3Q49.6 95.2 43.5 94.4L42.3 98.3Q40.7 101.4 38.6 98.6L36.5 93.1C29.5 91.4 26.7 86.6 25.2 79.6Q19.5 80.3 18.6 76.8Q17.8 74 21.3 72.8L22.3 68.7C14.6 62.6 12.7 54.4 16.1 45.2Q19.3 37 26 33Z"
      />
      <path
        className="hero-attack-pose"
        visibility="hidden"
        d="M26 33L30.5 21Q32.7 14.5 36.1 18.4Q40.5 20.4 43 24Q50 21.2 56.5 24Q60.7 19.5 65.2 18Q67.7 17 69.6 23L73.6 32.5Q76 30.7 75.4 33.8C83 39.4 87 49.5 85 59.4Q84 66.8 79.4 70.9L77.2 75.3C75.2 84.2 71.1 89.1 64.4 92.8L62.8 98.5Q60.2 102 58.4 98.2L57.4 94.3Q49.6 95.2 43.5 94.4L42.3 98.3Q40.7 101.4 38.6 98.6L36.5 93.1C29.5 91.4 26.7 86.6 25.2 79.6L22.3 68.7C14.6 62.6 12.7 54.4 16.1 45.2Q19.3 37 26 33Z"
      />
      <path
        d="M26 33L30.5 21Q32.7 14.5 36.1 18.4Q40.5 20.4 43 24Q50 21.2 56.5 24Q60.7 19.5 65.2 18Q67.7 17 69.6 23L73.6 32.5Q76 30.7 75.4 33.8Q66 39 56.5 34.4Q51.1 32.8 49.5 30.7Q45.3 35.3 37.5 35.9Q30 36.2 26 33Z"
        fill="#78a9be"
      />
      <path
        className="hero-rest-pose"
        d="M25.2 79.6q3.8-1.2 3.6-4.2q-.4-2.4-2.9-1.1"
        fill="none"
      />
      <g fill="#ffb8c5" stroke="none">
        <ellipse
          cx="29"
          cy="55.8"
          rx="6.5"
          ry="4.8"
          transform="rotate(-14 29 55.8)"
        />
        <ellipse
          cx="71.7"
          cy="56.1"
          rx="6.5"
          ry="4.8"
          transform="rotate(12 71.7 56.1)"
        />
      </g>
      <path d="m38.3 40 1-.5m18.6.9 1 .5" fill="none" strokeWidth="1.3" />
      {asleep ? (
        <path d="M33.6 49.5q4.2 3.7 8.4 0m14.5 1.2q4.3 3.9 8.6 0" fill="none" />
      ) : (
        <g fill="#171512" stroke="none">
          <path d="M33.6 48Q33.8 43.9 37.8 44.4Q42.3 44.8 42 49.2Q41.7 53.1 37.7 53Q33.2 52.6 33.6 48ZM56.5 49Q56.5 44.7 60.9 45.1Q65.4 45.5 65.1 49.8Q64.8 54 60.7 53.8Q56.3 53.5 56.5 49Z" />
          <g fill="#ffffff">
            <ellipse
              cx="37.7"
              cy="46.7"
              rx="1.7"
              ry="1"
              transform="rotate(18 37.7 46.7)"
            />
            <path d="M35.3 49.7q2.6-1.2 4.6 1.1q-3 .9-4.6-1.1ZM58.2 50.5q2.6-1.2 4.7 1q-2.8 1.1-4.7-1Z" />
            <ellipse
              cx="60.7"
              cy="47.5"
              rx="1.7"
              ry="1"
              transform="rotate(18 60.7 47.5)"
            />
          </g>
        </g>
      )}
      {!asleep && (
        <path
          d="M47.4 59q-.6 6.1 2.7 6.1q3.2-.1 2.5-5.9"
          fill="#f5b0bc"
          strokeWidth="1.6"
        />
      )}
      <path
        d="M49.9 56v1.8m-4.6-.1q1.7 3 4.6.3q2.8 2.8 4.6-.1m-5.1 10h1"
        fill="none"
        strokeWidth="1.6"
      />
      <path
        d="m25.6 54.4-1.3 2.6m4.5-2.8-1.3 2.7m4.6-2.8-1.4 2.8m38-2.6-1.3 2.6m4.6-2.5-1.3 2.6m4.5-2.4-1.2 2.6"
        fill="none"
        strokeWidth="1.1"
      />
      {!asleep && <Sasumata blue />}
    </g>
  );
}

export function Usagi({ asleep }: { asleep: boolean }) {
  if (asleep)
    return (
      <g
        transform="translate(119 -11) scale(-.34 .34)"
        fill="#fff5d3"
        stroke="#16130f"
        strokeWidth="5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <g className="origin-[226px_127px] animate-usagi-sleep-ears">
          <path d="M208 128C205 110 214 82 230 63Q244 50 260 48Q269 47 263 58C246 74 233 98 230 125M229 129C235 105 250 83 271 73Q288 65 291 71Q294 77 285 85C266 101 253 118 247 140" />
          <path
            d="M213 122C212 99 225 73 239 61L252 55C233 77 224 99 221 124ZM235 128C242 104 256 87 273 79L283 75C264 94 251 113 244 134Z"
            fill="#f5b5c4"
            stroke="none"
          />
        </g>
        <path
          d="M207 121C169 115 138 132 120 160C105 181 101 207 109 229Q116 244 132 253C122 258 121 273 127 280Q131 285 138 277C140 293 155 305 172 310Q176 330 187 330Q193 331 193 315Q195 333 203 331Q210 330 212 315C229 313 242 304 248 292Q256 294 259 284Q262 275 258 266C283 253 298 233 299 207C301 169 282 141 250 132Q231 123 207 121Z"
          stroke="none"
        />
        <path
          d="M207 121C169 115 138 132 120 160C105 181 101 207 109 229Q116 244 132 253M250 132C282 141 301 169 299 207C298 233 283 253 258 266M126 257Q119 273 127 280Q134 286 138 273M138 284Q146 303 172 310Q176 330 187 330Q193 331 193 315M193 315Q195 333 203 331Q210 330 212 315C229 313 242 304 248 292M258 273Q262 290 252 292Q243 292 245 280"
          fill="none"
        />
        <g fill="#f5b5c4" stroke="none">
          <ellipse cx="144" cy="183" rx="21" ry="16" />
          <ellipse cx="242" cy="200" rx="19" ry="16" />
        </g>
        <g fill="#fffefa" strokeWidth="4.5">
          <ellipse
            cx="174"
            cy="171"
            rx="6.3"
            ry="5.6"
            transform="rotate(-15 174 171)"
          />
          <ellipse cx="223" cy="181" rx="5.6" ry="6.3" />
        </g>
        <g fill="none" strokeWidth="4.5">
          <path d="M148 155Q160 134 182 133M225 141C245 141 256 159 258 180" />
          <path d="M184 193Q182 201 191 201Q198 202 199 194M191 201Q191 207 185 209Q188 214 193 211M195 202Q201 206 206 202" />
          <path d="m135 178-4 6m12-5-4 8m12-6-4 8m12-5-3 6m80 8-3 7m11-6-3 7m11-6-3 7m10-6-2 6" />
        </g>
        <g
          className="origin-[184px_195px] animate-usagi-sleep-bubble"
          fill="#ddf7fa"
          fillOpacity=".65"
          strokeWidth="3.5"
          aria-hidden="true"
        >
          <path d="M184 195C173 176 171 145 145 134C117 118 83 133 81 160C78 200 128 219 184 195Z" />
          <path
            d="M101 143q-18 14-8 32"
            fill="none"
            stroke="#ffffff"
            strokeWidth="4"
          />
        </g>
      </g>
    );

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
        className="hero-rest-pose"
        d="M39.1 31.7C36.4 27.3 34.1 19.8 32.3 15.5C30.1 10.2 29.8 7.8 32.9 7.3C35.8 6.5 38.7 10 40.1 12.8C39.5 8.9 39.2 5.3 41.6 5.2C45.1 3.7 49.4 10.8 51.4 15.4C53.4 20.3 54.1 26.4 53.5 29.6L56 30C67 30.1 75.6 35.9 79.1 45.7C82.7 55.2 80.9 65.3 76 69.6L77 72.2C80.4 74.2 79.1 78.6 76.7 80Q74.9 81.2 73.5 80.1C71.8 87.4 67.4 92.2 61.1 93Q64.1 96.4 61.1 98Q58.9 99.1 56.7 96.9Q52.4 100.9 50.9 97L50.8 94.3C43.4 94.1 37.3 90.6 34.4 85.3L31.7 83.1C27.7 84.1 25.3 81.7 25.7 77.8Q25.9 75.2 28.3 72.7C19.6 70.5 16.8 60.8 17.9 52.8C18.5 45.8 23.7 37.5 29.5 34.8Q34 32.4 39.1 31.7Z"
        stroke="none"
      />
      <path
        className="hero-attack-pose"
        visibility="hidden"
        d="M39.1 31.7C36.4 27.3 34.1 19.8 32.3 15.5C30.1 10.2 29.8 7.8 32.9 7.3C35.8 6.5 38.7 10 40.1 12.8C39.5 8.9 39.2 5.3 41.6 5.2C45.1 3.7 49.4 10.8 51.4 15.4C53.4 20.3 54.1 26.4 53.5 29.6L56 30C67 30.1 75.6 35.9 79.1 45.7C82.7 55.2 80.9 65.3 76 69.6Q77 74 73.5 80.1C71.8 87.4 67.4 92.2 61.1 93Q64.1 96.4 61.1 98Q58.9 99.1 56.7 96.9Q52.4 100.9 50.9 97L50.8 94.3C43.4 94.1 37.3 90.6 34.4 85.3L31.7 83.1Q26 78 28.3 72.7C19.6 70.5 16.8 60.8 17.9 52.8C18.5 45.8 23.7 37.5 29.5 34.8Q34 32.4 39.1 31.7Z"
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
        d="M46.6 30.1C46.5 23.4 39.9 8.7 34.2 7.4C27.5 5.2 31.4 15.1 33.1 19.6L39.1 31.7C30.4 32.8 24.2 36.6 20.1 45.5C14.3 55 17.9 69.8 28.3 72.7M40.1 12.8C39.5 8.9 39.2 5.3 41.6 5.2C45.1 3.7 49.4 10.8 51.4 15.4C53.4 20.3 54.1 26.4 53.5 29.3M56 30C67 30.1 75.6 35.9 79.1 45.7C82.7 55.2 80.9 65.3 76 69.6M73.5 76.5C73.9 84.3 67.4 92.2 61.1 93M34.4 85.3C37.3 90.6 43.4 94.1 50.8 94.3L55.1 93.9M50.8 94.3Q50.5 99.7 54 98.5L56.7 96.9M55.1 93.9C56.7 96 57.7 98.8 60.5 98.2C64 97.5 62.1 93 59.9 92.2"
        fill="none"
      />
      <path
        className="hero-rest-pose"
        d="M28.3 72.7C24.8 75.6 24.8 80.4 28.1 82.7C32.3 85 35.9 81.3 32.1 79.4Q31.1 78.6 30.5 79M77 72.2C80.4 74.2 79.1 78.6 76.7 80Q74.9 81.2 73.5 80.1"
        fill="none"
      />
      <path
        className="hero-attack-pose"
        visibility="hidden"
        d="M28.3 72.7Q26 78 31.7 83.1M76 69.6Q77 74 73.5 80.1"
        fill="none"
      />
      <path
        d="M29.2 49.1C29.5 44.2 34.3 37.2 38 38.2M53.7 36.8C59.5 34.8 67.4 39.8 68.7 47.7"
        fill="none"
        strokeWidth="1.7"
      />
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
      <path
        className="hero-rest-pose"
        d="M51.6 57.9v1.6M47.3 59.5q2.1 2.8 4.5-.1q3.9 2.8 4.1-1M51.9 60.5q2.5 2.9.8 3.2l-1.4-.3"
        fill="none"
        strokeWidth="1.6"
      />
      <path
        d="M29.3 58.6l-.2 2.6M32.5 58.3l-.2 1.9M35.4 58.3v1.7M65.5 55.2l-.3 2M68.7 54.8l-.2 1.8M71.7 54.5v1.4"
        fill="none"
        strokeWidth="1.8"
      />
      <g className="hero-attack-pose" visibility="hidden">
        <path d="M49.5 61q1 9 4.5 8 3-1 2.5-9" fill="#51332b" />
        <path
          d="M51.5 66q2-3 4.2-1l-1 3.5q-2 1.5-3.2-2.5Z"
          fill="#f3b9c4"
          stroke="none"
        />
        <path
          d="M51.6 57.9v1.6M47.3 59.5q2.1 2.8 4.5-.1q3.9 2.8 4.1-1"
          fill="none"
          strokeWidth="1.6"
        />
        <g className="usagi-staff">
          <path d="M34 81q4-4 9 0m27-8q3-6 7-5" fill="none" />
          <path
            d="M-3 76Q53 88 101 54q5-3 8 1t-3 8Q57 99-5 85q-5-2-3-6 2-3 5-3Z"
            fill="#ffd47c"
          />
          <path
            d="M-3 76l13 2q3 4-1 9l-14-2q-5-2-3-6 2-3 5-3ZM98 56l3-2q5-3 8 1t-3 8l-3 2q1-6-5-9Z"
            fill="#fffefa"
          />
          <path d="M40 80q1-4 4-3 4 1 3 6l-1 5q-2 4-5 1m31-18q-1-4 3-5 4-1 5 4l-1 5q-2 3-5 1Z" />
        </g>
      </g>
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
      fill="#fff3d8"
      stroke="#171713"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path
        className="hero-rest-pose"
        d="M77 64Q86 68 94 68Q91 72 90 79C89 85 87 88 83 89Q79 90 77 94Q74 97 70 94L65 90Z"
        fill="#fffefd"
      />
      <path
        className="hero-rest-pose"
        d="M80 73q2 2.5 5 3M86 78l.5.3"
        fill="none"
        strokeWidth="1.1"
      />
      {!asleep && (
        <g className="hero-attack-pose" visibility="hidden">
          <g className="rakko-cape" fill="#fffefd">
            <path d="M74 60Q89 55 103 64q11 3 19-2l-10 15Q104 94 81 92L68 84Z" />
            <path
              d="M82 68q18 9 29 1M80 79q12 6 21 2"
              fill="none"
              strokeWidth="1.1"
            />
          </g>
        </g>
      )}
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
      <g className="hero-rest-pose" fill="#fffefd" strokeWidth="1.1">
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
        className="hero-rest-pose"
        d="M42.7 75Q45.1 73.6 47.5 74.5Q50 73.7 52 74.4Q55.1 73.9 56.5 75.8Q57.2 77.6 54.8 79Q52 80.6 49.3 79.6Q47.2 81 45.2 79.7Q42.7 81.2 40.7 79.2Q39.4 77.3 42.7 75Z"
        fill="#171713"
        stroke="none"
      />
      {!asleep && (
        <g className="hero-attack-pose" visibility="hidden">
          <path
            d="m62 27-4 6-5 1 3 4-2 6 6-5 5 1-2-5 4-7-5 3Z"
            strokeWidth="1.5"
          />
          <path
            d="M48 76q5-4 9-1l3 3q-1 4-6 4-5-1-6-6Z"
            fill="#171713"
            stroke="none"
          />
          <g className="rakko-sword" strokeWidth="1.8">
            <path d="M33 78q-5-8-11-7l-2 8q6 6 13-1Z" fill="#171713" />
            <path d="M7 62-22 28-24 13-9 20 20 54Z" fill="#eef3f3" />
            <path d="m-16 25 7-5 29 34-7 4Z" fill="#d5dfe0" stroke="none" />
            <path
              d="m-24 13 8 12 29 33m-29-33-6 3m6-3 7-5"
              fill="none"
              strokeWidth="1.3"
            />
            <path d="m12 64 7-5 10 14-7 5Z" fill="#52595a" />
            <path d="m1 64 21-15 3 4L4 68Z" fill="#d5dfe0" />
            <path
              d="M18 68q3-4 6-1l5 7q1 4-3 5-5 1-8-4-3-4 0-7Z"
              fill="#171713"
            />
          </g>
        </g>
      )}
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
