import type { ReactNode } from "react";

function Ink({ children }: { children: ReactNode }) {
  return (
    <g
      stroke="#292b38"
      strokeWidth="2.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </g>
  );
}

function Eyes({ asleep }: { asleep: boolean }) {
  return asleep ? (
    <path d="M36 40q4 4 8 0m12 0q4 4 8 0" fill="none" />
  ) : (
    <g fill="#292b38" stroke="none">
      <ellipse cx="40" cy="40" rx="3" ry="4" />
      <ellipse cx="60" cy="40" rx="3" ry="4" />
      <circle cx="41" cy="39" r="1" fill="white" />
      <circle cx="61" cy="39" r="1" fill="white" />
    </g>
  );
}

export function Shield() {
  return (
    <g stroke="#292b38" strokeWidth="1.8">
      <circle r="18" fill="#d34b4f" />
      <circle r="13.5" fill="#f2f2e9" stroke="none" />
      <circle r="10" fill="#d34b4f" stroke="none" />
      <circle r="6.8" fill="#345c93" stroke="none" />
      <path
        d="m0-6 1.8 4 4.5.4-3.4 2.9 1 4.3L0 3.3l-3.9 2.3 1-4.3-3.4-2.9 4.5-.4Z"
        fill="white"
        stroke="none"
      />
      <path d="M-12-9q6-8 15-6" fill="none" stroke="white" opacity=".6" />
    </g>
  );
}

export function IronMan({ asleep }: { asleep: boolean }) {
  return (
    <Ink>
      <g fill="#b6383e">
        <path d="m33 77-3 18q7 7 15 1l5-16 5 16q8 6 15-1l-3-18" />
        <path d="M29 59q21-9 42 0l-5 25H34Z" />
        <path d="m29 61-9 10 2 14 10-2 6-19" />
        <path className="hero-rest-pose" d="m71 61 9 10-2 14-10-2-6-19" />
      </g>
      <path
        d="m32 65 8 5-3 12m31-17-8 5 3 12M34 90h10m12 0h10"
        fill="none"
        stroke="#efc365"
        strokeWidth="4"
      />
      <circle
        cx="50"
        cy="68"
        r="6.5"
        fill="#b7f4ff"
        stroke="#f7f7de"
        strokeWidth="2.5"
      />
      <path d="M26 24Q28 10 50 10t24 14v21Q71 59 50 60T26 45Z" fill="#b6383e" />
      <path d="m33 19 10 4h14l10-4 1 22-8 11H40L32 41Z" fill="#ebc269" />
      {asleep ? (
        <path d="m35 36 10 2m10 0 10-2" stroke="#647b84" />
      ) : (
        <path
          d="m35 33 11 3-1 5-10-2Zm30 0-11 3 1 5 10-2Z"
          fill="#c4faff"
          stroke="#f1ffff"
          strokeWidth="1"
        />
      )}
      <path d="M43 47h14m-10-5h6" fill="none" strokeWidth="1.7" />
      <g className="hero-attack-pose" visibility="hidden">
        <path d="m67 59 15-9 9 2v12H78l-9 6" fill="#b6383e" />
        <path d="m77 54 4 10" stroke="#efc365" strokeWidth="4" />
        <ellipse cx="91" cy="55" rx="5" ry="8" fill="#b6383e" />
        <ellipse
          cx="94"
          cy="55"
          rx="2.8"
          ry="4.5"
          fill="#e7ffff"
          stroke="#79dfed"
          strokeWidth="1.5"
        />
      </g>
    </Ink>
  );
}

export function CaptainAmerica({ asleep }: { asleep: boolean }) {
  return (
    <Ink>
      <path d="m35 78-3 15 12 2 6-15 6 15 12-2-3-15" fill="#345c93" />
      <path d="m32 90-4 7q7 5 16 1v-8m12 0v8q9 4 16-1l-4-7" fill="#9e3c3f" />
      <path d="M30 60q20-9 40 0l-5 25H35Z" fill="#345c93" />
      <path d="M35 73h30v10H35Z" fill="#f4f1e8" />
      <path d="M40 74v8m10-8v8m10-8v8" stroke="#c94b50" strokeWidth="5" />
      <path
        d="m50 59 2 5 5 .5-4 3.5 1 5-4-2.7-4 2.7 1-5-4-3.5 5-.5Z"
        fill="white"
        stroke="none"
      />
      <path d="m30 60-9 16 8 6 10-18" fill="#345c93" />
      <path d="m22 73-3 9 9 4 5-10" fill="#9e3c3f" />
      <path d="M26 30q0-18 24-18t24 18v14Q70 60 50 60T26 44Z" fill="#efc39b" />
      <path d="M26 36V29q0-18 24-18t24 18v7l-8-5-9 4H43l-9-4Z" fill="#345c93" />
      <path
        d="m45 28 5-11 5 11m-8-4h6"
        stroke="#fff"
        fill="none"
        strokeWidth="2.4"
      />
      <path d="m26 28-8-5 3 10 5 2m48-7 8-5-3 10-5 2" fill="#f4f1e8" />
      <Eyes asleep={asleep} />
      <path d="M45 50q5 4 10 0" fill="none" />
      <g className="hero-rest-pose" transform="translate(76 76)">
        <Shield />
      </g>
      <g className="hero-attack-pose" visibility="hidden">
        <path d="m68 60 12-7 10 1v10l-19 4" fill="#345c93" />
        <path d="m82 52 12-1 3 5-3 7H82Z" fill="#9e3c3f" />
      </g>
    </Ink>
  );
}

export function Thor({ asleep }: { asleep: boolean }) {
  return (
    <Ink>
      <path d="M28 54 19 96q31-7 62 0L72 54" fill="#b9404b" />
      <path d="m35 77-2 18h12l5-15 5 15h12l-2-18" fill="#38465c" />
      <path d="M32 89h13v9H30Zm23 0h13l2 9H55Z" fill="#a9b6c5" />
      <path d="M29 57h42l-5 28H34Z" fill="#435267" />
      <g fill="#c8d9e3">
        <circle cx="38" cy="62" r="4" />
        <circle cx="62" cy="62" r="4" />
        <circle cx="40" cy="75" r="3.5" />
        <circle cx="60" cy="75" r="3.5" />
      </g>
      <path d="m29 60-7 9 2 13 9-1 3-17" fill="#efc39b" />
      <path d="M25 30q-1-20 25-20t25 20l3 36-16-7H38l-16 7Z" fill="#edc561" />
      <path d="M29 31q21-13 42 0v12Q66 59 50 59T29 43Z" fill="#efc39b" />
      <path d="M29 30q1-15 21-16 19 1 21 16l-12-6-9-6-9 6Z" fill="#f5d784" />
      <Eyes asleep={asleep} />
      <path d="m39 48 6 3h10l6-3-3 9H42Z" fill="#bd9345" strokeWidth="1.4" />
      <g className="hero-rest-pose">
        <path d="m70 60 7 12-7 6-7-13" fill="#efc39b" />
        <path d="m78 67 3 23" stroke="#795344" strokeWidth="6" />
        <path d="m66 59 23-3 3 15-24 3Z" fill="#b9ced9" />
        <path d="m70 62 15-2" stroke="#f3fbff" />
      </g>
      <g className="hero-attack-pose" visibility="hidden">
        <path d="m68 59 12-4 9 5-7 9-13-1" fill="#efc39b" />
        <path d="M85 52v24" stroke="#795344" strokeWidth="6" />
        <path d="M75 44h20l3 3v15H75Z" fill="#b9ced9" />
        <path d="M79 48h14m-14 3h8" stroke="#f3fbff" />
        <path
          d="M83 76q-6 12 5 10"
          fill="none"
          stroke="#795344"
          strokeWidth="1.5"
        />
      </g>
    </Ink>
  );
}

export function Hulk({ asleep }: { asleep: boolean }) {
  return (
    <Ink>
      <path d="m30 79-4 16q9 7 19 2l5-15 5 15q10 5 19-2l-4-16" fill="#78b857" />
      <path d="M25 68h50l-3 18-10-2-5 4-7-10-7 10-5-4-10 2Z" fill="#806398" />
      <path d="M22 49q28-15 56 0l-5 24H27Z" fill="#78b857" />
      <path d="m36 58 8 5h12l8-5m-14 5v9" fill="none" stroke="#4a823c" />
      <g className="hero-rest-pose" fill="#78b857">
        <path d="M25 49Q10 49 9 66L7 80q7 8 17 2l7-22" />
        <path d="M75 49q15 0 16 17l2 14q-7 8-17 2l-7-22" />
        <path d="M11 73v6m5-7v8m73-7v6m-5-7v8" stroke="#4a823c" />
      </g>
      <path d="M27 24q2-15 23-15t23 15v20Q69 58 50 58T27 44Z" fill="#88c568" />
      <path
        d="M27 29 24 18l7-9 9 2 8-5 8 5 10-2 9 9-2 11-10-10-7 4-7-5-8 5-6-3Z"
        fill="#354137"
      />
      <Eyes asleep={asleep} />
      <path d="m34 32 11 3m10 0 11-3" strokeWidth="3.2" />
      <path d="M40 48q10-6 20 0l-2 5H42Z" fill="#fffbea" strokeWidth="1.6" />
      <g className="hero-attack-pose" visibility="hidden" fill="#78b857">
        <g className="hulk-raised-fists">
          <path d="M28 54 12 43 6 20q5-9 17-4l5 22 10 8" />
          <path d="m72 54 16-11 6-23q-5-9-17-4l-5 22-10 8" />
          <path d="M12 19v7m6-8v7m64-7v7m6-6v7" stroke="#4a823c" />
        </g>
        <g className="hulk-slam-fists" visibility="hidden">
          <path d="M27 50 17 70l4 23q8 8 20-1L38 67m35-17 10 20-4 23q-8 8-20-1l3-25" />
          <path d="M27 84v8m7-8v8m32-8v8m7-8v8" stroke="#4a823c" />
        </g>
      </g>
    </Ink>
  );
}

export function BlackWidow({ asleep }: { asleep: boolean }) {
  return (
    <Ink>
      <path d="m35 77-3 20h12l6-18 6 18h12l-3-20" fill="#333c4c" />
      <path d="M29 58q21-9 42 0l-8 18 4 9H33l4-9Z" fill="#333c4c" />
      <path
        d="M50 59v19m-14 8h9m10 0h9"
        stroke="#697786"
        fill="none"
        strokeWidth="1.5"
      />
      <path d="M34 77h32v5H34Z" fill="#656773" />
      <path d="m46 75 4 4-4 5h8l-4-5 4-4Z" fill="#ea6664" stroke="none" />
      <path d="m29 60-8 16 9 6 9-19" fill="#333c4c" />
      <path d="m24 73 7 4" stroke="#d8ae5e" strokeWidth="5" />
      <path d="M24 30Q23 8 50 9q29 0 27 26l3 27-17 3H27l-7-6Z" fill="#9e483e" />
      <path d="M29 30q21-12 42 0v13Q67 59 50 59T29 43Z" fill="#f2c4a9" />
      <path
        d="M26 39q-4-26 24-26 23 0 25 23-14-4-20-15-9 13-29 18Z"
        fill="#b55646"
      />
      <Eyes asleep={asleep} />
      <path d="M46 50q4 3 8 0" fill="none" stroke="#9e483e" />
      <g className="hero-rest-pose">
        <path d="m69 60 8 14-8 5-7-15" fill="#333c4c" />
        <path d="m75 76 10 3-4 8-3 9-5-1 1-10-3-2Z" fill="#596170" />
      </g>
      <g className="hero-attack-pose" visibility="hidden">
        <path d="m66 59 14-3 5 7-16 6" fill="#333c4c" />
        <path d="M78 57v8" stroke="#d8ae5e" strokeWidth="4" />
        <path d="m82 56 7-1 1 9-8 1" fill="#f2c4a9" />
        <path d="M84 51h13v7h-8v8h-5Z" fill="#596170" />
        <path d="M87 53h10" stroke="#bbc7d5" strokeWidth="1.2" />
      </g>
    </Ink>
  );
}

export function Hawkeye({ asleep }: { asleep: boolean }) {
  return (
    <Ink>
      <path d="m27 65-7-28 10-3 10 30" fill="#424151" />
      <path d="m23 39-4-18m10 17-1-19m-9 6-5-3m14 1 5-4" stroke="#a8b1c1" />
      <path d="m35 77-3 20h12l6-18 6 18h12l-3-20" fill="#333b4d" />
      <path d="M29 57h42l-6 27H35Z" fill="#4b385c" />
      <path d="m34 60 16 12 16-12-5 19H39Z" fill="#956aa3" stroke="none" />
      <path d="m38 57 21 26" stroke="#343646" strokeWidth="4" />
      <path d="M34 80h32" stroke="#b6a1be" strokeWidth="3" />
      <path d="M27 29Q27 11 50 11t23 18v15Q68 59 50 59T27 44Z" fill="#efc39b" />
      <path
        d="M27 31 24 20l9-10 12 2 9-5 17 10 3 15-12-9-13 3-9-5Z"
        fill="#83613f"
      />
      {asleep ? (
        <Eyes asleep />
      ) : (
        <g>
          <path d="m30 35 16 1-2 10H32Zm24 1 16-1-2 11H56Z" fill="#665075" />
          <path
            d="M46 38h8m-19 1 6 1m18 0 6-1"
            stroke="#c9a8d8"
            strokeWidth="1.5"
          />
        </g>
      )}
      <path d="M45 51h10" fill="none" />
      <g className="hero-rest-pose">
        <path d="m29 60-6 18 9 2 6-16m32-4 7 14-8 5-7-15" fill="#efc39b" />
        <path
          d="M79 48q19 25 0 48"
          fill="none"
          stroke="#635072"
          strokeWidth="3.5"
        />
        <path d="M79 48v48" fill="none" stroke="#bcc6d3" strokeWidth="1.2" />
      </g>
      <g className="hero-attack-pose" visibility="hidden">
        <path d="m67 60 16-5 4 7-18 6M32 60l12 8 16-12" fill="#efc39b" />
        <path d="m77 56 3 8m-34-4 5 6" stroke="#4b385c" strokeWidth="5" />
        <path
          d="M85 32q21 23 0 46"
          fill="none"
          stroke="#635072"
          strokeWidth="3.5"
        />
        <path
          className="hawkeye-bowstring"
          d="m85 32-26 23 26 23"
          fill="none"
          stroke="#d4d9e0"
          strokeWidth="1.3"
        />
      </g>
    </Ink>
  );
}
