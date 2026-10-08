import { moveBody, type Body } from "./desktop-physics.ts";

export interface Attack {
  attacker: Body;
  target: Body;
  phase: "dash" | "impact";
  elapsed: number;
  duration: number;
  startX: number;
  startY: number;
  nx: number;
  ny: number;
}

export function createAttack(attacker: Body, target: Body): Attack | null {
  if (attacker === target || attacker.mode === "drag" || target.mode === "drag")
    return null;
  attacker.mode = "air";
  attacker.vx = attacker.vy = attacker.dragTilt = 0;
  return {
    attacker,
    target,
    phase: "dash",
    elapsed: 0,
    duration: Math.max(
      0.2,
      Math.min(
        1,
        Math.hypot(target.x - attacker.x, target.y - attacker.y) / 1400,
      ),
    ),
    startX: attacker.x,
    startY: attacker.y,
    nx: 1,
    ny: 0,
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
): "dash" | "hit" | "impact" | "done" {
  const dt = Math.max(0, Math.min(elapsed, 0.05));
  attack.elapsed += dt;
  const { attacker, target } = attack;
  if (attack.phase === "dash") {
    const dx = target.x - attack.startX,
      dy = target.y - attack.startY;
    const distance = Math.hypot(dx, dy);
    attack.nx = distance > 0 ? dx / distance : 1;
    attack.ny = distance > 0 ? dy / distance : 0;
    const progress = Math.min(1, attack.elapsed / attack.duration);
    const eased = 1 - (1 - progress) ** 2;
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
    if (progress < 1) return "dash";
    attack.phase = "impact";
    attack.elapsed = 0;
    return "hit";
  }
  if (attack.elapsed < 0.38) return "impact";
  attacker.mode = "air";
  attacker.vx = -attack.nx * 200;
  attacker.vy = -attack.ny * 200;
  if (targetOnline) {
    target.mode = "air";
    target.vx = attack.nx * 480;
    target.vy = attack.ny * 480;
  }
  return "done";
}
