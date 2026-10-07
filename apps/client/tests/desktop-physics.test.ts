import assert from "node:assert/strict";
import test from "node:test";
import {
  advanceBody,
  createBody,
  moveBody,
  releaseVelocity,
} from "../src/desktop-physics.ts";

const width = 1470,
  height = 923;

test("automatic walking covers all four edges without leaving the screen", () => {
  const body = createBody("walker", width, height);
  const start = { x: body.x, y: body.y };
  for (let i = 0; i < 60; i++) advanceBody(body, 1 / 60, width, height, true);
  assert.ok(Math.hypot(body.x - start.x, body.y - start.y) > 30);
  const edges = new Set<string>();
  for (let i = 0; i < 9000; i++) {
    advanceBody(body, 1 / 60, width, height, true);
    assert.ok(body.x >= 60 && body.x <= width - 60);
    assert.ok(body.y >= 60 && body.y <= height - 60);
    if (body.x === 60) edges.add("left");
    if (body.x === width - 60) edges.add("right");
    if (body.y === 60) edges.add("top");
    if (body.y === height - 60) edges.add("bottom");
  }
  assert.equal(edges.size, 4);
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

test("gravity pulls toward each nearest edge", () => {
  for (const [x, y, nx, ny] of [
    [700, 100, 0, -1],
    [1370, 450, 1, 0],
    [700, 823, 0, 1],
    [100, 450, -1, 0],
  ]) {
    const body = createBody("fall", width, height);
    Object.assign(body, { x, y, mode: "air", vx: 0, vy: 0 });
    advanceBody(body, 1 / 60, width, height, false);
    assert.ok(body.vx * nx + body.vy * ny > 0);
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
        body.y >= 60 &&
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
