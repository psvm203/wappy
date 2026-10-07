export const CHARACTER_SIZE = 84;
const MARGIN = 60;
const GRAVITY = 1400;

export interface Body {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  phase: number;
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

function track(width: number, height: number) {
  const left = Math.min(MARGIN, width / 2);
  const top = Math.min(MARGIN, height / 2);
  const right = Math.max(left, width - MARGIN);
  const bottom = Math.max(top, height - MARGIN);
  return { left, top, right, bottom, w: right - left, h: bottom - top };
}

function walkPose(body: Body, width: number, height: number) {
  const { left, top, right, bottom, w, h } = track(width, height);
  const distance = body.phase * 2 * (w + h);
  if (distance < w) return { x: left + distance, y: top, angle: Math.PI };
  if (distance < w + h)
    return { x: right, y: top + distance - w, angle: -Math.PI / 2 };
  if (distance < 2 * w + h)
    return { x: right - (distance - w - h), y: bottom, angle: 0 };
  return { x: left, y: bottom - (distance - 2 * w - h), angle: Math.PI / 2 };
}

export function createBody(id: string, width: number, height: number): Body {
  const seed = Array.from(id).reduce(
    (hash, letter) => (Math.imul(hash, 31) + letter.charCodeAt(0)) >>> 0,
    0,
  );
  const speed = 35 + (seed % 16);
  const body: Body = {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    angle: 0,
    phase: (seed % 100) / 100,
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

export function moveBody(
  body: Body,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const { left, top, right, bottom } = track(width, height);
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

export function needsAnimation(
  body: Body,
  width: number,
  height: number,
  walking: boolean,
) {
  if (body.mode === "air") return true;
  if (body.mode === "drag")
    return Math.abs(angleDifference(body.angle, 0)) > 0.001;
  if (walking) return true; // Resting pets still need their wake-up timer.
  const pose = walkPose(body, width, height);
  return (
    body.x !== pose.x ||
    body.y !== pose.y ||
    Math.abs(angleDifference(body.angle, pose.angle)) > 0.001
  );
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
) {
  const { left, top, right, bottom, w, h } = track(width, height);
  const perimeter = Math.max(1, 2 * (w + h));
  moveBody(body, body.x, body.y, width, height);
  for (let remaining = Math.min(elapsed, 0.05); remaining > 0;) {
    const dt = Math.min(remaining, 1 / 120);
    remaining -= dt;
    if (body.mode === "drag") {
      turn(body, 0, dt);
      continue;
    }
    if (body.mode === "walk") {
      if (walking) {
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
            body.phase =
              (((body.phase +
                (body.direction * body.walkSpeed * dt) / perimeter) %
                1) +
                1) %
              1;
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
    const edge = distances.indexOf(Math.min(...distances));
    const nx = [0, 1, 0, -1][edge],
      ny = [-1, 0, 1, 0][edge];
    body.vx = (body.vx + nx * GRAVITY * dt) * Math.exp(-0.25 * dt);
    body.vy = (body.vy + ny * GRAVITY * dt) * Math.exp(-0.25 * dt);
    body.x += body.vx * dt;
    body.y += body.vy * dt;
    turn(body, Math.atan2(ny, nx) - Math.PI / 2, dt);
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
    if (impact < 110) {
      const distance = [
        body.x - left,
        w + body.y - top,
        w + h + right - body.x,
        2 * w + h + bottom - body.y,
      ][hit];
      body.phase = distance / perimeter;
      if (Math.abs(tangent) > 10)
        body.direction = Math.sign(tangent) * (hit < 2 ? 1 : -1);
      body.walkSpeed = Math.max(body.speed, Math.abs(tangent) * 0.8);
      body.restTime = 0;
      body.wanderTime = 2 + Math.random() * 3;
      body.vx = body.vy = 0;
      body.mode = "walk";
    }
  }
}
