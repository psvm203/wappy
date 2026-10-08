import assert from "node:assert/strict";
import test from "node:test";
import {
  advanceAttack,
  cancelAttack,
  createAttack,
} from "../src/desktop-attack.ts";
import { advanceBody, createBody, moveBody } from "../src/desktop-physics.ts";

const width = 1200,
  height = 800;

test("a dash follows a moving target, hits once, then both characters return to walking", () => {
  const attacker = createBody("self", width, height);
  const target = createBody("friend", width, height);
  moveBody(attacker, 120, 400, width, height);
  moveBody(target, 900, 400, width, height);
  const attack = createAttack(attacker, target)!;
  let hits = 0,
    done = false;
  for (let frame = 0; frame < 180; frame++) {
    if (attack.phase === "dash")
      moveBody(target, target.x, target.y + 2, width, height);
    const step = advanceAttack(attack, 1 / 60, width, height, true);
    assert.ok(attacker.x >= 60 && attacker.x <= width - 60);
    assert.ok(attacker.y >= 60 && attacker.y <= height - 60);
    if (step === "hit") {
      hits++;
      assert.ok(Math.hypot(attacker.x - target.x, attacker.y - target.y) <= 49);
    }
    if (step === "done") {
      done = true;
      break;
    }
  }
  assert.equal(hits, 1);
  assert.ok(done, "the attack must finish within a bounded time");
  assert.ok(
    attacker.vx < 0 && target.vx > 0,
    "the attacker recoils and the target is knocked back",
  );
  for (let frame = 0; frame < 1500; frame++) {
    advanceBody(attacker, 1 / 60, width, height, true);
    advanceBody(target, 1 / 60, width, height, true);
  }
  assert.equal(attacker.mode, "walk");
  assert.equal(target.mode, "walk");
});

test("sleeping targets receive the hit effect without waking or being flung", () => {
  const attacker = createBody("self", width, height);
  const target = createBody("asleep", width, height);
  const before = { ...target };
  const attack = createAttack(attacker, target)!;
  let hits = 0;
  for (let frame = 0; frame < 180; frame++) {
    const step = advanceAttack(attack, 1 / 60, width, height, false);
    if (step === "hit") hits++;
    if (step === "done") break;
  }
  assert.equal(hits, 1);
  assert.deepEqual(target, before);
});

test("self attacks and held characters are rejected without changing their physics", () => {
  const attacker = createBody("self", width, height);
  const target = createBody("friend", width, height);
  const original = { ...attacker };
  assert.equal(createAttack(attacker, attacker), null);
  target.mode = "drag";
  assert.equal(createAttack(attacker, target), null);
  assert.deepEqual(attacker, original);
  target.mode = "walk";
  attacker.mode = "drag";
  assert.equal(createAttack(attacker, target), null);
  assert.equal(attacker.mode, "drag");
});

test("cancelling when a participant disappears or is grabbed releases the attacker safely", () => {
  const attacker = createBody("self", width, height);
  const target = createBody("friend", width, height);
  const attack = createAttack(attacker, target)!;
  advanceAttack(attack, 0.05, width, height, true);
  const position = { x: attacker.x, y: attacker.y };
  cancelAttack(attack);
  assert.equal(attacker.mode, "air");
  assert.deepEqual({ x: attacker.x, y: attacker.y }, position);
  assert.equal(attacker.vx, 0);
  assert.equal(attacker.vy, 0);
  attacker.mode = "drag";
  cancelAttack(attack);
  assert.equal(
    attacker.mode,
    "drag",
    "cancellation must never override a new drag",
  );
});

test("overlapping characters and tiny or resized screens keep the dash finite and bounded", () => {
  for (const [w, h] of [
    [80, 80],
    [1200, 800],
  ]) {
    const attacker = createBody("self", w, h);
    const target = createBody("friend", w, h);
    moveBody(attacker, w / 2, h / 2, w, h);
    moveBody(target, w / 2, h / 2, w, h);
    const attack = createAttack(attacker, target)!;
    for (let frame = 0; frame < 100; frame++) {
      const step = advanceAttack(attack, 0.05, w, h, true);
      assert.ok(
        [attacker.x, attacker.y, attacker.angle].every(Number.isFinite),
      );
      assert.ok(
        attacker.x >= 0 &&
          attacker.x <= w &&
          attacker.y >= 0 &&
          attacker.y <= h,
      );
      if (step === "done") break;
    }
    assert.equal(attack.phase, "impact");
  }
});
