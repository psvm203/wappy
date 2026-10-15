import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";
import { test } from "node:test";
import { stateEventParser, subscribeStreamState } from "../src/state-stream.ts";
import type { StateUpdate } from "../src/state-polling.ts";

const session = { server: "https://example.test", token: "a".repeat(43) };
const state = {
  self: { id: "self", name: "친구", character: "hachiware" },
  friends: [],
};
const encoder = new TextEncoder();
const frame = (value = state) =>
  encoder.encode(`event: state\ndata: ${JSON.stringify(value)}\n\n`);

test("SSE parser handles split UTF-8, BOM, CR/LF, multiline data and limits individual frames", () => {
  const received: [string, string][] = [];
  const parse = stateEventParser((event, data) => received.push([event, data]));
  const input = encoder.encode(
    '\uFEFF: keepalive\r\nevent: state\r\ndata: {\r\ndata: "name":"친구"}\r\n\r\nevent: ignored\rdata: next\r\r',
  );
  for (const byte of input) parse(Uint8Array.of(byte));
  assert.deepEqual(received, [
    ["state", '{\n"name":"친구"}'],
    ["ignored", "next"],
  ]);
  // Lifetime traffic may exceed the frame limit without accumulating in memory.
  for (let i = 0; i < 1100; i++)
    parse(encoder.encode(`: ${"x".repeat(1000)}\n\n`));
  assert.equal(received.length, 2);
  assert.throws(
    () => parse(encoder.encode("x".repeat(1024 * 1024 + 1))),
    /too large/,
  );
});

test("browser SSE sends heartbeats, reconnects with fresh state, stops on revocation and cleans up", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  t.mock.method(Math, "random", () => 0);
  const updates: StateUpdate[] = [];
  const streams: ReadableStreamDefaultController<Uint8Array>[] = [];
  const paths: string[] = [];
  const fetch = t.mock.method(globalThis, "fetch", async (url, options) => {
    const path = String(url).slice(session.server.length);
    paths.push(path);
    assert.equal(
      new Headers(options?.headers).get("Authorization"),
      `Bearer ${session.token}`,
    );
    assert.equal(options?.redirect, "error");
    if (path === "/heartbeat") {
      assert.equal(options?.method, "POST");
      return new Response(null, { status: 204 });
    }
    assert.equal(path, "/events");
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        streams.push(controller);
        options?.signal?.addEventListener(
          "abort",
          () => controller.error(new Error("aborted")),
          { once: true },
        );
      },
    });
    return new Response(stream, {
      headers: { "Content-Type": "text/event-stream" },
    });
  });
  const stop = subscribeStreamState(session, (update) => updates.push(update));
  t.after(stop);
  await setImmediate();
  streams[0].enqueue(frame());
  await setImmediate();
  assert.deepEqual(updates, [{ connection: "online", state }]);
  for (let i = 0; i < 4; i++) {
    t.mock.timers.tick(10_000);
    await setImmediate();
    streams[0].enqueue(encoder.encode(": keepalive\n\n"));
    await setImmediate();
  }
  assert.equal(paths.filter((path) => path === "/heartbeat").length, 4);
  assert.equal(
    updates.length,
    1,
    "comments don't produce redundant UI updates",
  );
  streams[0].close();
  await setImmediate();
  assert.equal(updates.at(-1)?.connection, "offline");
  t.mock.timers.tick(1000);
  await setImmediate();
  assert.equal(streams.length, 2);
  const changed = { ...state, self: { ...state.self, name: "New" } };
  streams[1].enqueue(frame(changed));
  await setImmediate();
  assert.deepEqual(updates.at(-1), { connection: "online", state: changed });
  streams[1].enqueue(encoder.encode("event: unauthorized\ndata: {}\n\n"));
  await setImmediate();
  assert.equal(updates.at(-1)?.connection, "unauthorized");
  const count = fetch.mock.callCount();
  t.mock.timers.tick(120_000);
  await setImmediate();
  assert.equal(
    fetch.mock.callCount(),
    count,
    "revoked sessions neither reconnect nor heartbeat",
  );

  const cancel = subscribeStreamState(session, () =>
    assert.fail("disposed subscription updated UI"),
  );
  await setImmediate();
  cancel();
  await setImmediate();
  const stopped = fetch.mock.callCount();
  t.mock.timers.tick(120_000);
  await setImmediate();
  assert.equal(fetch.mock.callCount(), stopped);
});

test("unsupported SSE falls back to ETag polling; authentication and transient failures never do", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  t.mock.method(Math, "random", () => 0);
  const paths: string[] = [];
  const replies = [
    new Response(null, { status: 404 }),
    new Response(JSON.stringify(state), { headers: { ETag: '"one"' } }),
    new Response(null, { status: 304 }),
  ];
  const fetch = t.mock.method(globalThis, "fetch", async (url, options) => {
    paths.push(String(url));
    if (paths.length === 3)
      assert.equal(new Headers(options?.headers).get("If-None-Match"), '"one"');
    return replies.shift()!;
  });
  const updates: StateUpdate[] = [];
  const stop = subscribeStreamState(session, (update) => updates.push(update));
  await setImmediate();
  t.mock.timers.tick(5000);
  await setImmediate();
  stop();
  assert.deepEqual(
    paths.map((path) => path.slice(session.server.length)),
    ["/events", "/state", "/state"],
  );
  assert.deepEqual(updates, [
    { connection: "online", state },
    { connection: "online" },
  ]);

  const retries: string[] = [];
  fetch.mock.mockImplementation(async (url) => {
    retries.push(String(url));
    return new Response(null, { status: retries.length < 3 ? 503 : 401 });
  });
  const cancel = subscribeStreamState(session, (update) =>
    updates.push(update),
  );
  t.after(cancel);
  await setImmediate();
  for (const delay of [1000, 2000]) {
    t.mock.timers.tick(delay);
    await setImmediate();
  }
  t.mock.timers.tick(120_000);
  await setImmediate();
  assert.deepEqual(retries, Array(3).fill(session.server + "/events"));
  assert.equal(updates.at(-1)?.connection, "unauthorized");
});

test("invalid state, idle streams and rejected heartbeats disconnect instead of staying online", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const streams: ReadableStreamDefaultController<Uint8Array>[] = [];
  let heartbeatStatus = 204;
  t.mock.method(globalThis, "fetch", async (url, options) => {
    if (String(url).endsWith("/heartbeat"))
      return new Response(null, { status: heartbeatStatus });
    return new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          streams.push(controller);
          options?.signal?.addEventListener(
            "abort",
            () => controller.error(new Error("aborted")),
            { once: true },
          );
        },
      }),
      { headers: { "Content-Type": "text/event-stream" } },
    );
  });
  for (const cause of ["invalid", "idle", "heartbeat"] as const) {
    const updates: StateUpdate[] = [];
    const stop = subscribeStreamState(session, (update) =>
      updates.push(update),
    );
    await setImmediate();
    const stream = streams.at(-1)!;
    stream.enqueue(frame());
    await setImmediate();
    if (cause === "invalid")
      stream.enqueue(encoder.encode("event: state\ndata: {}\n\n"));
    if (cause === "idle") t.mock.timers.tick(30_000);
    if (cause === "heartbeat") {
      heartbeatStatus = 401;
      t.mock.timers.tick(10_000);
    }
    await setImmediate();
    assert.equal(
      updates.at(-1)?.connection,
      cause === "heartbeat" ? "unauthorized" : "offline",
    );
    stop();
  }
});
