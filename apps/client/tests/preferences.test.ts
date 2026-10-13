import assert from "node:assert/strict";
import { test } from "node:test";
import {
  loadCharacterPreferences,
  CHARACTER_POSITIONS,
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
    });
    stored = JSON.stringify({ paused: true, visible: false });
    assert.deepEqual(loadCharacterPreferences(false), {
      paused: true,
      visible: false,
      position: "free",
    });
    stored = JSON.stringify({ paused: false, visible: false });
    assert.deepEqual(loadCharacterPreferences(true), {
      paused: true,
      visible: false,
      position: "free",
    });
    for (const position of Object.keys(CHARACTER_POSITIONS)) {
      stored = JSON.stringify({ paused: false, visible: true, position });
      assert.equal(loadCharacterPreferences(false).position, position);
      assert.deepEqual(loadCharacterPreferences(true), {
        paused: true,
        visible: true,
        position,
      });
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
    ]) {
      stored = invalid;
      assert.deepEqual(loadCharacterPreferences(false), {
        paused: false,
        visible: true,
        position: "free",
      });
      assert.deepEqual(loadCharacterPreferences(true), {
        paused: true,
        visible: true,
        position: "free",
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
    });
  } finally {
    if (original) Object.defineProperty(globalThis, "localStorage", original);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});
