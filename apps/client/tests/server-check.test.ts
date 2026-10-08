import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import { test } from "node:test";
import { checkServer } from "../src/server-check.ts";

test("server checks validate public responses without credentials, redirects or writes", async (t) => {
  let status = 200;
  let body = '{"ok":true}';
  const paths: string[] = [];
  const server = createServer((req, res) => {
    paths.push(req.url!);
    assert.equal(req.method, "GET");
    assert.equal(req.headers.authorization, undefined);
    assert.equal(req.headers.cookie, undefined);
    res.writeHead(status, {
      "Content-Type": "application/json",
      ...(status === 302 ? { Location: "/redirected" } : {}),
    });
    res.end(body);
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  const fetch = globalThis.fetch;
  t.mock.method(globalThis, "fetch", (url: string, options: RequestInit) => {
    assert.equal(options.credentials, "omit");
    assert.equal(options.cache, "no-store");
    assert.equal(options.redirect, "error");
    return fetch(url, options);
  });
  try {
    for (const invalid of [
      "",
      "example.com",
      base + "/page",
      base + "?token=secret",
      "https://user:secret@example.com",
    ])
      await assert.rejects(checkServer(invalid), /서버 주소를 입력/);
    assert.equal(paths.length, 0);
    assert.equal(await checkServer(base + "/"), base);
    for (body of [
      "null",
      "[]",
      "{}",
      '{"ok":false}',
      '{"ok":"true"}',
      "<html>not an API</html>",
    ])
      await assert.rejects(checkServer(base), /Wappy 서버 주소/);
    body = '{"error":"untrusted response text"}';
    for (status of [401, 403, 429, 503])
      await assert.rejects(checkServer(base), new RegExp(`HTTP ${status}`));
    status = 404;
    await assert.rejects(checkServer(base), /이 주소에서 서버를 찾지 못했어요/);
    status = 302;
    await assert.rejects(checkServer(base), /서버에 연결하지 못했어요/);
    assert.ok(paths.every((path) => path === "/health"));
  } finally {
    const closed = once(server, "close");
    server.close();
    server.closeAllConnections();
    await closed;
  }
});

test("server checks cancel on navigation and time out without retrying", async (t) => {
  let requests = 0;
  t.mock.timers.enable({ apis: ["setTimeout"] });
  t.mock.method(globalThis, "fetch", (_url: string, options: RequestInit) => {
    requests++;
    return new Promise((_resolve, reject) => {
      options.signal!.addEventListener(
        "abort",
        () => reject(new DOMException("Aborted", "AbortError")),
        { once: true },
      );
    });
  });
  const cancelled = new AbortController();
  cancelled.abort();
  await assert.rejects(checkServer("https://example.test", cancelled.signal), {
    name: "AbortError",
  });
  assert.equal(requests, 0);
  const controller = new AbortController();
  const pending = checkServer("https://example.test", controller.signal);
  controller.abort();
  await assert.rejects(pending, { name: "AbortError" });
  const timedOut = checkServer("https://example.test");
  t.mock.timers.tick(10_000);
  await assert.rejects(timedOut, /10초 안에 응답하지 않았어요/);
  assert.equal(requests, 2, "each manual check makes one attempt");
});
