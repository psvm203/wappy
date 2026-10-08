import assert from "node:assert/strict";
import { fork } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { Agent, get } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { createApp } from "../src/server.ts";

// Fixed budgets: do not relax them to make an implementation pass.
const budgets = {
  idleResponseBytes: 512,
  p95Milliseconds: 10,
  retainedHeapBytes: 1024 * 1024,
  retainedRssBytes: 8 * 1024 * 1024,
};
const token = "a".repeat(43);
const time = 1_800_000_000_000;

if (process.argv.includes("--server")) {
  const directory = mkdtempSync(join(tmpdir(), "wappy-performance-"));
  const databasePath = join(directory, "test.sqlite");
  const server = createApp({ databasePath, now: () => time });
  const db = new DatabaseSync(databasePath);
  db.exec("PRAGMA foreign_keys = ON; BEGIN");
  const user = db.prepare("INSERT INTO users VALUES (?, ?, ?, ?, ?)");
  user.run(
    "self",
    createHash("sha256").update(token).digest("hex"),
    "나",
    "cat",
    "",
  );
  const friendship = db.prepare("INSERT INTO friendships VALUES (?, ?)");
  for (let i = 0; i < 100; i++) {
    const id = `friend-${i}`;
    user.run(id, id, `친구 ${i}`, "cat", "함께 이야기해요".repeat(4));
    friendship.run(id, "self");
  }
  const chat = db.prepare(
    "INSERT INTO chat_messages (sender_id, text, sent_at) VALUES (?, ?, ?)",
  );
  for (let i = 0; i < 50; i++) chat.run("self", "안녕".repeat(100), time - i);
  // The measured user has no access to these newer messages. Each sender is
  // within the real 50-message retention limit; no artificial oversized user.
  for (let i = 0; i < 2000; i++) {
    const id = `unrelated-${i}`;
    user.run(id, id, id, "cat", "");
    for (let j = 0; j < 50; j++) chat.run(id, "다른 대화", time);
  }
  db.exec("COMMIT");
  db.close();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  process.send({ port: server.address().port });
  process.on("message", () => {
    global.gc();
    process.send(process.memoryUsage());
  });
  process.on("disconnect", () => {
    server.close(() => rmSync(directory, { recursive: true, force: true }));
    server.closeAllConnections();
  });
} else {
  const child = fork(fileURLToPath(import.meta.url), ["--server"], {
    execArgv: ["--expose-gc"],
    stdio: ["ignore", "inherit", "inherit", "ipc"],
  });
  const agent = new Agent({ keepAlive: true, maxSockets: 1 });
  try {
    const [{ port }] = await once(child, "message");
    let etag;
    async function poll() {
      const start = performance.now();
      return new Promise((resolve, reject) => {
        let before = 0;
        const request = get(
          `http://127.0.0.1:${port}/state`,
          {
            agent,
            headers: {
              Authorization: `Bearer ${token}`,
              ...(etag ? { "If-None-Match": etag } : {}),
            },
          },
          (response) => {
            const socket = response.socket;
            const chunks = [];
            response.on("data", (chunk) => chunks.push(chunk));
            response.on("end", () => {
              try {
                assert.ok(
                  response.statusCode === 200 || response.statusCode === 304,
                );
                const body = Buffer.concat(chunks);
                if (response.statusCode === 200) {
                  const state = JSON.parse(body);
                  assert.equal(state.friends.length, 100);
                  assert.equal(state.messages.length, 50);
                  assert.ok(
                    state.messages.every(
                      (message) => message.senderId === "self",
                    ),
                  );
                } else assert.equal(body.length, 0);
                etag = response.headers.etag;
                resolve({
                  bytes: socket.bytesRead - before,
                  bodyBytes: body.length,
                  ms: performance.now() - start,
                  status: response.statusCode,
                });
              } catch (error) {
                reject(error);
              }
            });
            response.on("error", reject);
          },
        );
        request.on("socket", (socket) => {
          before = socket.bytesRead;
        });
        request.on("error", reject);
        request.setTimeout(10_000, () =>
          request.destroy(new Error("Request timeout")),
        );
      });
    }
    async function memory() {
      const pending = once(child, "message");
      child.send("memory");
      return (await pending)[0];
    }
    const first = await poll();
    for (let i = 0; i < 200; i++) await poll();
    const before = await memory();
    const samples = [];
    for (let i = 0; i < 2000; i++) samples.push(await poll());
    const after = await memory();
    const metrics = {
      idleResponseBytes: Math.max(...samples.map((sample) => sample.bytes)),
      p95Milliseconds: samples
        .map((sample) => sample.ms)
        .sort((a, b) => a - b)[1899],
      retainedHeapBytes: Math.max(0, after.heapUsed - before.heapUsed),
      retainedRssBytes: Math.max(0, after.rss - before.rss),
    };
    const points = Object.fromEntries(
      Object.entries(metrics).map(([key, value]) => [
        key,
        25 * Math.min(1, budgets[key] / Math.max(value, Number.EPSILON)),
      ]),
    );
    const score = Object.values(points).reduce((sum, value) => sum + value, 0);
    console.log(
      JSON.stringify(
        {
          node: process.version,
          platform: process.platform,
          architecture: process.arch,
          fixture: {
            friends: 100,
            unrelatedMessages: 100000,
            ownMessages: 50,
            warmup: 200,
            polls: 2000,
          },
          budgets,
          metrics,
          points,
          firstResponseBytes: first.bytes,
          totalIdleBodyBytes: samples.reduce((n, s) => n + s.bodyBytes, 0),
          notModifiedResponses: samples.filter((s) => s.status === 304).length,
          score: Math.round(score * 100) / 100,
          passed: score >= 99,
        },
        null,
        2,
      ),
    );
    if (score < 99) process.exitCode = 1;
  } finally {
    agent.destroy();
    const stopped = once(child, "exit");
    child.disconnect();
    await stopped;
  }
}
