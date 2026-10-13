import assert from "node:assert/strict";
import test from "node:test";
import { captureDesktopPointer } from "../src/desktop-pointer.ts";

test("a window behind a character receives the click; bare desktop keeps character input", async () => {
  assert.equal(
    await captureDesktopPointer(true, false, async () => true),
    false,
  );
  assert.equal(
    await captureDesktopPointer(true, false, async () => false),
    true,
  );
});

test("chat stays usable over an app and empty overlay space stays click-through", async () => {
  const unexpectedLookup = async () => {
    throw new Error("No native window lookup is needed");
  };
  for (const overCharacter of [false, true]) {
    assert.equal(
      await captureDesktopPointer(overCharacter, true, unexpectedLookup),
      true,
    );
  }
  assert.equal(
    await captureDesktopPointer(false, false, unexpectedLookup),
    false,
  );
});

test("a failed native lookup reaches the poller's click-through error handler", async () => {
  await assert.rejects(
    captureDesktopPointer(true, false, async () => {
      throw new Error("Window lookup failed");
    }),
    /Window lookup failed/,
  );
});
