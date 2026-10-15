import type { ReactNode } from "react";

function Ink({
  children,
  transform,
}: {
  children: ReactNode;
  transform: string;
}) {
  return (
    <g
      transform={transform}
      fill="#ffdab0"
      stroke="#342723"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </g>
  );
}

export function Shinchan({ asleep }: { asleep: boolean }) {
  if (asleep)
    return (
      <Ink transform="translate(-20 -51) scale(.2)">
        <g
          className="shinchan-sleep shinchan-sleep-spread"
          fill="#f3c5af"
          stroke="#1c1c1a"
          strokeWidth="4"
        >
          <path d="m162 623-9 9-26-3q-7-1 1 7l2 5 27 3 14 10q7 5 6-4l-2-10 11-10m73 94-22-3q-13-1-5 7l7 7-1 22q0 5 6 7l6 3q4 1 3-7l1-24 19-6" />
          <path
            d="M222 551Q187 543 174 565L153 614q-5 8 5 13l35 22q15 7 29-1l20-12 24 33-17 21q-9 10 1 24l29 34q9 13 24 6l33-15q25-18 36-43l9-12-50-54-58-59Z"
            fill="#ffffff"
          />
          <path d="M170 581q11-31 30-29l20 3-8 45-30-9Z" fill="#ffe333" />
          <path d="m282 685 51-3-19 45q-3 6-6-1Z" fill="#ed171b" />
          <path d="M220 624q27 10 46 45m-14-31 17 26" fill="none" />
          <g
            className="sleeping-torso"
            style={{ transformOrigin: "365px 610px" }}
          >
            <path d="m220 478-8-2 1-10q-2-8-6-1l-3 9-9-10q-9-5-5 3l8 8-14-3q-8 0-4 4l13 4-13 4q-6 4 1 5l13-1-10 6q-4 6 4 4l16-6 9 5Z" />
            <path d="m533 545 13-3 1-10q3-8 6 0l1 10 15-6q9-2 4 4l-12 8 16 1q10 4 2 7l-17-1 10 10q3 8-4 4l-12-9 5 11q-1 7-6 0l-9-13-11 2Z" />
            <path
              d="M227 470q14-5 32 3l74 39 132 23 64-2 12 51q-37 15-111 23l-32 58-22 33q-19-22-66-38l-29-12q-14-8-16-27-5-16-24-20l-18-5q-9-14-2-42h20l2-13-32-19q-10-6-6-16Z"
              fill="#ffffff"
            />
            <path d="m245 471 18 2 7 14-20 5Z" fill="#ffe333" />
            <ellipse
              cx="276"
              cy="539"
              rx="22"
              ry="27"
              transform="rotate(40 276 539)"
              fill="#6daf46"
            />
            <path d="M446 538q-1 23 16 29 11 3 21-3l-18-24Z" fill="#6daf46" />
            <path d="m339 566 54-24 5 56Z" fill="#ed171b" />
            <path
              d="m312 573 48 18q5 2 2 8l-24 36q-3 5-10 1l-40-18Z"
              fill="#ffe333"
            />
            <path
              d="m252 524 3 15m16 42q26 23 69 15m-102-39 16-19m176 63-6 10m-60 77 11 9"
              fill="none"
            />
          </g>
          <path
            d="M338 380q9-30 37-36 21-7 25 10 22-6 44 10 23-8 35 19l10 22q26 43 32 88l-39 19-63-112-65-8Z"
            fill="#191a18"
          />
          <path d="M329 387C295 380 267 400 256 429Q243 464 267 496C295 527 381 542 465 541C473 559 492 571 509 563C529 554 538 529 529 510C521 490 501 485 482 501L489 492l1-51-4-36q-15 10-22-13l-5-10q-13-6-26 3-14 5-10-8l6-9q-13-8-27-6-2 18-11 8l-9-12q-20 17-33 10l-11 8Z" />
          <path
            d="M316 396q-1 9 23 9 24 1 39-4 6-2 4-6m29 11q2 8 36 13 21 6 27 3"
            fill="none"
          />
          <ellipse
            cx="313"
            cy="497"
            rx="15"
            ry="10.5"
            transform="rotate(-23 313 497)"
            fill="#e69acb"
          />
        </g>
      </Ink>
    );

  return (
    <Ink transform="translate(1 -7) scale(.285)">
      <path d="m141 307 4 33q2 13 23 10l15-9-7-35m78-49q37-21 41-6l-3 27-25 11-15-17" />
      <path
        d="m159 348 13-4 8-9 10 16-7 12-20-8Zm111-67 19-4 7 21-16 7Z"
        fill="#fffdf0"
      />
      <path
        d="M175 359q12 1 12-9 9-4 9 5l-3 16q0 8-10 9l-27 2q0-5 19-14Zm104-59 13-5 5 5 17-13q8-4 9 4l-4 7-36 20q-12 6-7-6Z"
        fill="#ffe986"
      />
      <path
        d="M121 272 124 316q0 8 9 7l68-8 9-19 47 6q7 1 9-12l13-48-9-6-22 15-57 15Z"
        fill="#fff793"
      />
      <path d="m246 251 21-9" fill="none" />
      <path d="m251 159 28-41 14 8-25 50-11 23" fill="#eb0037" />
      <path d="m279 119 7-11 2-20q3-7 5 1l2 11 15-1 5 3-12 4 15 4q3 4-3 5l-12-1 12 8-4 3-13-6 7 9-5 2-11-10Z" />
      <path
        d="M77 161 53 157l-11 22 26 19 36 22 10 12 8 48q10 7 24-1l13-4 17-1 20-1 15-5 16-2 11-8 29-18-7-31-15-39Z"
        fill="#eb0037"
      />
      <path d="m51 160-5-1-3-17q-4-6-5 2l-1 14-16-1q-8 1 0 6l10 4-10 6 2 4 11-4-4 8 4 2 7-10-1 13 5-1 9-14" />
      <path d="M101 140C96 117 89 122 79 132Q65 140 65 165Q64 191 84 184L103 177 108 180 116 177 122 180 128 178 133 180 148 178 168 180 186 179 207 180 229 178 252 179C276 178 291 157 287 131C284 106 267 92 240 92Q238 64 220 52C200 36 170 38 145 46C113 52 87 82 84 117Z" />
      <path
        d="M83 132C82 93 102 59 139 46Q173 35 199 42L207 40Q236 53 240 91L231 81 229 66 215 54 199 49 182 48 158 52 146 55 132 65 115 81 107 93 99 88 96 117 101 144Z"
        fill="#261e1b"
        stroke="none"
      />
      <path
        d="M121 62q8-10 18-2l19 13q8 12-6 9l-19-12-9 8q-8 5-10-1Zm65-9q8-13 16-10l17 13q10 8 5 12-6 3-13-3l-10-8-12 13q-6 5-11 1-3-4 8-18Z"
        fill="#261e1b"
        stroke="none"
      />
      <path
        d="M112 113q7-32 28-30 20 2 25 16m20-7q7-27 25-24 17 3 23 19"
        fill="none"
        strokeWidth="2.5"
      />
      <g stroke="none">
        <ellipse
          cx="150"
          cy="119"
          rx="25"
          ry="21"
          transform="rotate(-24 150 119)"
          fill="#261e1b"
        />
        <ellipse
          cx="209"
          cy="107"
          rx="24"
          ry="21"
          transform="rotate(-27 209 107)"
          fill="#261e1b"
        />
        <ellipse
          cx="152"
          cy="117"
          rx="9"
          ry="7"
          transform="rotate(-24 152 117)"
          fill="#fffefa"
        />
        <ellipse cx="209" cy="106" rx="8" ry="7.5" fill="#fffefa" />
      </g>
      <path
        d="M220 161q10-12 24 6 12 16-3 20-13 0-20-12-5-9-1-14Z"
        fill="#bb6e76"
      />
    </Ink>
  );
}

export function Kazama({ asleep }: { asleep: boolean }) {
  if (asleep)
    return (
      <Ink transform="translate(-21 -11) scale(.2)">
        <g
          className="shinchan-sleep"
          fill="#f4c4a9"
          stroke="#211e22"
          strokeWidth="4"
        >
          <path
            d="M211 353q-19-7-32 1-13 8-5 22l17 24q5 6-4 15l-10 13q-8 14 8 23l17 10q-25 17-29 39-5 23 19 44 12 13 24 9l22-8q25 24 48 17 23-2 47-23l28-29-8-39-12-39q-3-14-24-18l-26-16-26-23-34-21Z"
            fill="#effbfa"
          />
          <path
            d="M232 382q29 15 55 46m-61 27q49-2 91 24m-114-18-11-6"
            fill="none"
            strokeWidth="3"
          />
          <path d="m398 528-17 14q-9 10 2 8l24-10 11-5m-60-16-15 12q-7 8 4 6l24-9 9-8" />
          <g
            className="sleeping-torso"
            style={{ transformOrigin: "425px 530px" }}
          >
            <path
              d="M352 319q34-18 68-13c44 0 81 39 98 88q17 37 9 69c-5 22-34 29-57 30l-10 40q-1 8-13 7l-53-7-14-8-47-1q-14 1-13-8l-3-61q2-27 22-29l3-1q-17-18-29-34l-9-22Z"
              fill="#79bad0"
            />
            <path
              d="M355 319q18 13 36-5M400 442q44 22 89 19"
              fill="none"
              strokeWidth="3"
            />
            <path
              d="M350 432q26-3 40 21 19 9 26 27l5 34q3 12-8 11M321 450q15-9 32-5"
              fill="none"
              strokeWidth="3"
            />
            <path d="m305 366-18 7q-5 4 1 15l7 13q4 8 12 4l17-11Z" />
            <path d="m292 390 7 5" fill="none" strokeWidth="2.7" />
            <path
              d="M355 322q-31 0-52 43l19 26q12 5 28-12l20-30q0-17-15-27Z"
              fill="#79bad0"
            />
            <path d="M350 351q-4 15-13 25" fill="none" strokeWidth="3" />
          </g>
          <path d="M279 247q-15 14-18 31l-17 25q-16 24-10 45 5 23 25 28 15 6 39-3l30-32q25-28 72-36l-19-24q19-7 18-28 1-22-21-29-24-8-35 22l-6-15-21-22-30 24Z" />
          <path
            d="m249 237 45-113q8-25 25-20l79 54 78 5q26 1 22 29-13 60-49 113l-49 1-19-24q19-6 18-29 1-21-20-28-25-9-36 21l-6-15-21-21-27 23-19 23-46 33q-13 0-33-25l-17-22q-7-11 6-8l45 13-11-24q-4-11 5-7Z"
            fill="#202039"
          />
          <path
            d="M266 257q-1 17 12 17 18-2 25-27"
            fill="none"
            strokeWidth="3.7"
          />
          <path
            d="M276 375q5-16 14-15 10 1 12 15l-14 4Z"
            fill="#88485e"
            strokeWidth="3.2"
          />
        </g>
      </Ink>
    );

  return (
    <Ink transform="translate(7 1) scale(.25)">
      <path d="m98 331 4 45 19 1 15-42m51 1 5 40 21 1 12-43" />
      <path d="m102 370 19-1-2 22-17 2Zm90-7 21 1-1 25-17 1Z" fill="#fffdf3" />
      <path
        d="m102 385 14 3 7 6-21 6-31 3q9-9 29-13Zm93-2 15 3 9 4 22 4q7 3-5 3l-45-2Z"
        fill="#eff9ec"
      />
      <path d="m89 302-8 41 76-5 6-4 75 2-1-39Z" fill="#087eaf" />
      <path d="m156 338 7-9 7-4" fill="none" />
      <path
        d="M92 204q-14 0-21 15l-13 41q0 29 20 23l13-12-6 35q0 12 17 10l19-5 16 4 18-1 23-7 19 6 17-6h26q0-35-11-61 20-9 39-31l-9-17-22 7-18-7Z"
        fill="#81cbed"
      />
      <path
        d="m86 258 10-7m-17-1 15-1m125-32 10-2m-5-7 9-1M148 232l3-4m12 1 2 7m11-7 1 6m9-9 4 5"
        fill="none"
        strokeWidth="2.4"
      />
      <path d="M88 237q-3-6 6-9l10-4q10-4 14 4l4 22q1 10-10 11-13 2-18-9l-6-7 4-1Z" />
      <path d="M112 226q6-5 8 2l3 11" fill="none" />
      <path d="m262 203 9-6q-2-10 3-10l7 4 11-10q11-4 8 2l-12 11 6 5q4 8-2 11l-13 4-8-5-5 6Z" />
      <path d="m277 195 5 7-3 5m8-13 1 7" fill="none" />
      <path d="M69 137Q54 160 53 198q-1 13 10 11l28-10 22 4 25 7 23 8 24 6q28 9 48-2 24-12 22-38-1-25-27-38l12-36-24-44-106 1Z" />
      <path
        d="M84 167 68 149l-6 9Q42 131 40 103q13-10 56-20l40-55q12-17 24-1l69 61 14-24 1 29 37-30q-6 22-20 46l-5 7q-26 3-144-28L99 134Z"
        fill="#074a7a"
      />
      <path
        d="M91 122q20-31 33-21l31 23m26-1q21-32 36-22l10 13M167 117v6"
        fill="none"
        strokeWidth="2.4"
      />
      <>
        <path
          d="M98 142q16-27 35-25 14 3 23 17m22 2q10-20 25-22 16-2 22 17"
          fill="none"
          strokeWidth="2.5"
        />
        <g fill="#261e1b" stroke="none">
          <ellipse
            cx="135"
            cy="151"
            rx="24"
            ry="20"
            transform="rotate(-20 135 151)"
          />
          <ellipse
            cx="200"
            cy="149"
            rx="22"
            ry="19"
            transform="rotate(-22 200 149)"
          />
        </g>
      </>
      <path d="m187 175 6 10-1-7Z" fill="#342723" strokeWidth="2" />
      <path d="M180 202q12-14 23-4 10 13-12 21-21 4-11-17Z" fill="#b86d73" />
    </Ink>
  );
}

export function Nene({ asleep }: { asleep: boolean }) {
  if (asleep)
    return (
      <Ink transform="translate(0 0)">
        <g
          className="shinchan-sleep"
          fill="#f4c4a9"
          stroke="#211e22"
          strokeWidth="1.2"
        >
          <path d="M79 92q9 0 10 4-1 4-10 3l-7-3m-5 1q8 0 9 3l-9 1" />
          <g className="sleeping-torso">
            <path d="M47 76q12-5 22 2l13 11-6 9-25-3-10-10Z" fill="#f4b8d9" />
            <path d="M68 86q10-6 15 2l2 7-13 5-14-4Z" fill="#f4b8d9" />
            <path
              d="M70 80q8 3 12 9 5 0 5 4-1 4-6 3-3 6-7 2-3 5-8 1-5 3-8-2l-2-4q10 2 14-13Z"
              fill="#f9d7e7"
            />
            <path d="m51 77 2 11 7-5 3 8 4-10" fill="#fff1f5" />
            <path d="m58 85 3 7m-2-6 7 4" fill="none" />
            <circle cx="62" cy="94" r="1.1" fill="#fff1f5" />
            <circle cx="68" cy="91" r="1.1" fill="#fff1f5" />
            <path d="M47 82q8 0 8 8l-12 8-10-6q2-10 14-10Z" fill="#f4b8d9" />
            <path d="m40 90 8 5" fill="none" />
          </g>
          <path d="M42 92q-5-4-11-1l-6 5q2 4 9 3l12-3m-17-1 7 1" />
          <g
            transform="translate(34 76) rotate(-22) scale(.36) translate(-615 -514)"
            strokeWidth="2.8"
          >
            <path
              d="M582 500q-16-9-23 1l-8 12 17 9-19 5 7 16 23-12m76-40 24-6 6 17-10 12 7 3-22 10"
              fill="#ae3e3b"
            />
            <path
              d="m558 513 17 3m-18 17 16-10m92-24 14 3m-19 7 14 4"
              fill="none"
            />
            <path
              d="M584 505q0-26 28-31 27-6 47 10l13 18-11 30-63 4Z"
              fill="#ae3e3b"
            />
            <path d="M593 505q-5-10-13-3-9 7-7 18l11 14 18 5 27 9q30 10 41-3 12-16-9-31l-2-15-11-8-47-3Z" />
            <path
              d="m590 508 8-15 10-2-2 10 9-12 8 14 2-12 10 13 1-12 9 12 1-7 12 9m-55-22-4 9m18-10-2 10m17-7 1 10m13-5 3 8"
              fill="none"
            />
            <path
              d="M602 501q10-7 20 1m14 6q7-5 15 2"
              fill="none"
              strokeWidth="3.4"
            />
            <path
              d="M600 512q10 10 22 0m11 6q9 8 20 0m-51-4-3 3m40 4-1 3"
              fill="none"
              strokeWidth="3.4"
            />
            <path d="M632 536q5 4 10 0" fill="none" strokeWidth="2.4" />
          </g>
        </g>
      </Ink>
    );

  return (
    <Ink transform="translate(2 -6) scale(.285)">
      <path d="m108 291-21 15 27 32q9-4 23-28m47 1 10 40 18-2 2-31" />
      <path
        d="m87 299-7 12 11 12 13-12Zm107 44 17-3 1 20-16 9Z"
        fill="#fffdf3"
      />
      <path
        d="m84 290-11 17-18 17q-2 5 6 2l22-10 7 5 4-9-10-7 7-12Zm111 74-5 15q1 3 8 0l35-15q-1-5-12-2l-13 4 7-16-10 2-5 12Z"
        fill="#d5124a"
      />
      <path
        d="m114 249-26 19q-8 5-2 12 29 30 68 34l10-1 21 10q7 3 23-4l32-4q8-2 7-7l-15-31-4-24Z"
        fill="#eb7096"
      />
      <path
        d="m117 264-11 15m31-7-11 18m33-15-4 22m26-17-2 23m22-20 3 19m17-20 5 17"
        fill="none"
        strokeWidth="2.4"
      />
      <path
        d="M116 187q-17 5-34 14l-13 3 6 17 42 4-14 28q27 24 59 24l15-1 24 6 28 1q10-1 11-34 24 7 33 1 10-9 4-41l-20-10-15 25-5-27Z"
        fill="#ffe6e8"
      />
      <path d="m241 229-1 20" fill="none" />
      <path d="m72 207-8-11-7-9q-4-2-2 5l5 9-10-7q-5 0 0 6l5 5-8-1 2 5 7 2-7 1 1 3 15-1 8 5 5-5" />
      <path d="m146 190 15 33 35-20 25 24 11-24-40-21Z" fill="#fffefa" />
      <g fill="#b72813">
        <path d="m83 121-30-20q-10-5-14 8l2 7-5 9 1 18 40-15m160-60q-1-10 20-25 10-2 32 15 18 8 14 25l-2 23q-2 12-17 12l-36-17Z" />
        <path
          d="m41 116 35 8m-30 8 31-8m172-55q29-11 49 8m-47 3q29 6 37 31"
          fill="none"
          strokeWidth="2.5"
        />
        <path d="M106 151Q96 133 109 106C129 72 166 55 204 62Q235 61 254 80l4 59-24 41-107-5Z" />
      </g>
      <ellipse cx="93" cy="128" rx="11" ry="9" fill="#83c7bd" />
      <path d="M113 155Q102 139 95 143C85 148 77 173 80 184q3 13 27 1l7-4 16 6 22 4 18 5 23 7 22 4 27 5C271 213 288 200 287 177Q288 149 256 139l-7-38-111-8Z" />
      <path
        d="M109 145 113 125 130 112 141 102 160 102 170 93 176 102 185 102 187 89 196 105 202 104 208 96 217 108 224 107 233 108 236 103 245 110 256 116 257 98Q238 60 202 62C159 54 115 86 105 119L104 139Z"
        fill="#bd2a16"
      />
      <path
        d="M117 116q12 0 18-5m10-25-4 16m26-23 1 17m18-19 1 19m20-15 3 16m18-9 6 15m10-7 6 14"
        fill="none"
        strokeWidth="2.3"
      />
      <path
        d="M128 133q11-23 32-23 22-1 28 23m11-2q9-19 25-20 18-2 26 23"
        fill="none"
        strokeWidth="2.4"
      />
      <g stroke="none">
        <ellipse
          cx="163"
          cy="145"
          rx="23"
          ry="19"
          transform="rotate(-23 163 145)"
          fill="#261e1b"
        />
        <ellipse
          cx="217"
          cy="146"
          rx="20"
          ry="19"
          transform="rotate(-20 217 146)"
          fill="#261e1b"
        />
        <ellipse
          cx="164"
          cy="145"
          rx="8.5"
          ry="7.5"
          transform="rotate(-25 164 145)"
          fill="#fffefa"
        />
        <ellipse
          cx="216"
          cy="146"
          rx="7.5"
          ry="7"
          transform="rotate(-25 216 146)"
          fill="#fffefa"
        />
      </g>
      <path d="M233 190q10-6 15 2 5 13-10 20-15-2-5-22Z" fill="#b76c74" />
      <path d="m261 214 5-10 4-4 7-10q5-3 4 3l-6 10 7-5q5 0 1 5l-12 10-1 6Z" />
    </Ink>
  );
}

export function Masao({ asleep }: { asleep: boolean }) {
  if (asleep)
    return (
      <Ink transform="translate(0 0)">
        <g
          className="shinchan-sleep"
          fill="#f4c4a9"
          stroke="#211e22"
          strokeWidth="1.2"
        >
          <path d="M77 92q10-1 11 3 2 4-6 4l-7-1m-8-3q9 1 9 5l-12 1" />
          <g className="sleeping-torso">
            <path
              d="M46 74q13-5 24 2 11 6 11 16l-10 6-23-3-8-11Z"
              fill="#b2d394"
            />
            <path d="m48 76 5 11 7-6 5 8 6-8" fill="none" />
            <path
              d="m64 82-3 10m9-7-3 9m8-6-3 7"
              fill="none"
              stroke="#528d68"
            />
            <path d="M68 86q11-6 15 2l2 7-13 4-13-2q-5-5 0-9Z" fill="#b2d394" />
            <path d="m78 90 2 6m-18-3 9 2" fill="none" />
            <path d="M47 81q7 0 8 9l-11 8-11-6q2-9 14-11Z" fill="#b2d394" />
            <path d="m40 89 8 6" fill="none" stroke="#528d68" />
          </g>
          <path d="M42 92q-6-3-11 0l-6 4q2 4 10 3l11-3m-16-1 6 1" />
          <g
            transform="translate(33 75) rotate(-18) scale(.4) translate(-243 -495)"
            strokeWidth="2.8"
          >
            <path d="M195 491q-10-10-17 4-7 14 4 18l15-4m93-20q8-13 16-2 6 11-2 20l-12 3" />
            <path d="M193 496q2-25 27-34 21-10 43-3 24 5 34 24l5 22q-5 23-40 29-33 5-55-8-17-10-14-30Z" />
            <path
              d="M207 474q13-18 37-18 28-1 44 19l-12-7-12-1-13 4-12-3-12 3-11-1Z"
              fill="#9ec9bd"
            />
            <path
              d="m234 461 2 2m9-4 1 2m9 0 1 2m-15 2 2 1m22-1 2 2"
              fill="none"
              stroke="#4f8078"
              strokeWidth="2"
            />
            <path d="M228 477q7-3 14 0m10 1q7-3 13 1" fill="none" />
            <path
              d="M233 488q5 5 10 0m8 0q5 5 10 0"
              fill="none"
              strokeWidth="2.7"
            />
            <path
              d="m242 496 3 2 3-1m-9 4q6 4 12 0"
              fill="none"
              strokeWidth="2"
            />
            <path d="M240 516q5 4 10 0" fill="none" strokeWidth="2.4" />
          </g>
        </g>
      </Ink>
    );

  return (
    <Ink transform="translate(-1 -10) scale(.3)">
      <path d="m117 305-5 29 4 13 14-1 17-37m58-2 16 36 18-4 1-37" />
      <path d="m114 336 16 2-3 17-11 3Zm107 0 19-1-2 21-10 2Z" fill="#fffdf2" />
      <path
        d="m116 348-4 10-21 4q-7 4 2 5l42-4-1-6-7-6-6 6Zm112 3-7 17 34 7q5-2-7-8l-7-13-6 9Z"
        fill="#f6e58d"
      />
      <path
        d="m111 263-9 36q-4 10 7 11l58 1 8 5 82-6 2-11-7-42Z"
        fill="#5793c4"
      />
      <path d="m176 314 4-8-6-8" fill="none" />
      <path
        d="M88 185q-13 0-17 16l-10 33q-4 16 8 15l37-12-1 31q1 9 16 7l15-2 11 6 13 1 24-7 13 2 20-4 19-4 18 1-12-44 34 13 13-9q-13-18-24-26l-20-22-16-5Z"
        fill="#00aa80"
      />
      <path
        d="m87 221 16 6m-3-13 1 10m134-2 8 2"
        fill="none"
        strokeWidth="2.4"
      />
      <path d="M106 218q-4-7 5-7l9 2q8 2 10 12 3 8-6 11l-11 1-9-6q-3-5 4-7Z" />
      <path d="m281 230 6 1 9-4q9-2 8 5l-4 14q-2 8-8 3l-10-8q-6 0-5-4l5-2Z" />
      <path d="M53 97q-16-7-17 18-1 18 13 20l13-12m185 13q17-17 29 1 6 13 1 29-8 18-26 5" />
      <path d="M49 124C44 96 72 68 106 55C137 42 164 48 190 53C217 60 244 93 256 129L260 151C251 179 216 193 170 196C122 201 79 192 61 169Q48 149 49 124Z" />
      <path
        d="M104 56Q135 44 166 48C207 48 248 85 259 127L252 136 243 117 230 95 213 78 200 68 183 70 164 69 148 64 137 56 120 56Z"
        fill="#a3c9c1"
      />
      <path
        d="m151 53 3 2m19-1 3 1m16 7 3 1m-14 5 2 2m30 5 2 2m14 11 2 2"
        fill="none"
        stroke="#789b91"
        strokeWidth="1.8"
      />
      <path
        d="M96 66q25 21 51 1m35 7q4 24 31 20M78 100q39-37 63 0m24 4q26-27 60 11"
        fill="none"
        strokeWidth="2.5"
      />
      <g fill="#342723" stroke="none">
        <ellipse
          cx="141"
          cy="109"
          rx="3.4"
          ry="4.8"
          transform="rotate(20 141 109)"
        />
        <ellipse
          cx="168"
          cy="113"
          rx="3.4"
          ry="4.8"
          transform="rotate(20 168 113)"
        />
      </g>
      <path
        d="m119 130 3 3m2-5 3 3m61-6 3 3m3-2 3 3m2-3 3 3"
        fill="none"
        stroke="#e4a17b"
        strokeWidth="2"
      />
      <path
        d="m143 121-5 5q0 3 6 0 1 6 6 1 2 5 7 1l4-3"
        fill="none"
        strokeWidth="2.4"
      />
      <path
        d="M94 154q15-19 35-2 11 10 24 1 17-15 31-5 18 14 11 29-8 19-53 17-36 0-47-14-9-12-1-26Z"
        fill="#b4696f"
      />
    </Ink>
  );
}

export function Bochan({ asleep }: { asleep: boolean }) {
  if (asleep)
    return (
      <Ink transform="translate(0 42) scale(.105)">
        <g
          className="shinchan-sleep"
          fill="#f4c4a9"
          stroke="#211e22"
          strokeWidth="7.6"
        >
          <path d="M430 532q-20-2-41 9-11 9 0 14 22 7 46-4Z" />
          <path d="M826 338q25 2 46 20 11 12-1 15l-12-4q16 10 8 15-6 4-15-2 12 11 1 13l-24-10-13-27Z" />
          <path d="M842 407q24 15 39 41 10 15 3 19-5 3-11-4 14 14 6 20-5 3-11-5 10 14-1 14-22-6-38-28l-2-23Z" />
          <g
            className="sleeping-torso"
            style={{ transformOrigin: "665px 550px" }}
          >
            <path
              d="M465 222c14-36 45-34 90-24q56 2 92-11 23-7 28 10c58 1 87 35 99 96l8 44q16-23 38-8l23 19q17 18 12 42l-14 13q9 29-2 57-3 16-16 15l-75-6q-24 0-34-15-10 12-28 7l-45 6-80 1q-5 53-31 73-28 16-98 19l-13-17q13-28 27-56l28-30 7-54Z"
              fill="#f8e79b"
            />
            <path
              d="M675 208q24 79 25 138m-1 46q1 49 27 63m63-91q9-10 20 5l24 12M561 468l3-16"
              fill="none"
              strokeWidth="6.5"
            />
            <path d="M578 372q-15 10-16 25-5 18 4 16l12-15-9 23q-3 13 7 13 10 2 19-12-6 16 7 12 12-1 19-17-5 16 6 8 10-5 15-25l-3-28Z" />
            <path
              d="M476 216q19-32 53-21c40 6 81 24 107 53q16 20 15 52l-5 63q-2 12-24 12-28 5-44-7-11-16-11-39l-2-14q-19-11-35-17l-22-28Z"
              fill="#f8e79b"
            />
            <path
              d="M529 298q18 9 32 14 9 13 10 38"
              fill="none"
              strokeWidth="6.5"
            />
          </g>
          <path d="M263 193c-20-6-25-22-19-41 8-22 35-35 55-29 34 3 66 26 58 55 64-2 118 33 148 87 30 54 30 116 3 173-33 62-107 105-184 110-79 6-149-12-196-53-46-42-60-96-47-151 11-77 82-148 162-170q6 15 20 19Z" />
          <path
            d="M243 174c-84 16-148 90-164 170-15 64 14 113 53 152 27 23 48 27 69 33l-14-17q-9-15 4-10l11 6q9 4 2-8l-36-32q19 7 35 2 11-4 2-15l-39-37q27-14 44-39 4-7-11-14l-33-15q27-12 39-30 4-7-10-12l-36-7c12-49 54-89 104-108q-14-4-20-19Z"
            fill="#242021"
          />
          <path
            d="M259 338q-43 33-6 68m5 37q-33 24 11 57M334 362q12 27-13 46m1 35q21 15 17 39"
            fill="none"
            strokeWidth="6.5"
          />
          <path
            d="M376 422c37-7 75-35 96-24 17 5 20 26 5 35-22 19-58 10-101-4Z"
            fill="#fffdf4"
            strokeWidth="6.5"
          />
          <ellipse
            cx="511"
            cy="388"
            rx="4.5"
            ry="9"
            transform="rotate(12 511 388)"
            fill="#b86e73"
            strokeWidth="5"
          />
        </g>
      </Ink>
    );

  return (
    <Ink transform="translate(2 -6) scale(.28)">
      <path d="m139 316 3 38 18 2 8-35m47 1 3 32 20 2 5-34" />
      <path d="m142 351 18-1-2 22-13 3Zm76 0 20 2-3 20-15-1Z" fill="#fffdf3" />
      <path
        d="m145 366 10 3 3-3 3 12-46 6q-7-1 5-6l25-7Zm75 2 14 1 5 6 21 5q6 4-4 4l-45-3 2-9Z"
        fill="#eaf6e6"
      />
      <path d="m127 282-9 39q30 6 68 2l13 3 52-1 6-43Z" fill="#00a5a1" />
      <path d="m187 324 1-7-4-8" fill="none" />
      <path
        d="M136 185q-14 7-25 26l-16-12-12-16-8 7 9 31 16 15 25-6-2 53q-2 7 9 7l13-1 10 6 12-4 13 1 11-1 12 3 15-3 17 2 21-3 4-15 14-1-1-77-37-3Z"
        fill="#fbd77e"
      />
      <path d="m134 217-9 13m129 8 1 40" fill="none" strokeWidth="2.5" />
      <path d="m258 275 11 2q8 5 7 12-2 6-12 5l-10-4 2-8 5-1-2 8 6-1" />
      <path d="M176 41C147 55 121 87 122 132C119 174 142 208 185 214C222 219 258 204 269 169C293 178 307 158 302 139Q296 116 278 128C269 89 254 56 229 43Q204 29 176 41Z" />
      <path
        d="M150 65Q169 35 198 35C238 34 267 74 278 128L271 126 258 90 241 60 242 72 228 66 219 53 216 75 204 66 205 48 183 69 178 65 193 47 170 60 163 61 176 46Z"
        fill="#543a33"
      />
      <path
        d="M151 84q17-25 32-14 9 6 8 22m13-6q7-21 19-15 12 4 19 20"
        fill="none"
        strokeWidth="2.5"
      />
      <g fill="#342723" stroke="none">
        <ellipse cx="184" cy="98" rx="3" ry="4.7" />
        <ellipse cx="205" cy="100" rx="3" ry="4.7" />
      </g>
      <path
        d="m151 123 5-9m4 10 5-9m6 12 5-10m34 12 5-10m5 9 4-9m4 9 4-9"
        fill="none"
        stroke="#e9a27c"
        strokeWidth="2.2"
      />
      <path
        d="M188 122C185 137 188 157 184 163Q180 167 177 161C176 153 184 132 188 122Z"
        fill="#fffdf4"
        stroke="none"
      />
      <ellipse
        cx="182"
        cy="195"
        rx="5"
        ry="3.6"
        fill="#b86e73"
        strokeWidth="2.4"
      />
      <path d="M68 228q6-29 16-50 8-23-6-64" fill="none" strokeWidth="3.2" />
      <path
        d="M85 144q-9-4-6-15 8 3 6 15Zm2 9q1-11 10-10 0 8-10 10Z"
        fill="#338663"
        strokeWidth="2"
      />
      <g fill="#e53399">
        <path d="M72 84Q65 62 52 66Q41 70 39 89q-1 13 19 10-14 1-9 16 5 14 23 7 10-4 10-17 0 17 17 9 18-10 15-21-2-10-20-4 20-7 13-19-6-12-20-8-17 4-12 23Z" />
      </g>
      <ellipse
        cx="78"
        cy="94"
        rx="15"
        ry="11"
        fill="#ffe980"
        strokeWidth="2.5"
      />
      <path d="M76 164q-4 1-7 17-2 7 5 10l8 4 6-7q6-4 3-7l-7-4 3-6-6-6Z" />
      <path d="m84 176-5 7 6 5" fill="none" strokeWidth="2.3" />
    </Ink>
  );
}
