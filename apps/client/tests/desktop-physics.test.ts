import assert from "node:assert/strict";
import test from "node:test";
import {
  advanceBody,
  CHARACTER_SIZE,
  createBody,
  moveBody,
  needsAnimation,
  releaseVelocity,
} from "../src/desktop-physics.ts";

const width = 1470,
  height = 923;

test("offline characters keep falling, rest after landing, and walk when online", () => {
  const body = createBody("idle", width, height);
  assert.equal(needsAnimation(body, false), false);
  assert.equal(needsAnimation(body, true), true);
  body.restTime = 1;
  assert.equal(needsAnimation(body, true), true);
  Object.assign(body, { mode: "air", x: 700, y: 400, vx: 1400, vy: 200 });
  assert.equal(needsAnimation(body, false), true);
  advanceBody(body, 1 / 60, width, height, false);
  assert.ok(body.x > 700 && body.vx > 0, "sleeping preserves flight momentum");
  for (let i = 0; i < 1200 && body.mode !== "walk"; i++)
    advanceBody(body, 1 / 60, width, height, false);
  assert.equal(body.mode, "walk");
  const landed = { ...body };
  for (let i = 0; i < 120; i++) advanceBody(body, 1 / 60, width, height, false);
  assert.deepEqual(body, landed, "sleeping characters stay put after landing");
  assert.equal(body.vx, 0);
  assert.equal(body.vy, 0);
  assert.equal(needsAnimation(body, false), false);
  assert.equal(needsAnimation(body, true), true);
  advanceBody(body, 1 / 60, width, height, true);
  assert.notDeepEqual({ x: body.x, y: body.y }, { x: landed.x, y: landed.y });
  advanceBody(body, 1 / 60, 640, 480, false);
  assert.ok(
    body.x <= 580 && body.y <= 420,
    "resizing still keeps a sleeping character on screen",
  );
  body.mode = "drag";
  body.angle = Math.PI;
  assert.equal(
    needsAnimation(body, false),
    true,
    "manual dragging can turn a sleeping character upright",
  );
  assert.equal(needsAnimation(body, true), true);
  for (let i = 0; i < 120; i++) advanceBody(body, 1 / 60, width, height, true);
  assert.equal(needsAnimation(body, true), false);
});

test("a held character settles upright and its drag lean decays without auto-walking", () => {
  for (const online of [true, false]) {
    const body = createBody("held", width, height);
    Object.assign(body, {
      mode: "drag",
      x: 600,
      y: 400,
      angle: -Math.PI / 2,
      dragTilt: 0.4,
    });
    assert.equal(needsAnimation(body, online), true);
    advanceBody(body, 1 / 60, width, height, online);
    assert.ok(body.dragTilt > 0 && body.dragTilt < 0.4);
    for (let frame = 0; frame < 120; frame++)
      advanceBody(body, 1 / 60, width, height, online);
    assert.ok(Math.abs(body.angle) < 0.001);
    assert.ok(Math.abs(body.dragTilt) < 0.001);
    assert.deepEqual({ x: body.x, y: body.y }, { x: 600, y: 400 });
    assert.equal(needsAnimation(body, online), false);
  }
});

test("fast flight turns the head toward travel in every direction", () => {
  for (const [vx, vy] of [
    [1200, 0],
    [-1200, 0],
    [0, 1200],
    [0, -1200],
  ]) {
    const body = createBody("flying", width, height);
    Object.assign(body, {
      mode: "air",
      x: width / 2,
      y: height / 2,
      vx,
      vy,
      angle: 0,
    });
    for (let frame = 0; frame < 8; frame++)
      advanceBody(body, 1 / 60, width, height, true);
    const speed = Math.hypot(body.vx, body.vy);
    const alignment =
      (Math.sin(body.angle) * body.vx - Math.cos(body.angle) * body.vy) / speed;
    assert.ok(alignment > 0.75, "the head should lead the flying body");
    assert.equal(body.mode, "air");
  }
});

test("automatic walking covers all four edges without leaving the screen", (t) => {
  t.mock.method(Math, "random", () => 0.5);
  const body = createBody("walker", width, height);
  const start = { x: body.x, y: body.y };
  for (let i = 0; i < 60; i++) advanceBody(body, 1 / 60, width, height, true);
  assert.ok(Math.hypot(body.x - start.x, body.y - start.y) > 30);
  const edges = new Set<string>();
  for (let i = 0; i < 9000; i++) {
    advanceBody(body, 1 / 60, width, height, true);
    assert.ok(body.x >= 60 && body.x <= width - 60);
    assert.ok(body.y >= CHARACTER_SIZE / 2 && body.y <= height - 60);
    if (body.x === 60) edges.add("left");
    if (body.x === width - 60) edges.add("right");
    if (body.y === CHARACTER_SIZE / 2) edges.add("top");
    if (body.y === height - 60) edges.add("bottom");
  }
  assert.equal(edges.size, 4);
});

test("walking gait stays continuous through speed changes and freezes when not walking", () => {
  const body = createBody("gait", width, height);
  body.wanderTime = Infinity;
  for (const fps of [30, 60, 120]) {
    for (const speed of [25, 65, 35, 50]) {
      body.speed = speed;
      for (let frame = 0; frame < fps * 10; frame++) {
        const previous = body.stepPhase;
        advanceBody(body, 1 / fps, width, height, true);
        const step = (body.stepPhase - previous + 1) % 1;
        assert.ok(body.stepPhase >= 0 && body.stepPhase < 1);
        assert.ok(step > 0 && step <= 1 / fps / 0.32 + 1e-9);
      }
    }
  }
  const previous = body.stepPhase;
  advanceBody(body, 0.05, width, height, false);
  assert.equal(body.stepPhase, previous, "offline freezes the gait");
  body.restTime = 1;
  advanceBody(body, 0.05, width, height, true);
  assert.equal(body.stepPhase, previous, "resting freezes the gait");
  body.restTime = 0;
  for (const mode of ["drag", "air"] as const) {
    Object.assign(body, { mode, x: 700, y: 400, vx: 0, vy: 0 });
    advanceBody(body, 0.05, width, height, true);
    assert.equal(body.stepPhase, previous, `${mode} freezes the gait`);
  }
  body.mode = "walk";
  advanceBody(body, 1 / 60, width, height, true);
  assert.ok((body.stepPhase - previous + 1) % 1 <= 1 / 60 / 0.32 + 1e-9);
  assert.notEqual(body.stepPhase, previous, "walking resumes the gait");
});

test("release speed follows the recent drag, is capped, and expires when held still", () => {
  const slow = releaseVelocity(
    [
      { x: 0, y: 0, time: 0 },
      { x: 5, y: 0, time: 100 },
    ],
    100,
  );
  const fast = releaseVelocity(
    [
      { x: 0, y: 0, time: 0 },
      { x: 150, y: -50, time: 100 },
    ],
    100,
  );
  assert.equal(slow.vx, 50);
  assert.ok(fast.vx > slow.vx * 10 && fast.vy < 0);
  const capped = releaseVelocity(
    [
      { x: 0, y: 0, time: 0 },
      { x: 5000, y: 5000, time: 1 },
    ],
    1,
  );
  assert.ok(Math.hypot(capped.vx, capped.vy) <= 2200.001);
  assert.deepEqual(
    releaseVelocity(
      [
        { x: 0, y: 0, time: 0 },
        { x: 150, y: 0, time: 100 },
        { x: 150, y: 0, time: 500 },
      ],
      500,
    ),
    { vx: 0, vy: 0 },
  );
  assert.deepEqual(releaseVelocity([], 0), { vx: 0, vy: 0 });
});

test("awake and sleeping characters fall toward each nearest edge and land", () => {
  for (const walking of [true, false])
    for (const [x, y, nx, ny] of [
      [700, 100, 0, -1],
      [1370, 450, 1, 0],
      [700, 823, 0, 1],
      [100, 450, -1, 0],
    ]) {
      const body = createBody("fall", width, height);
      Object.assign(body, { x, y, mode: "air", vx: 0, vy: 0 });
      advanceBody(body, 1 / 60, width, height, walking);
      assert.ok(body.vx * nx + body.vy * ny > 0);
      assert.equal(needsAnimation(body, walking), true);
      for (let frame = 0; frame < 600 && body.mode !== "walk"; frame++)
        advanceBody(body, 1 / 60, width, height, walking);
      assert.equal(body.mode, "walk");
      assert.ok(
        nx === 0
          ? body.y === (ny < 0 ? CHARACTER_SIZE / 2 : height - 60)
          : body.x === (nx < 0 ? 60 : width - 60),
      );
      if (!walking) {
        assert.equal(needsAnimation(body, walking), false);
        const alignment = Math.sin(body.angle) * nx - Math.cos(body.angle) * ny;
        assert.ok(alignment < -0.999, "sleeping feet face the landing edge");
      }
    }
});

test("a fast throw bounces, loses energy, lands, and resumes walking", () => {
  const body = createBody("throw", width, height);
  Object.assign(body, {
    x: width - 62,
    y: 400,
    vx: 1800,
    vy: 250,
    mode: "air",
  });
  advanceBody(body, 1 / 60, width, height, true);
  assert.ok(body.vx < 0 && Math.abs(body.vx) < 1800);
  for (let i = 0; i < 1200 && body.mode !== "walk"; i++) {
    advanceBody(body, 1 / 60, width, height, true);
    assert.ok(
      body.x >= 60 &&
        body.x <= width - 60 &&
        body.y >= CHARACTER_SIZE / 2 &&
        body.y <= height - 60,
    );
  }
  assert.equal(body.mode, "walk");
  const start = { x: body.x, y: body.y };
  for (let i = 0; i < 60; i++) advanceBody(body, 1 / 60, width, height, true);
  assert.ok(Math.hypot(body.x - start.x, body.y - start.y) > 30);
});

test("dragging and offline rest do not auto-walk; resized bounds still apply", () => {
  const body = createBody("offline", width, height);
  const position = { x: body.x, y: body.y };
  advanceBody(body, 0.05, width, height, false);
  assert.deepEqual({ x: body.x, y: body.y }, position);
  body.mode = "drag";
  moveBody(body, 600, 400, width, height);
  advanceBody(body, 0.05, width, height, true);
  assert.equal(body.x, 600);
  assert.equal(body.y, 400);
  advanceBody(body, 10, 640, 480, true);
  assert.equal(body.x, 580);
  assert.equal(body.y, 400);
});

test("dragging and landing reach the ceiling without reserving label space", () => {
  for (const walking of [true, false]) {
    const body = createBody("ceiling", width, height);
    body.mode = "drag";
    moveBody(body, width / 2, -100, width, height);
    assert.equal(body.y - CHARACTER_SIZE / 2, 0);
    body.mode = "air";
    advanceBody(body, 1 / 60, width, height, walking);
    assert.equal(body.mode, "walk");
    assert.equal(body.y - CHARACTER_SIZE / 2, 0);
    advanceBody(body, 1 / 60, width, height, walking);
    assert.equal(body.y - CHARACTER_SIZE / 2, 0);
    body.mode = "drag";
    moveBody(body, width / 2, -100, width, 40);
    assert.equal(body.y, 20, "small windows keep the character centered");
  }
});

test("random decisions change direction and speed, briefly rest, then resume", (t) => {
  t.mock.method(Math, "random", () => 0);
  const body = createBody("wander", width, height);
  body.wanderTime = 0;
  const before = {
    phase: body.phase,
    direction: body.direction,
    speed: body.speed,
  };
  advanceBody(body, 1 / 60, width, height, true);
  assert.equal(body.direction, -before.direction);
  assert.notEqual(body.speed, before.speed);
  assert.ok(body.restTime > 0 && body.restTime <= 1.6);
  assert.equal(body.phase, before.phase);
  for (let i = 0; i < 20; i++) advanceBody(body, 1 / 60, width, height, true);
  assert.equal(
    body.phase,
    before.phase,
    "resting must not slide along the edge",
  );
  for (let i = 0; i < 60; i++) advanceBody(body, 1 / 60, width, height, true);
  assert.equal(body.restTime, 0);
  assert.notEqual(body.phase, before.phase, "every rest ends automatically");
  assert.ok(body.walkSpeed > 0);
});

test("random behavior has independent timers and cannot interrupt dragging or flight", (t) => {
  let value = 0.2;
  const random = t.mock.method(Math, "random", () => value);
  const first = createBody("one", width, height);
  value = 0.8;
  const second = createBody("two", width, height);
  assert.notEqual(first.wanderTime, second.wanderTime);
  for (const mode of ["walk", "drag", "air"] as const) {
    const body = createBody(mode, width, height);
    Object.assign(body, { mode, x: 700, y: 400, wanderTime: 0, restTime: 0.7 });
    const calls = random.mock.callCount();
    advanceBody(body, 0.05, width, height, false);
    assert.equal(random.mock.callCount(), calls);
    assert.equal(body.wanderTime, 0);
    assert.equal(body.restTime, 0.7);
    assert.equal(body.mode, mode);
  }
});

test("random walks stay on the perimeter through turns, pauses, and screen changes", (t) => {
  let seed = 42;
  t.mock.method(
    Math,
    "random",
    () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32,
  );
  const body = createBody("roamer", width, height);
  const directions = new Set<number>();
  let rested = false;
  for (let frame = 0; frame < 18000; frame++) {
    const w = frame < 9000 ? width : 640;
    const h = frame < 9000 ? height : 480;
    advanceBody(body, 1 / 60, w, h, true);
    directions.add(body.direction);
    rested ||= body.restTime > 0;
    assert.ok(
      body.x >= 60 &&
        body.x <= w - 60 &&
        body.y >= CHARACTER_SIZE / 2 &&
        body.y <= h - 60,
    );
    assert.ok(
      body.x === 60 ||
        body.x === w - 60 ||
        body.y === CHARACTER_SIZE / 2 ||
        body.y === h - 60,
    );
  }
  assert.equal(directions.size, 2);
  assert.ok(rested);
});
