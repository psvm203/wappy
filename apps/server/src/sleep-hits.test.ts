import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";
import {
  ATTACK_COOLDOWN_MS,
  ONLINE_TIMEOUT_MS,
  parseSidebarState,
} from "@wappy/api";
import { createApp } from "./server.ts";

test("sleep hits count only actual absences, survive expiry and restart, and reset for the next absence", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "wappy-sleep-hits-"));
  const databasePath = join(directory, "test.sqlite");
  let now = 1_800_000_000_000;
  let server: ReturnType<typeof createApp>;
  let base: string;
  async function start() {
    server = createApp({ databasePath, now: () => now });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    base = `http://127.0.0.1:${address.port}`;
  }
  async function close() {
    const closed = once(server, "close");
    server.close();
    server.closeAllConnections();
    await closed;
  }
  await start();
  t.after(async () => {
    await close();
    rmSync(directory, { recursive: true, force: true });
  });
  async function call(
    path: string,
    token?: string,
    body?: unknown,
    method = body === undefined ? "GET" : "POST",
    etag?: string,
  ) {
    const response = await fetch(base + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(etag ? { "If-None-Match": etag } : {}),
      },
      // oxlint-disable-next-line unicorn/no-invalid-fetch-options -- Bodies select POST by default; presence writes explicitly use PATCH.
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    return {
      status: response.status,
      body: text ? JSON.parse(text) : null,
      etag: response.headers.get("ETag")!,
    };
  }
  const alice = (
    await call("/session", undefined, { name: "Alice", character: "chiikawa" })
  ).body;
  const bob = (
    await call("/session", undefined, { name: "Bob", character: "rakko" })
  ).body;
  const invite = (await call("/invites", alice.token, {})).body;
  assert.equal((await call("/invites/accept", bob.token, invite)).status, 200);
  const state = (token: string, etag?: string) =>
    call("/state", token, undefined, "GET", etag);
  const attack = () =>
    call("/friends/attack", alice.token, { friendId: bob.profile.id });
  const hideBob = () =>
    call("/presence", bob.token, { sharing: false }, "PATCH");

  // Upgrade a populated database from before this feature without losing profiles.
  await close();
  let db = new DatabaseSync(databasePath);
  db.exec("DROP TABLE sleep_hit_counts");
  db.close();
  await start();
  const initial = await state(bob.token);
  assert.equal(parseSidebarState(initial.body).sleepHitCount, 0);
  await state(alice.token);
  await hideBob();
  assert.equal((await attack()).status, 201);
  assert.equal((await state(bob.token)).body.sleepHitCount, 0);

  now += ONLINE_TIMEOUT_MS - 1;
  await state(alice.token);
  assert.equal((await attack()).status, 201);
  now += ATTACK_COOLDOWN_MS;
  assert.equal((await attack()).status, 201);
  assert.equal((await attack()).status, 429, "rejected attacks must not count");
  now += ATTACK_COOLDOWN_MS;
  assert.equal((await attack()).status, 201);

  // Expired animation events are disposable; the unread count is not.
  await close();
  db = new DatabaseSync(databasePath);
  db.exec("DELETE FROM attack_events");
  assert.equal(
    db
      .prepare("SELECT pending_count FROM sleep_hit_counts WHERE user_id = ?")
      .get(bob.profile.id)!.pending_count,
    2,
  );
  db.close();
  await start();
  const observer = parseSidebarState((await state(alice.token)).body);
  assert.equal(observer.sleepHitCount, 0, "counts belong to the target only");
  assert.deepEqual(Object.keys(observer.friends[0]!).sort(), [
    "character",
    "id",
    "name",
    "online",
  ]);
  const returned = await state(bob.token, initial.etag);
  assert.equal(returned.status, 200);
  assert.equal(parseSidebarState(returned.body).sleepHitCount, 2);
  assert.deepEqual(returned.body.attacks, []);
  assert.equal((await state(bob.token, returned.etag)).status, 304);
  assert.equal((await state(bob.token)).body.sleepHitCount, 2);
  assert.equal((await attack()).status, 201);
  assert.equal((await state(bob.token)).body.sleepHitCount, 2);

  now += ONLINE_TIMEOUT_MS;
  // Returning through the presence endpoint must also finish the absence.
  await hideBob();
  assert.equal((await state(bob.token)).body.sleepHitCount, 0);
  now += ONLINE_TIMEOUT_MS;
  await state(alice.token);
  assert.equal((await attack()).status, 201);
  await hideBob();
  assert.equal((await state(bob.token)).body.sleepHitCount, 1);
  assert.equal((await state(bob.token)).body.sleepHitCount, 1);
  now += ONLINE_TIMEOUT_MS;
  assert.equal((await state(bob.token)).body.sleepHitCount, 0);
});
