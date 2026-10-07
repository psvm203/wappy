import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { request as httpRequest } from "node:http";
import {
  INVITE_TTL_MS,
  ONLINE_TIMEOUT_MS,
  type Session,
  type SidebarState,
  type Invite,
} from "@wappy/api";
import { createApp } from "./server.ts";

test("profiles, invitations, presence and friendship persist safely end to end", async () => {
  const directory = mkdtempSync(join(tmpdir(), "wappy-test-"));
  const databasePath = join(directory, "test.sqlite");
  let time = Date.now();
  let server = createApp({ databasePath, now: () => time });
  let base = "";
  async function listen() {
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
  async function call(
    method: string,
    path: string,
    token?: string,
    body?: unknown,
  ) {
    const response = await fetch(base + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  }
  const input = (name: string) => ({
    name,
    character: "bunny",
    status: "함께 작업해요",
  });
  try {
    await listen();
    assert.equal((await call("GET", "/state")).status, 401);
    assert.equal(
      (
        await call("POST", "/session", undefined, {
          ...input("A"),
          character: "dragon",
        })
      ).status,
      400,
    );
    assert.equal(
      (await call("POST", "/session", undefined, input(" "))).status,
      400,
    );
    assert.equal(
      (
        await call("POST", "/session", undefined, {
          ...input("A"),
          status: "x".repeat(61),
        })
      ).status,
      400,
    );
    const aliceResponse = await call(
      "POST",
      "/session",
      undefined,
      input(" Alice "),
    );
    assert.equal(aliceResponse.status, 201);
    const alice = aliceResponse.body as Session;
    const bob = (await call("POST", "/session", undefined, input("Bob")))
      .body as Session;
    const carol = (await call("POST", "/session", undefined, input("Carol")))
      .body as Session;
    assert.equal(alice.profile.name, "Alice");
    assert.equal((await call("GET", "/state", "x".repeat(43))).status, 401);

    const oldInvite = (await call("POST", "/invites", alice.token, {}))
      .body as Invite;
    const invite = (await call("POST", "/invites", alice.token, {}))
      .body as Invite;
    assert.equal(invite.expiresAt, time + INVITE_TTL_MS);
    assert.equal(
      (
        await call("POST", "/invites/accept", bob.token, {
          code: oldInvite.code,
        })
      ).status,
      404,
    );
    assert.equal(
      (
        await call("POST", "/invites/accept", alice.token, {
          code: invite.code,
        })
      ).status,
      400,
    );
    const accepted = await call("POST", "/invites/accept", bob.token, {
      code: invite.code,
    });
    assert.equal(accepted.status, 200);
    assert.equal((accepted.body as { id: string }).id, alice.profile.id);
    assert.equal(
      (
        await call("POST", "/invites/accept", carol.token, {
          code: invite.code,
        })
      ).status,
      404,
    );
    const state = (await call("GET", "/state", alice.token))
      .body as SidebarState;
    assert.equal(state.friends[0]?.id, bob.profile.id);
    assert.equal(state.friends[0]?.online, true);
    assert.ok(!JSON.stringify(state).includes("token"));

    assert.equal(
      (
        await call("PATCH", "/profile", bob.token, {
          ...input("Bobby"),
          character: "frog",
        })
      ).status,
      200,
    );
    const updated = (await call("GET", "/state", alice.token))
      .body as SidebarState;
    assert.equal(updated.friends[0]?.character, "frog");
    assert.equal(updated.friends[0]?.name, "Bobby");
    const duplicate = (await call("POST", "/invites", alice.token, {}))
      .body as Invite;
    assert.equal(
      (
        await call("POST", "/invites/accept", bob.token, {
          code: duplicate.code,
        })
      ).status,
      409,
    );
    // A rejected redemption does not consume the invitation.
    assert.equal(
      (
        await call("POST", "/invites/accept", carol.token, {
          code: duplicate.code,
        })
      ).status,
      200,
    );

    time += ONLINE_TIMEOUT_MS + 1;
    const offline = (await call("GET", "/state", alice.token))
      .body as SidebarState;
    assert.ok(offline.friends.every((friend) => !friend.online));
    await call("GET", "/state", bob.token);
    const online = (await call("GET", "/state", alice.token))
      .body as SidebarState;
    assert.equal(
      online.friends.find((friend) => friend.id === bob.profile.id)?.online,
      true,
    );
    const expiring = (await call("POST", "/invites", bob.token, {}))
      .body as Invite;
    time += INVITE_TTL_MS;
    assert.equal(
      (
        await call("POST", "/invites/accept", carol.token, {
          code: expiring.code,
        })
      ).status,
      404,
    );

    const pending = (await call("POST", "/invites", bob.token, {}))
      .body as Invite;
    await close();
    server = createApp({ databasePath, now: () => time });
    await listen();
    const restored = (await call("GET", "/state", alice.token))
      .body as SidebarState;
    assert.equal(restored.friends.length, 2);
    assert.ok(restored.friends.every((friend) => !friend.online));
    assert.equal(
      (
        await call("POST", "/invites/accept", carol.token, {
          code: pending.code,
        })
      ).status,
      200,
    );
    // Carol cannot remove Alice's friendship with Bob.
    await call("POST", "/friends/remove", carol.token, {
      friendId: bob.profile.id,
    });
    assert.equal(
      ((await call("GET", "/state", alice.token)).body as SidebarState).friends
        .length,
      2,
    );
    await call("POST", "/friends/remove", bob.token, {
      friendId: alice.profile.id,
    });
    assert.equal(
      ((await call("GET", "/state", alice.token)).body as SidebarState).friends
        .length,
      1,
    );
    assert.equal(
      ((await call("GET", "/state", bob.token)).body as SidebarState).friends
        .length,
      0,
    );

    const blocked = await fetch(base + "/state", {
      headers: { Origin: "https://untrusted.example" },
    });
    assert.equal(blocked.status, 403);
    for (const origin of [
      "tauri://localhost",
      "http://tauri.localhost",
      "https://tauri.localhost",
      "http://localhost:1420",
    ]) {
      const preflight = await fetch(base + "/state", {
        method: "OPTIONS",
        headers: { Origin: origin },
      });
      assert.equal(preflight.status, 204);
      assert.equal(
        preflight.headers.get("Access-Control-Allow-Origin"),
        origin,
      );
    }
    const invalidJson = await fetch(base + "/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{",
    });
    assert.equal(invalidJson.status, 400);
    const large = await fetch(base + "/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input("x".repeat(5_000))),
    });
    assert.equal(large.status, 413);
    for (let i = 0; i < 10; i++)
      await call("POST", "/session", undefined, input(" "));
    assert.equal(
      (await call("POST", "/session", undefined, input("Limited"))).status,
      429,
    );
  } finally {
    if (server.listening) await close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("recovery preserves existing profiles, retries safely and revokes stale credentials", async () => {
  const directory = mkdtempSync(join(tmpdir(), "wappy-recovery-"));
  const databasePath = join(directory, "test.sqlite");
  const originalToken = "a".repeat(43);
  // Start from the schema shipped before recovery support, with an existing user.
  const legacy = new DatabaseSync(databasePath);
  legacy.exec(`CREATE TABLE users (
    id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL, character TEXT NOT NULL, status TEXT NOT NULL
  ) STRICT;`);
  legacy
    .prepare("INSERT INTO users VALUES (?, ?, ?, ?, ?)")
    .run(
      "original-user",
      createHash("sha256").update(originalToken).digest("hex"),
      "Alice",
      "cat",
      "친구들과 함께",
    );
  legacy.close();
  let time = Date.now();
  let server = createApp({ databasePath, now: () => time });
  let base = "";
  async function listen() {
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
  async function call(
    method: string,
    path: string,
    token?: string,
    body?: unknown,
  ) {
    const response = await fetch(base + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return {
      status: response.status,
      body: await response.json(),
      headers: response.headers,
    };
  }
  const recover = (code: string) =>
    call("POST", "/session/recover", undefined, { code });
  try {
    await listen();
    const before = (await call("GET", "/state", originalToken))
      .body as SidebarState;
    const bob = (
      await call("POST", "/session", undefined, {
        name: "Bob",
        character: "frog",
        status: "안녕",
      })
    ).body as Session;
    const invite = (await call("POST", "/invites", originalToken, {}))
      .body as Invite;
    assert.equal(
      (await call("POST", "/invites/accept", bob.token, { code: invite.code }))
        .status,
      200,
    );
    assert.equal(
      (await call("POST", "/recovery-code", undefined, {})).status,
      401,
    );
    assert.equal((await recover(invite.code)).status, 400);
    assert.equal(
      (await call("POST", "/session/recover", undefined, { code: [] })).status,
      400,
    );

    const oldCode = (await call("POST", "/recovery-code", originalToken, {}))
      .body.code as string;
    const issued = await call("POST", "/recovery-code", originalToken, {});
    assert.equal(issued.status, 201);
    assert.equal(issued.headers.get("cache-control"), "no-store");
    const code = issued.body.code as string;
    assert.match(code, /^wappy-recovery-[A-Za-z0-9_-]{43}$/);
    assert.notEqual(code, oldCode);
    assert.equal((await recover(oldCode)).status, 401);
    assert.equal(
      (await recover(`wappy-recovery-${"z".repeat(43)}`)).status,
      401,
    );
    assert.equal((await call("GET", "/state", originalToken)).status, 200);

    const inspection = new DatabaseSync(databasePath, { readOnly: true });
    try {
      const row = inspection.prepare("SELECT * FROM recovery_codes").get();
      assert.equal(
        row?.code_hash,
        createHash("sha256").update(code).digest("hex"),
      );
      assert.equal(row?.owner_id, before.self.id);
      const publicState = (await call("GET", "/state", bob.token)).body;
      assert.ok(!JSON.stringify(publicState).includes(code));
      assert.deepEqual(Object.keys(publicState.friends[0]).sort(), [
        "character",
        "id",
        "name",
        "online",
        "status",
      ]);
    } finally {
      inspection.close();
    }
    await close();
    server = createApp({ databasePath, now: () => time });
    await listen();

    // Hold a write after its headers arrive, then recover before completing its body.
    // The revoked token must not be allowed to issue a new recovery key.
    const pending = httpRequest(base + "/recovery-code", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${originalToken}`,
      },
    });
    const responsePromise = once(pending, "response");
    const arrived = once(server, "request");
    pending.write("{");
    await arrived;
    const restored = await recover(` ${code} `);
    assert.equal(restored.status, 200);
    const recovered = restored.body as Session;
    assert.deepEqual(recovered.profile, before.self);
    assert.notEqual(recovered.token, originalToken);
    pending.end("}");
    const [rejectedWrite] = await responsePromise;
    assert.equal(rejectedWrite.statusCode, 401);
    rejectedWrite.resume();
    assert.equal((await call("GET", "/state", originalToken)).status, 401);
    assert.equal(
      (
        await call("PATCH", "/profile", originalToken, {
          ...before.self,
          name: "stale change",
        })
      ).status,
      401,
    );
    assert.equal(
      (await call("POST", "/recovery-code", originalToken, {})).status,
      401,
    );
    const state = (await call("GET", "/state", recovered.token))
      .body as SidebarState;
    assert.equal(state.friends[0]?.id, bob.profile.id);
    assert.deepEqual(state.self, before.self);
    const friendsState = (await call("GET", "/state", bob.token))
      .body as SidebarState;
    assert.equal(friendsState.friends[0]?.id, before.self.id);

    // A dropped recovery response can be retried with the saved code.
    const retried = await recover(code);
    assert.equal(retried.status, 200);
    assert.equal((await call("GET", "/state", recovered.token)).status, 401);
    const replacement = (
      await call("POST", "/recovery-code", retried.body.token, {})
    ).body.code as string;
    assert.equal((await recover(code)).status, 401);
    assert.equal((await recover(replacement)).status, 200);

    // Unauthenticated attempts have the tighter session rate limit; reads still work.
    time += 60_000;
    for (let i = 0; i < 10; i++)
      assert.equal((await recover(oldCode)).status, 401);
    const limited = await recover(oldCode);
    assert.equal(limited.status, 429);
    assert.equal(limited.headers.get("retry-after"), "60");
    assert.equal((await call("GET", "/state", bob.token)).status, 200);
    time += 60_000;
    assert.equal((await recover(replacement)).status, 200);
  } finally {
    if (server.listening) await close();
    rmSync(directory, { recursive: true, force: true });
  }
});
