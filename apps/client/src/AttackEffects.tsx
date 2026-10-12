import type { Ref } from "react";
import { Shield } from "./Avengers";
import { attackVisual, type Attack } from "./desktop-attack";

/** Updated by the same animation clock as the bodies, without a React render per frame. */
export function drawAttackEffect(
  svg: SVGSVGElement | null,
  attack: Attack | null,
) {
  if (!svg) return;
  svg.dataset.kind = attack?.kind ?? "";
  svg.dataset.phase = attack?.phase ?? "";
  if (!attack || attack.kind === "dash") return;
  const { sourceX, sourceY, x, y, angle, progress } = attackVisual(
    attack,
    innerWidth,
    innerHeight,
  );
  const length = Math.hypot(x - sourceX, y - sourceY);
  let path = `M${sourceX} ${sourceY}L${x} ${y}`;
  if (attack.kind === "lightning") {
    const dx = length ? (x - sourceX) / length : 1;
    const dy = length ? (y - sourceY) / length : 0;
    path = `M${sourceX} ${sourceY}`;
    const segments = Math.max(2, Math.ceil(length / 24));
    for (let i = 1; i < segments; i++) {
      const offset = (i % 2 ? 1 : -1) * Math.min(12, length / 8);
      path += `L${sourceX + ((x - sourceX) * i) / segments - dy * offset} ${sourceY + ((y - sourceY) * i) / segments + dx * offset}`;
    }
    path += `L${x} ${y}`;
  }
  for (const line of svg.querySelectorAll(".energy-path"))
    line.setAttribute("d", path);
  svg
    .querySelector(".attack-projectile")
    ?.setAttribute("transform", `translate(${x} ${y}) rotate(${angle})`);
  svg
    .querySelector(".flying-shield")
    ?.setAttribute("transform", `rotate(${attack.elapsed * 1400})`);
  const muzzle = svg.querySelector(".attack-muzzle");
  muzzle?.setAttribute(
    "transform",
    `translate(${sourceX} ${sourceY}) rotate(${angle})`,
  );
  muzzle?.setAttribute(
    "opacity",
    String(
      attack.kind === "bullet"
        ? attack.phase === "dash"
          ? 1 - progress
          : 0
        : 0.85,
    ),
  );
  const impact = Math.min(1, attack.elapsed / 0.38);
  const shockwave = svg.querySelector(".smash-effect");
  shockwave?.setAttribute(
    "transform",
    `translate(${attack.impactX} ${attack.impactY}) scale(${0.6 + impact * 1.8})`,
  );
  shockwave?.setAttribute("opacity", String(1 - impact));
}

export function AttackEffects({
  effectRef,
}: {
  effectRef: Ref<SVGSVGElement>;
}) {
  return (
    <svg
      ref={effectRef}
      className="desktop-attack-effect"
      aria-hidden="true"
      width="100%"
      height="100%"
    >
      <g className="repulsor-effect" fill="none" strokeLinecap="round">
        <path
          className="energy-path"
          stroke="#65d9f2"
          strokeWidth="14"
          opacity=".25"
        />
        <path className="energy-path" stroke="#88e8ff" strokeWidth="7" />
        <path className="energy-path" stroke="#f2ffff" strokeWidth="3" />
      </g>
      <g
        className="lightning-effect"
        fill="none"
        strokeLinejoin="round"
        strokeLinecap="round"
      >
        <path
          className="energy-path"
          stroke="#8599ff"
          strokeWidth="13"
          opacity=".25"
        />
        <path className="energy-path" stroke="#95d6ff" strokeWidth="6" />
        <path className="energy-path" stroke="#f5fcff" strokeWidth="2.5" />
      </g>
      <g className="attack-muzzle">
        <circle className="energy-muzzle" r="10" fill="#b6f1ff" opacity=".55" />
        <circle className="energy-muzzle" r="4" fill="#fff" />
        <path
          className="bullet-muzzle"
          d="m-3-3 9-5-2 5 11 3L4 3l2 5-9-5Z"
          fill="#fff0ac"
          stroke="#e6b45f"
        />
      </g>
      <g className="attack-projectile">
        <g className="shield-effect">
          <g className="flying-shield">
            <Shield />
          </g>
        </g>
        <g className="bullet-effect">
          <path
            d="M-23 0H0"
            stroke="#f8d679"
            strokeWidth="3"
            strokeLinecap="round"
            opacity=".65"
          />
          <path
            d="M-6-2H1l4 2-4 2h-7Z"
            fill="#ffefa9"
            stroke="#b78240"
            strokeWidth="1"
          />
        </g>
        <g
          className="arrow-effect"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M-35 0H0" stroke="#bcc6d4" strokeWidth="2.5" />
          <path
            d="m-37-5 8 5-8 5m6-10 8 5-8 5"
            fill="none"
            stroke="#9d73b4"
            strokeWidth="2"
          />
          <path
            d="m-4-4 10 4-10 4Z"
            fill="#dce4ed"
            stroke="#50596a"
            strokeWidth="1.3"
          />
        </g>
      </g>
      <g
        className="smash-effect"
        fill="none"
        stroke="#88aa61"
        strokeWidth="2.5"
      >
        <ellipse rx="28" ry="12" />
        <ellipse rx="39" ry="18" opacity=".5" />
        <path d="m-17-4-8-10-6 2-7-9m52 16 10-12 7 2 7-9M-8 7l-5 13-9 4m33-18 7 15 11 3" />
        <path
          d="m-36 1-4-4-3 5 5 2m75-10 3-5 4 3-2 5"
          fill="#b6c794"
          strokeWidth="1"
        />
      </g>
    </svg>
  );
}
