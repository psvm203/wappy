import assert from "node:assert/strict";
import { test } from "node:test";
import {
  loadCharacterPreferences,
  CHARACTER_ACTIVITIES,
  CHARACTER_POSITIONS,
  CHARACTER_SIZES,
  PREFERENCES_KEY,
} from "../src/preferences.ts";

test("character preferences survive restarts while respecting reduced motion and damaged storage", () => {
  let stored: string | null = null;
  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => {
        assert.equal(key, PREFERENCES_KEY);
        return stored;
      },
    },
  });
  try {
    assert.deepEqual(loadCharacterPreferences(false), {
      paused: false,
      visible: true,
      position: "free",
      size: "normal",
      activity: "normal",
    });
    stored = JSON.stringify({ paused: true, visible: false });
    assert.deepEqual(loadCharacterPreferences(false), {
      paused: true,
      visible: false,
      position: "free",
      size: "normal",
      activity: "normal",
    });
    stored = JSON.stringify({ paused: false, visible: false });
    assert.deepEqual(loadCharacterPreferences(true), {
      paused: true,
      visible: false,
      position: "free",
      size: "normal",
      activity: "normal",
    });
    for (const position of Object.keys(CHARACTER_POSITIONS)) {
      stored = JSON.stringify({ paused: false, visible: true, position });
      assert.equal(loadCharacterPreferences(false).position, position);
      assert.deepEqual(loadCharacterPreferences(true), {
        paused: true,
        visible: true,
        position,
        size: "normal",
        activity: "normal",
      });
    }
    for (const size of Object.keys(CHARACTER_SIZES)) {
      stored = JSON.stringify({
        paused: false,
        visible: true,
        position: "top",
        size,
      });
      assert.equal(loadCharacterPreferences(false).size, size);
      assert.deepEqual(loadCharacterPreferences(true), {
        paused: true,
        visible: true,
        position: "top",
        size,
        activity: "normal",
      });
    }
    for (const activity of Object.keys(CHARACTER_ACTIVITIES)) {
      for (const paused of [false, true]) {
        stored = JSON.stringify({ paused, activity });
        assert.deepEqual(loadCharacterPreferences(false), {
          paused,
          visible: true,
          position: "free",
          size: "normal",
          activity,
        });
        assert.deepEqual(loadCharacterPreferences(true), {
          paused: true,
          visible: true,
          position: "free",
          size: "normal",
          activity,
        });
      }
    }
    for (const invalid of [
      "{",
      "null",
      "[]",
      '"false"',
      '{"paused":"true","visible":0}',
      '{"position":"edge"}',
      '{"position":"__proto__"}',
      '{"position":1}',
      '{"size":"huge"}',
      '{"size":"__proto__"}',
      '{"size":72}',
      '{"size":null}',
      '{"activity":"running"}',
      '{"activity":"__proto__"}',
      '{"activity":2}',
      '{"activity":null}',
    ]) {
      stored = invalid;
      assert.deepEqual(loadCharacterPreferences(false), {
        paused: false,
        visible: true,
        position: "free",
        size: "normal",
        activity: "normal",
      });
      assert.deepEqual(loadCharacterPreferences(true), {
        paused: true,
        visible: true,
        position: "free",
        size: "normal",
        activity: "normal",
      });
    }
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get() {
        throw new Error("Storage is unavailable");
      },
    });
    assert.deepEqual(loadCharacterPreferences(true), {
      paused: true,
      visible: true,
      position: "free",
      size: "normal",
      activity: "normal",
    });
  } finally {
    if (original) Object.defineProperty(globalThis, "localStorage", original);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});
