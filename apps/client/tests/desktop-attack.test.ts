import assert from "node:assert/strict";
import test from "node:test";
import {
  advanceAttack,
  attackVisual,
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

const heroes = [
  ["ironman", "repulsor"],
  ["captain-america", "shield"],
  ["thor", "lightning"],
  ["hulk", "smash"],
  ["black-widow", "bullet"],
  ["hawkeye", "arrow"],
] as const;

test("each Avenger uses their own attack, tracks a moving target and hits exactly once", () => {
  for (const [character, kind] of heroes) {
    const attacker = createBody("self", width, height);
    const target = createBody("friend", width, height);
    moveBody(attacker, 120, 400, width, height);
    moveBody(target, 900, 400, width, height);
    const attack = createAttack(attacker, target, character)!;
    assert.equal(attack.kind, kind);
    let hits = 0,
      done = false;
    for (let frame = 0; frame < 180; frame++) {
      if (attack.phase === "dash")
        moveBody(target, target.x, target.y + 1, width, height);
      const step = advanceAttack(attack, 1 / 60, width, height, true);
      if (kind !== "smash") {
        assert.equal(
          attacker.x,
          120,
          `${character} must fire from its own position`,
        );
        assert.equal(attacker.y, 400);
      }
      if (step === "hit") {
        hits++;
        if (kind !== "smash") {
          const visual = attackVisual(attack, width, height);
          assert.ok(
            Math.hypot(visual.x - target.x, visual.y - target.y) < 0.001,
          );
        }
      }
      if (step === "done") {
        done = true;
        break;
      }
    }
    assert.equal(hits, 1, character);
    assert.ok(done, `${character} must finish`);
    assert.equal(attacker.mode, "air");
    assert.ok(Math.hypot(target.vx, target.vy) > 0);
    for (let frame = 0; frame < 1500; frame++) {
      advanceBody(attacker, 1 / 60, width, height, true);
      advanceBody(target, 1 / 60, width, height, true);
    }
    assert.equal(attacker.mode, "walk", character);
    assert.equal(target.mode, "walk", character);
  }
});

test("Captain America's shield arcs out, hits once, and returns all the way to his hand", () => {
  const attacker = createBody("self", width, height);
  const target = createBody("friend", width, height);
  moveBody(attacker, 200, 400, width, height);
  moveBody(target, 900, 400, width, height);
  const attack = createAttack(attacker, target, "captain-america")!;
  let hits = 0,
    curved = false,
    returning = false,
    done = false;
  for (let frame = 0; frame < 180; frame++) {
    const step = advanceAttack(attack, 1 / 60, width, height, true);
    const visual = attackVisual(attack, width, height);
    if (attack.phase === "dash" && visual.y > 420) curved = true;
    if (step === "hit") hits++;
    if (step === "return") {
      returning = true;
      // The target is free to move after impact; the shield must return from the impact point.
      advanceBody(target, 1 / 60, width, height, true);
    }
    if (step === "done") {
      done = true;
      assert.ok(
        Math.hypot(visual.x - visual.sourceX, visual.y - visual.sourceY) <
          0.001,
      );
      break;
    }
  }
  assert.ok(curved && returning && done);
  assert.equal(hits, 1);
});

test("Hulk jumps above the target, descends onto them, then delivers downward knockback", () => {
  const attacker = createBody("self", width, height);
  const target = createBody("friend", width, height);
  moveBody(attacker, 200, 600, width, height);
  moveBody(target, 900, 600, width, height);
  target.angle = 0;
  const attack = createAttack(attacker, target, "hulk")!;
  let peak = attacker.y,
    previousY = attacker.y,
    hit = false;
  for (let frame = 0; frame < 180; frame++) {
    const step = advanceAttack(attack, 1 / 60, width, height, true);
    peak = Math.min(peak, attacker.y);
    if (step === "hit") {
      hit = true;
      assert.ok(attacker.y > previousY, "Hulk must be descending at impact");
      assert.equal(attacker.x, target.x);
      assert.equal(attacker.y, target.y - 38);
    }
    if (step === "done") break;
    previousY = attacker.y;
  }
  assert.ok(hit && peak < 430, "the jump must visibly lift Hulk");
  assert.ok(target.vy > 0 && attacker.vy < 0);
});

test("hero effects remain finite at any angle, on overlapping bodies and after a resize", () => {
  for (const [character] of heroes) {
    for (const [x, y] of [
      [900, 400],
      [120, 400],
      [500, 100],
      [500, 700],
      [500, 400],
    ]) {
      const attacker = createBody("self", width, height);
      const target = createBody("friend", width, height);
      moveBody(attacker, 500, 400, width, height);
      moveBody(target, x, y, width, height);
      const attack = createAttack(attacker, target, character)!;
      if (character !== "hulk") {
        const { sourceX, sourceY } = attackVisual(attack, width, height);
        const dx = x - attacker.x,
          dy = y - attacker.y;
        assert.ok(
          (sourceX - attacker.x) * dx + (sourceY - attacker.y) * dy >= -0.001,
        );
      }
      let done = false;
      for (let frame = 0; frame < 100; frame++) {
        moveBody(target, target.x, target.y, 80, 80);
        const step = advanceAttack(attack, 0.05, 80, 80, true);
        assert.ok(
          Object.values(attackVisual(attack, width, height)).every(
            Number.isFinite,
          ),
        );
        assert.ok(
          [attacker.x, attacker.y, attacker.angle].every(Number.isFinite),
        );
        assert.equal(attacker.x, 40);
        assert.equal(attacker.y, 40);
        if (step === "done") {
          done = true;
          break;
        }
      }
      assert.ok(done, character);
    }
  }
});

test("Hulk jumps inward from every screen edge and shields stay visible on both flight legs", () => {
  for (const [sx, sy, tx, ty, angle] of [
    [200, 60, 900, 60, Math.PI],
    [200, 740, 900, 740, 0],
    [60, 200, 60, 600, Math.PI / 2],
    [1140, 200, 1140, 600, -Math.PI / 2],
  ]) {
    for (const character of ["hulk", "captain-america"] as const) {
      const attacker = createBody("self", width, height);
      const target = createBody("friend", width, height);
      moveBody(attacker, sx, sy, width, height);
      moveBody(target, tx, ty, width, height);
      target.angle = angle;
      const attack = createAttack(attacker, target, character)!;
      let jumped = false;
      for (let frame = 0; frame < 100; frame++) {
        const step = advanceAttack(attack, 1 / 60, width, height, true);
        if (character === "hulk") {
          const inward =
            (attacker.x - sx) * Math.sin(angle) -
            (attacker.y - sy) * Math.cos(angle);
          if (inward > 100) jumped = true;
          if (step === "hit")
            assert.ok(
              Math.abs(Math.hypot(attacker.x - tx, attacker.y - ty) - 38) <
                0.001,
            );
        } else {
          const { x, y } = attackVisual(attack, width, height);
          assert.ok(x >= 18 && x <= width - 18 && y >= 18 && y <= height - 18);
        }
        if (step === "done") break;
      }
      if (character === "hulk") assert.ok(jumped);
    }
  }
});

test("hero attacks respect held and sleeping bodies and cancellation during shield return", () => {
  for (const [character] of heroes) {
    const attacker = createBody("self", width, height);
    const target = createBody("friend", width, height);
    target.mode = "drag";
    const original = { ...attacker };
    assert.equal(createAttack(attacker, target, character), null);
    assert.deepEqual(attacker, original);
    target.mode = "walk";
    const before = { ...target };
    const attack = createAttack(attacker, target, character)!;
    for (let frame = 0; frame < 100; frame++) {
      const step = advanceAttack(attack, 0.05, width, height, false);
      if (step === "return") {
        attacker.mode = "drag";
        cancelAttack(attack);
        assert.equal(attacker.mode, "drag");
        break;
      }
      if (step === "done") break;
    }
    assert.deepEqual(target, before, character);
  }
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
