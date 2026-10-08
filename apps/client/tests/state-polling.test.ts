import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";
import { test } from "node:test";
import {
  subscribeBrowserState,
  type StateUpdate,
} from "../src/state-polling.ts";

const session = { server: "https://example.test", token: "a".repeat(43) };
const state = {
  self: { id: "self", name: "Alice", character: "cat", status: "" },
  friends: [],
};

test("browser polling validates once, skips unchanged bodies, recovers and releases each subscription", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const replies = [
    new Response(JSON.stringify(state), { headers: { ETag: '"v1"' } }),
    new Response(null, { status: 304 }),
    new Response(null, { status: 503 }),
    new Response(null, { status: 304 }),
    new Response(
      JSON.stringify({ ...state, self: { ...state.self, name: "New" } }),
      { headers: { ETag: '"v2"' } },
    ),
    new Response(null, { status: 401 }),
  ];
  const headers: Headers[] = [];
  const fetch = t.mock.method(globalThis, "fetch", async (_url, options) => {
    headers.push(new Headers(options.headers));
    return replies.shift()!;
  });
  const updates: StateUpdate[] = [];
  const stop = subscribeBrowserState(session, (update) => updates.push(update));
  t.after(stop);
  await setImmediate();
  for (let i = 0; i < 5; i++) {
    t.mock.timers.tick(5000);
    await setImmediate();
  }
  assert.deepEqual(
    updates.map((update) => update.connection),
    ["online", "online", "offline", "online", "online", "unauthorized"],
  );
  assert.deepEqual(updates[0], { connection: "online", state });
  assert.deepEqual(updates[1], { connection: "online" });
  assert.deepEqual(updates[3], { connection: "online" });
  assert.deepEqual(
    headers.map((header) => header.get("If-None-Match")),
    [null, '"v1"', '"v1"', '"v1"', '"v1"', '"v2"'],
  );
  t.mock.timers.tick(120_000);
  await setImmediate();
  assert.equal(fetch.mock.callCount(), 6, "unauthorized sessions stop polling");
  stop();
  let aborted = false;
  fetch.mock.mockImplementation(
    (_url, options) =>
      new Promise((_resolve, reject) => {
        assert.equal(
          new Headers(options.headers).get("If-None-Match"),
          null,
          "new profiles do not inherit a validator",
        );
        options.signal.addEventListener("abort", () => {
          aborted = true;
          reject(new Error("aborted"));
        });
      }),
  );
  const cancel = subscribeBrowserState(
    { ...session, token: "b".repeat(43) },
    () => assert.fail("disposed callback"),
  );
  cancel();
  await setImmediate();
  assert.equal(aborted, true);
  t.mock.timers.tick(120_000);
  assert.equal(fetch.mock.callCount(), 7);
});

test("invalid/oversized responses never become validators; repeated failures back off and success resets the delay", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const replies = [
    new Response(null, { status: 304 }),
    new Response("{}", { headers: { ETag: '"invalid"' } }),
    new Response("x".repeat(1024 * 1024 + 1), { headers: { ETag: '"large"' } }),
    new Response(JSON.stringify(state)), // Older servers without ETag still work.
    new Response(JSON.stringify(state)),
  ];
  const fetch = t.mock.method(globalThis, "fetch", async (_url, options) => {
    assert.equal(new Headers(options.headers).get("If-None-Match"), null);
    return replies.shift()!;
  });
  const updates: StateUpdate[] = [];
  const stop = subscribeBrowserState(session, (update) => updates.push(update));
  t.after(stop);
  await setImmediate();
  for (const delay of [5000, 10_000, 20_000, 5000]) {
    const before = fetch.mock.callCount();
    t.mock.timers.tick(delay - 1);
    await setImmediate();
    assert.equal(fetch.mock.callCount(), before);
    t.mock.timers.tick(1);
    await setImmediate();
    assert.equal(fetch.mock.callCount(), before + 1);
  }
  assert.deepEqual(
    updates.map((update) => update.connection),
    ["offline", "offline", "offline", "online", "online"],
  );
});
