import assert from "node:assert/strict";
import { once } from "node:events";
import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import {
  ATTACK_COOLDOWN_MS,
  ATTACK_TTL_MS,
  ONLINE_TIMEOUT_MS,
  parseAttackEvent,
  parseSidebarState,
} from "@wappy/api";
import { createApp } from "./server.ts";

test(
  "online attacks authenticate, reach only both participants, expire, and revoke with the friendship",
  { timeout: 10_000 },
  async (t) => {
    const directory = mkdtempSync(join(tmpdir(), "wappy-attacks-"));
    const databasePath = join(directory, "test.sqlite");
    let now = 1_800_000_000_000;
    let server = createApp({ databasePath, now: () => now });
    async function close() {
      const done = once(server, "close");
      server.close();
      await done;
    }
    t.after(async () => {
      await close();
      rmSync(directory, { recursive: true, force: true });
    });
    // Exercise the real HTTP handler, streams, authentication and SQLite without opening a port.
    function call(
      path: string,
      token?: string,
      body?: unknown,
      etag?: string,
      method?: string,
    ): Promise<{ status: number; body: any; etag: string }> {
      return new Promise((resolve) => {
        const socket = new Socket();
        const req = new IncomingMessage(socket);
        req.method = method ?? (body === undefined ? "GET" : "POST");
        req.url = path;
        req.headers = {
          origin: "http://localhost:1420",
          "content-type": "application/json",
          ...(token ? { authorization: `Bearer ${token}` } : {}),
          ...(etag ? { "if-none-match": etag } : {}),
        };
        if (body !== undefined) req.push(Buffer.from(JSON.stringify(body)));
        req.push(null);
        const res = new ServerResponse(req);
        res.end = ((data?: string) => {
          resolve({
            status: res.statusCode,
            body: data ? JSON.parse(String(data)) : null,
            etag: String(res.getHeader("ETag") ?? ""),
          });
          socket.destroy();
          return res;
        }) as typeof res.end;
        server.emit("request", req, res);
      });
    }
    async function create(name: string) {
      return (
        await call("/session", undefined, {
          name,
          character: "chiikawa",
          status: "",
        })
      ).body;
    }
    async function connect(a: string, b: string) {
      const invite = (await call("/invites", a, {})).body;
      assert.equal((await call("/invites/accept", b, invite)).status, 200);
    }
    const a = await create("A"),
      b = await create("B"),
      c = await create("C");
    await connect(a.token, b.token);
    await connect(a.token, c.token);
    await connect(b.token, c.token);
    const beforeB = await call("/state", b.token),
      beforeC = await call("/state", c.token);
    assert.deepEqual(parseSidebarState(beforeB.body).attacks, []);
    assert.ok(beforeB.etag);
    assert.equal(
      (await call("/friends/attack", undefined, { friendId: b.profile.id }))
        .status,
      401,
    );
    for (const friendId of [null, "", 10, "x".repeat(129)])
      assert.equal(
        (await call("/friends/attack", a.token, { friendId })).status,
        400,
      );
    for (const friendId of [a.profile.id, "missing"])
      assert.equal(
        (await call("/friends/attack", a.token, { friendId })).status,
        404,
      );
    const sent = await call("/friends/attack", a.token, {
      friendId: b.profile.id,
      attackerId: c.profile.id,
    });
    assert.equal(sent.status, 201);
    const event = parseAttackEvent(sent.body);
    assert.equal(event.attackerId, a.profile.id);
    assert.equal(event.targetId, b.profile.id);
    for (const token of [a.token, b.token])
      assert.deepEqual(
        parseSidebarState((await call("/state", token)).body).attacks,
        [event],
      );
    assert.deepEqual(
      parseSidebarState((await call("/state", c.token)).body).attacks,
      [],
    );
    assert.equal(
      (await call("/state", b.token, undefined, beforeB.etag)).status,
      200,
    );
    assert.equal(
      (await call("/state", c.token, undefined, beforeC.etag)).status,
      304,
    );
    assert.equal(
      (await call("/friends/attack", a.token, { friendId: c.profile.id }))
        .status,
      429,
    );
    await close();
    server = createApp({ databasePath, now: () => now });
    await call("/state", a.token);
    await call("/state", b.token);
    assert.equal(
      (await call("/friends/attack", a.token, { friendId: b.profile.id }))
        .status,
      429,
      "cooldown survives restart",
    );
    now += ATTACK_COOLDOWN_MS;
    const concurrent = await Promise.all([
      call("/friends/attack", a.token, { friendId: b.profile.id }),
      call("/friends/attack", a.token, { friendId: b.profile.id }),
    ]);
    assert.deepEqual(
      concurrent.map((result) => result.status).sort(),
      [201, 429],
    );
    const cached = await call("/state", b.token);
    now += ATTACK_TTL_MS;
    const expired = await call("/state", b.token, undefined, cached.etag);
    assert.equal(expired.status, 200);
    assert.deepEqual(parseSidebarState(expired.body).attacks, []);
    await call("/presence", b.token, { sharing: false }, undefined, "PATCH");
    assert.equal(
      (await call("/friends/attack", a.token, { friendId: b.profile.id }))
        .status,
      409,
    );
    await call("/presence", b.token, { sharing: true }, undefined, "PATCH");
    await call("/presence", a.token, { sharing: false }, undefined, "PATCH");
    assert.equal(
      (await call("/friends/attack", a.token, { friendId: b.profile.id }))
        .status,
      409,
    );
    await call("/presence", a.token, { sharing: true }, undefined, "PATCH");
    now += ONLINE_TIMEOUT_MS;
    await call("/state", a.token);
    assert.equal(
      (await call("/friends/attack", a.token, { friendId: b.profile.id }))
        .status,
      409,
      "offline targets cannot be attacked",
    );
    await call("/state", b.token);
    assert.equal(
      (await call("/friends/attack", a.token, { friendId: b.profile.id }))
        .status,
      201,
    );
    await call("/friends/block", b.token, { friendId: a.profile.id });
    assert.equal(
      (await call("/friends/attack", a.token, { friendId: b.profile.id }))
        .status,
      404,
    );
    assert.deepEqual(
      parseSidebarState((await call("/state", a.token)).body).attacks,
      [],
    );
    await call("/friends/unblock", b.token, { friendId: a.profile.id });
    await connect(a.token, b.token);
    assert.deepEqual(
      parseSidebarState((await call("/state", b.token)).body).attacks,
      [],
    );
    now += ATTACK_COOLDOWN_MS;
    assert.equal(
      (await call("/friends/attack", a.token, { friendId: b.profile.id }))
        .status,
      201,
    );
    await call("/friends/remove", a.token, { friendId: b.profile.id });
    await connect(a.token, b.token);
    assert.deepEqual(
      parseSidebarState((await call("/state", b.token)).body).attacks,
      [],
    );
    now += ATTACK_COOLDOWN_MS;
    assert.equal(
      (await call("/friends/attack", a.token, { friendId: b.profile.id }))
        .status,
      201,
    );
    assert.equal(
      (await call("/profile/delete", b.token, { profileId: b.profile.id }))
        .status,
      200,
    );
    assert.deepEqual(
      parseSidebarState((await call("/state", a.token)).body).attacks,
      [],
    );
    const db = new DatabaseSync(databasePath);
    assert.equal(
      db
        .prepare(
          "SELECT COUNT(*) AS count FROM attack_events WHERE attacker_id = ? OR target_id = ?",
        )
        .get(b.profile.id, b.profile.id)!.count,
      0,
    );
    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
    db.close();
  },
);
