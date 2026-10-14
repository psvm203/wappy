import {
  CHARACTER_SIZES,
  type CharacterActivity,
  type CharacterPosition,
} from "./preferences.ts";

export const CHARACTER_SIZE = CHARACTER_SIZES.normal.pixels;
const GRAVITY = 1400;

export interface Body {
  position: CharacterPosition;
  size: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  dragTilt: number;
  phase: number;
  stepPhase: number;
  direction: number;
  speed: number;
  walkSpeed: number;
  wanderTime: number;
  restTime: number;
  mode: "walk" | "air" | "drag";
}

export interface DragSample {
  x: number;
  y: number;
  time: number;
}

function track(width: number, height: number, size: number) {
  const margin = size / 2;
  const left = Math.min(margin, width / 2);
  // The label moves inward at the ceiling, so only the character needs clearance.
  const top = Math.min(margin, height / 2);
  const right = Math.max(left, width - margin);
  const bottom = Math.max(top, height - margin);
  return { left, top, right, bottom, w: right - left, h: bottom - top };
}

function walkPose(body: Body, width: number, height: number) {
  const { left, top, right, bottom, w, h } = track(width, height, body.size);
  switch (body.position) {
    case "top":
      return { x: left + body.phase * w, y: top, angle: Math.PI };
    case "right":
      return { x: right, y: top + body.phase * h, angle: -Math.PI / 2 };
    case "bottom":
      return { x: right - body.phase * w, y: bottom, angle: 0 };
    case "left":
      return { x: left, y: bottom - body.phase * h, angle: Math.PI / 2 };
  }
  const distance = body.phase * 2 * (w + h);
  if (distance < w) return { x: left + distance, y: top, angle: Math.PI };
  if (distance < w + h)
    return { x: right, y: top + distance - w, angle: -Math.PI / 2 };
  if (distance < 2 * w + h)
    return { x: right - (distance - w - h), y: bottom, angle: 0 };
  return { x: left, y: bottom - (distance - 2 * w - h), angle: Math.PI / 2 };
}

export function createBody(
  id: string,
  width: number,
  height: number,
  position: CharacterPosition = "free",
  size: number = CHARACTER_SIZE,
): Body {
  const seed = Array.from(id).reduce(
    (hash, letter) => (Math.imul(hash, 31) + letter.charCodeAt(0)) >>> 0,
    0,
  );
  const speed = 35 + (seed % 16);
  const body: Body = {
    position,
    size,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    angle: 0,
    dragTilt: 0,
    phase: (seed % 100) / 100,
    stepPhase: 0,
    direction: seed % 2 === 0 ? 1 : -1,
    speed,
    walkSpeed: speed,
    wanderTime: 1 + Math.random() * 3,
    restTime: 0,
    mode: "walk",
  };
  Object.assign(body, walkPose(body, width, height));
  return body;
}

export function setBodyPosition(
  body: Body,
  position: CharacterPosition,
  width: number,
  height: number,
) {
  const { left, top, right, bottom, w, h } = track(width, height, body.size);
  moveBody(body, body.x, body.y, width, height);
  const distances = [
    body.y - top,
    right - body.x,
    bottom - body.y,
    body.x - left,
  ];
  const edge =
    position === "free"
      ? distances.indexOf(Math.min(...distances))
      : ["top", "right", "bottom", "left"].indexOf(position);
  const offset = [body.x - left, body.y - top, right - body.x, bottom - body.y][
    edge
  ];
  body.position = position;
  body.phase =
    position === "free"
      ? ([0, w, w + h, 2 * w + h][edge] + offset) / Math.max(1, 2 * (w + h))
      : offset / Math.max(1, edge % 2 === 0 ? w : h);
  body.mode = "walk";
  body.vx = body.vy = body.dragTilt = 0;
  Object.assign(body, walkPose(body, width, height));
}

export function moveBody(
  body: Body,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const { left, top, right, bottom } = track(width, height, body.size);
  body.x = Math.max(left, Math.min(right, x));
  body.y = Math.max(top, Math.min(bottom, y));
}

export function releaseVelocity(samples: DragSample[], now: number) {
  const recent = samples.filter((sample) => now - sample.time <= 100);
  if (recent.length < 2) return { vx: 0, vy: 0 };
  const first = recent[0],
    last = recent[recent.length - 1];
  const seconds = (last.time - first.time) / 1000;
  if (seconds <= 0) return { vx: 0, vy: 0 };
  const vx = (last.x - first.x) / seconds;
  const vy = (last.y - first.y) / seconds;
  const scale = Math.min(1, 2200 / Math.hypot(vx, vy));
  return { vx: vx * scale, vy: vy * scale };
}

function angleDifference(angle: number, target: number) {
  return Math.atan2(Math.sin(target - angle), Math.cos(target - angle));
}

export function needsAnimation(body: Body, walking: boolean) {
  if (body.mode === "drag")
    return (
      Math.abs(angleDifference(body.angle, 0)) > 0.001 ||
      Math.abs(body.dragTilt) > 0.001
    );
  // Gravity continues during sleep; only automatic walking and wandering stop.
  return body.mode === "air" || walking;
}

function turn(body: Body, target: number, dt: number) {
  const difference = angleDifference(body.angle, target);
  body.angle += difference * Math.min(1, dt * 14);
}

// Seconds-based integration runs in small steps so fast throws cannot cross a wall.
export function advanceBody(
  body: Body,
  elapsed: number,
  width: number,
  height: number,
  walking: boolean,
  activity: CharacterActivity = "normal",
) {
  const { left, top, right, bottom, w, h } = track(width, height, body.size);
  const perimeter = Math.max(1, 2 * (w + h));
  const fixedEdge = ["top", "right", "bottom", "left"].indexOf(body.position);
  const walkLength =
    fixedEdge < 0 ? perimeter : Math.max(1, fixedEdge % 2 === 0 ? w : h);
  moveBody(body, body.x, body.y, width, height);
  if (fixedEdge >= 0 && body.mode === "walk")
    Object.assign(body, walkPose(body, width, height));
  if (!walking && body.mode === "walk") {
    body.vx = body.vy = 0;
    return;
  }
  for (let remaining = Math.min(elapsed, 0.05); remaining > 0;) {
    const dt = Math.min(remaining, 1 / 120);
    remaining -= dt;
    if (body.mode === "drag") {
      turn(body, 0, dt);
      body.dragTilt *= Math.exp(-8 * dt);
      continue;
    }
    if (body.mode === "walk") {
      if (walking && activity === "in-place") {
        body.restTime = 0;
        body.stepPhase = (body.stepPhase + dt / 0.65) % 1;
      } else if (walking) {
        if (body.restTime > 0) {
          body.restTime = Math.max(0, body.restTime - dt);
        } else {
          body.wanderTime -= dt;
          if (body.wanderTime <= 0) {
            // Each pet chooses independently; polling and dragging do not reset its clock.
            body.wanderTime = 3 + Math.random() * 5;
            body.speed = 25 + Math.random() * 40;
            if (Math.random() < 0.45) body.direction *= -1;
            if (Math.random() < 0.2) {
              body.restTime = 0.5 + Math.random() * 1.1;
              body.walkSpeed = 0;
            }
          }
          if (body.restTime === 0) {
            body.walkSpeed +=
              (body.speed - body.walkSpeed) * Math.min(1, dt * 3);
            const walkSpeed =
              body.walkSpeed * (activity === "active" ? 1 : 0.5);
            // Accumulate the gait so speed changes never retime earlier steps.
            const stepDuration = Math.max(
              0.32,
              Math.min(0.85, 28 / Math.max(1, walkSpeed)),
            );
            body.stepPhase = (body.stepPhase + dt / stepDuration) % 1;
            const phase =
              body.phase + (body.direction * walkSpeed * dt) / walkLength;
            if (fixedEdge < 0) body.phase = ((phase % 1) + 1) % 1;
            else {
              if (phase < 0 || phase > 1) body.direction *= -1;
              body.phase = Math.max(0, Math.min(1, phase));
            }
          }
        }
      }
      const pose = walkPose(body, width, height);
      body.x = pose.x;
      body.y = pose.y;
      turn(body, pose.angle, dt);
      continue;
    }
    const distances = [
      body.y - top,
      right - body.x,
      bottom - body.y,
      body.x - left,
    ];
    const edge =
      fixedEdge < 0 ? distances.indexOf(Math.min(...distances)) : fixedEdge;
    const nx = [0, 1, 0, -1][edge],
      ny = [-1, 0, 1, 0][edge];
    body.vx = (body.vx + nx * GRAVITY * dt) * Math.exp(-0.25 * dt);
    body.vy = (body.vy + ny * GRAVITY * dt) * Math.exp(-0.25 * dt);
    body.x += body.vx * dt;
    body.y += body.vy * dt;
    const flying = Math.hypot(body.vx, body.vy) > 180;
    turn(
      body,
      flying
        ? Math.atan2(body.vy, body.vx) + Math.PI / 2
        : Math.atan2(ny, nx) - Math.PI / 2,
      dt,
    );
    const hit =
      body.y < top
        ? 0
        : body.x > right
          ? 1
          : body.y > bottom
            ? 2
            : body.x < left
              ? 3
              : -1;
    if (hit < 0) continue;
    moveBody(body, body.x, body.y, width, height);
    const vertical = hit === 0 || hit === 2;
    const impact = Math.abs(vertical ? body.vy : body.vx);
    const tangent = vertical ? body.vx : body.vy;
    if (vertical) {
      body.vy *= -0.42;
      body.vx *= 0.8;
    } else {
      body.vx *= -0.42;
      body.vy *= 0.8;
    }
    if (impact < 110 && (fixedEdge < 0 || hit === fixedEdge)) {
      const distance = [
        body.x - left,
        w + body.y - top,
        w + h + right - body.x,
        2 * w + h + bottom - body.y,
      ][hit];
      body.phase =
        fixedEdge < 0
          ? distance / perimeter
          : [body.x - left, body.y - top, right - body.x, bottom - body.y][
              hit
            ] / walkLength;
      if (Math.abs(tangent) > 10)
        body.direction = Math.sign(tangent) * (hit < 2 ? 1 : -1);
      body.walkSpeed = Math.max(body.speed, Math.abs(tangent) * 0.8);
      body.restTime = 0;
      body.wanderTime = 2 + Math.random() * 3;
      body.vx = body.vy = 0;
      body.mode = "walk";
      if (!walking) body.angle = walkPose(body, width, height).angle;
    }
  }
}
