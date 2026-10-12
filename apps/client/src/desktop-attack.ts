import type { Character } from "@wappy/api";
import { CHARACTER_SIZE, moveBody, type Body } from "./desktop-physics.ts";

export type AttackKind =
  "dash" | "repulsor" | "shield" | "lightning" | "smash" | "bullet" | "arrow";

const heroAttacks: Partial<Record<Character, AttackKind>> = {
  ironman: "repulsor",
  "captain-america": "shield",
  thor: "lightning",
  hulk: "smash",
  "black-widow": "bullet",
  hawkeye: "arrow",
};

export interface Attack {
  attacker: Body;
  target: Body;
  kind: AttackKind;
  phase: "dash" | "impact" | "return";
  elapsed: number;
  duration: number;
  startX: number;
  startY: number;
  nx: number;
  ny: number;
  impactX: number;
  impactY: number;
  jumpAngle: number;
}

export function createAttack(
  attacker: Body,
  target: Body,
  character: Character = "chiikawa",
): Attack | null {
  if (attacker === target || attacker.mode === "drag" || target.mode === "drag")
    return null;
  attacker.mode = "air";
  attacker.vx = attacker.vy = attacker.dragTilt = 0;
  const kind = heroAttacks[character] ?? "dash";
  const distance = Math.hypot(target.x - attacker.x, target.y - attacker.y);
  const attack: Attack = {
    attacker,
    target,
    kind,
    phase: "dash",
    elapsed: 0,
    duration:
      kind === "smash"
        ? Math.max(0.65, Math.min(0.95, distance / 1000))
        : kind === "dash"
          ? Math.max(0.2, Math.min(1, distance / 1400))
          : Math.max(0.24, Math.min(0.65, distance / 1600)),
    startX: attacker.x,
    startY: attacker.y,
    nx: 1,
    ny: 0,
    impactX: target.x,
    impactY: target.y,
    jumpAngle: target.mode === "walk" ? target.angle : 0,
  };
  if (kind !== "dash") aimHero(attack);
  return attack;
}

function aimHero({ attacker, target, kind, jumpAngle }: Attack) {
  const dx = target.x - attacker.x;
  attacker.direction = dx < 0 ? 1 : -1;
  attacker.angle =
    kind === "smash"
      ? jumpAngle
      : Math.atan2(target.y - attacker.y, dx) - (dx < 0 ? Math.PI : 0);
}

/** Weapon tips in Avengers.tsx share (94, 55) in the character's SVG viewBox. */
export function attackVisual(attack: Attack, width: number, height: number) {
  const { attacker, target, kind, phase } = attack;
  const reach = (44 * CHARACTER_SIZE) / 110;
  const sourceX =
    attacker.x - attacker.direction * Math.cos(attacker.angle) * reach;
  const sourceY =
    attacker.y - attacker.direction * Math.sin(attacker.angle) * reach;
  const returning = phase === "return";
  const progress = Math.min(
    1,
    attack.elapsed / (returning ? 0.55 : attack.duration),
  );
  const startX = returning ? attack.impactX : sourceX;
  const startY = returning ? attack.impactY : sourceY;
  const endX = returning ? sourceX : target.x;
  const endY = returning ? sourceY : target.y;
  const dx = endX - startX,
    dy = endY - startY;
  const distance = Math.hypot(dx, dy);
  const travel = phase === "impact" ? 1 : progress;
  // Curve toward the screen interior on both legs so a shield thrown along an
  // edge stays visible. The shorter return arc makes the round trip a loop.
  const inward =
    Math.sign(dx * (height - startY - endY) - dy * (width - startX - endX)) ||
    1;
  const arc =
    kind === "shield"
      ? Math.sin(travel * Math.PI) *
        Math.min(returning ? 50 : 90, distance * 0.16, width / 4, height / 4) *
        inward
      : 0;
  return {
    sourceX,
    sourceY,
    x: startX + dx * travel - (distance ? dy / distance : 0) * arc,
    y: startY + dy * travel + (distance ? dx / distance : 0) * arc,
    angle: (Math.atan2(dy, dx) * 180) / Math.PI,
    progress,
  };
}

export function cancelAttack(attack: Attack) {
  if (attack.attacker.mode !== "drag") {
    attack.attacker.mode = "air";
    attack.attacker.vx = attack.attacker.vy = 0;
  }
}

export function advanceAttack(
  attack: Attack,
  elapsed: number,
  width: number,
  height: number,
  targetOnline: boolean,
): "dash" | "hit" | "impact" | "return" | "done" {
  const dt = Math.max(0, Math.min(elapsed, 0.05));
  attack.elapsed += dt;
  const { attacker, target } = attack;
  if (attack.kind !== "dash") {
    // A resized viewport may clamp the firing position while a projectile is out.
    moveBody(attacker, attacker.x, attacker.y, width, height);
    aimHero(attack);
  }
  if (attack.phase === "return") {
    if (attack.elapsed < 0.55) return "return";
    attacker.mode = "air";
    attacker.vx = attacker.vy = 0;
    return "done";
  }
  if (attack.phase === "dash") {
    const dx = target.x - attack.startX,
      dy = target.y - attack.startY;
    const distance = Math.hypot(dx, dy);
    attack.nx = distance > 0 ? dx / distance : 1;
    attack.ny = distance > 0 ? dy / distance : 0;
    const progress = Math.min(1, attack.elapsed / attack.duration);
    const eased = 1 - (1 - progress) ** 2;
    if (attack.kind === "smash") {
      const jump =
        4 * progress * (1 - progress) * Math.min(240, 110 + distance * 0.18);
      const upX = Math.sin(attack.jumpAngle),
        upY = -Math.cos(attack.jumpAngle);
      moveBody(
        attacker,
        attack.startX +
          (target.x + upX * 38 - attack.startX) * progress +
          upX * jump,
        attack.startY +
          (target.y + upY * 38 - attack.startY) * progress +
          upY * jump,
        width,
        height,
      );
    } else if (attack.kind === "dash") {
      moveBody(
        attacker,
        attack.startX + (target.x - attack.nx * 48 - attack.startX) * eased,
        attack.startY + (target.y - attack.ny * 48 - attack.startY) * eased,
        width,
        height,
      );
      const heading = Math.atan2(attack.ny, attack.nx) + Math.PI / 2;
      const turn = Math.atan2(
        Math.sin(heading - attacker.angle),
        Math.cos(heading - attacker.angle),
      );
      attacker.angle += turn * Math.min(1, dt * 20);
    }
    if (progress < 1) return "dash";
    attack.phase = "impact";
    attack.elapsed = 0;
    attack.impactX = target.x;
    attack.impactY = target.y;
    if (attack.kind === "smash") {
      attack.nx = -Math.sin(attack.jumpAngle);
      attack.ny = Math.cos(attack.jumpAngle);
    }
    return "hit";
  }
  if (attack.elapsed < (attack.kind === "shield" ? 0.18 : 0.38))
    return "impact";
  attacker.mode = "air";
  const recoil = attack.kind === "dash" || attack.kind === "smash" ? 200 : 0;
  attacker.vx = -attack.nx * recoil;
  attacker.vy = -attack.ny * recoil;
  if (targetOnline) {
    target.mode = "air";
    target.vx = attack.nx * 480;
    target.vy = attack.ny * 480;
  }
  if (attack.kind === "shield") {
    attack.phase = "return";
    attack.elapsed = 0;
    return "return";
  }
  return "done";
}
