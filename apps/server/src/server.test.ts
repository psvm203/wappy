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
  WAVE_COOLDOWN_MS,
  WAVE_TTL_MS,
  type Session,
  type SidebarState,
  type Invite,
  type Wave,
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

test("greetings are private, bounded, durable and acknowledged without losing newer ones", async () => {
  const directory = mkdtempSync(join(tmpdir(), "wappy-waves-"));
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
  async function call(path: string, token?: string, body?: unknown) {
    const response = await fetch(base + path, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return {
      status: response.status,
      headers: response.headers,
      body: await response.json(),
    };
  }
  const state = async (user: Session) =>
    (await call("/state", user.token)).body as SidebarState;
  const send = (from: Session, to: Session) =>
    call("/friends/wave", from.token, { friendId: to.profile.id });
  const read = (user: Session, wave: Wave) =>
    call("/waves/read", user.token, { waveId: wave.id });
  async function connect(from: Session, to: Session) {
    const invite = (await call("/invites", from.token, {})).body as Invite;
    assert.equal(
      (await call("/invites/accept", to.token, { code: invite.code })).status,
      200,
    );
  }
  try {
    await listen();
    const people: Session[] = [];
    for (const name of ["Alice", "Bob", "Carol"]) {
      const created = await call("/session", undefined, {
        name,
        character: "cat",
        status: "",
      });
      assert.equal(created.status, 201);
      people.push(created.body as Session);
    }
    const [alice, bob, carol] = people as [Session, Session, Session];
    assert.equal(
      (await call("/friends/wave", undefined, { friendId: bob.profile.id }))
        .status,
      401,
    );
    assert.equal(
      (await call("/waves/read", undefined, { waveId: "unknown" })).status,
      401,
    );
    assert.equal(
      (await call("/friends/wave", alice.token, { friendId: [] })).status,
      400,
    );
    assert.equal((await call("/waves/read", bob.token, {})).status, 400);
    assert.equal((await send(alice, alice)).status, 404);
    assert.equal((await send(alice, bob)).status, 404);
    await connect(alice, bob);

    // Simulate the schema before greetings, preserving established profiles and friends.
    await close();
    const oldDatabase = new DatabaseSync(databasePath);
    oldDatabase.exec("DROP TABLE waves");
    oldDatabase.close();
    server = createApp({ databasePath, now: () => time });
    await listen();
    assert.equal((await state(alice)).friends[0]?.id, bob.profile.id);
    assert.equal((await state(alice)).friends[0]?.online, false);

    const results = await Promise.all([send(alice, bob), send(alice, bob)]);
    assert.deepEqual(results.map((result) => result.status).sort(), [201, 429]);
    assert.equal(
      results
        .find((result) => result.status === 429)
        ?.headers.get("Retry-After"),
      "30",
    );
    const first = results.find((result) => result.status === 201)!.body as Wave;
    assert.equal(first.sentAt, time);
    assert.equal(
      (await state(alice)).friends[0]?.wave,
      undefined,
      "outgoing greetings are not incoming greetings",
    );
    assert.deepEqual((await state(bob)).friends[0]?.wave, first);
    assert.deepEqual(
      (await state(bob)).friends[0]?.wave,
      first,
      "reading state does not consume a greeting",
    );
    assert.deepEqual((await state(carol)).friends, []);
    assert.equal((await send(carol, bob)).status, 404);
    await read(alice, first);
    await read(carol, first);
    assert.deepEqual(
      (await state(bob)).friends[0]?.wave,
      first,
      "only the recipient can acknowledge",
    );
    assert.equal((await read(bob, first)).status, 200);
    assert.equal((await read(bob, first)).status, 200);
    assert.equal((await state(bob)).friends[0]?.wave, undefined);
    time += WAVE_COOLDOWN_MS - 1;
    assert.equal(
      (await send(alice, bob)).status,
      429,
      "acknowledging does not reset the cooldown",
    );
    time += 1;
    const secondResponse = await send(alice, bob);
    assert.equal(secondResponse.status, 201);
    const second = secondResponse.body as Wave;
    time += WAVE_COOLDOWN_MS;
    const third = (await send(alice, bob)).body as Wave;
    assert.notEqual(third.id, second.id);
    await read(bob, second);
    assert.deepEqual(
      (await state(bob)).friends[0]?.wave,
      third,
      "a stale acknowledgement cannot erase the latest greeting",
    );
    const reverse = (await send(bob, alice)).body as Wave;
    assert.deepEqual((await state(alice)).friends[0]?.wave, reverse);
    const recovery = (await call("/recovery-code", bob.token, {})).body as {
      code: string;
    };

    await close();
    const database = new DatabaseSync(databasePath);
    assert.equal(
      database.prepare("SELECT count(*) AS count FROM waves").get()!.count,
      2,
      "at most one greeting per direction",
    );
    database.close();
    server = createApp({ databasePath, now: () => time });
    await listen();
    assert.deepEqual((await state(bob)).friends[0]?.wave, third);
    assert.equal(
      (await send(alice, bob)).status,
      429,
      "server restarts do not reset cooldowns",
    );
    const recovered = (await call("/session/recover", undefined, recovery))
      .body as Session;
    assert.equal((await call("/state", bob.token)).status, 401);
    assert.equal((await read(bob, third)).status, 401);
    assert.deepEqual((await state(recovered)).friends[0]?.wave, third);

    time += WAVE_TTL_MS - 1;
    assert.deepEqual((await state(recovered)).friends[0]?.wave, third);
    time += 1;
    assert.equal((await state(recovered)).friends[0]?.wave, undefined);
    assert.equal((await state(alice)).friends[0]?.wave, undefined);
    assert.equal((await send(alice, recovered)).status, 201);
    assert.equal((await send(recovered, alice)).status, 201);
    assert.equal(
      (
        await call("/friends/remove", recovered.token, {
          friendId: alice.profile.id,
        })
      ).status,
      200,
    );
    assert.equal((await send(alice, recovered)).status, 404);
    assert.deepEqual((await state(alice)).friends, []);
    await connect(alice, recovered);
    assert.equal((await state(alice)).friends[0]?.wave, undefined);
    assert.equal(
      (await state(recovered)).friends[0]?.wave,
      undefined,
      "reconnecting must not restore removed greetings",
    );
  } finally {
    if (server.listening) await close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("presence sharing stays private and hidden through polling, profile edits, restart and recovery", async () => {
  const directory = mkdtempSync(join(tmpdir(), "wappy-presence-"));
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
  const state = async (person: Session) =>
    (await call("GET", "/state", person.token)).body as SidebarState;
  const share = (person: Session, sharing: boolean) =>
    call("PATCH", "/presence", person.token, { sharing });
  try {
    await listen();
    const alice = (
      await call("POST", "/session", undefined, {
        name: "Alice",
        character: "cat",
        status: "",
      })
    ).body as Session;
    const bob = (
      await call("POST", "/session", undefined, {
        name: "Bob",
        character: "frog",
        status: "",
      })
    ).body as Session;
    const invite = (await call("POST", "/invites", alice.token, {}))
      .body as Invite;
    await call("POST", "/invites/accept", bob.token, { code: invite.code });
    // Upgrade a populated database that did not have private presence settings.
    await close();
    const old = new DatabaseSync(databasePath);
    old.exec("DROP TABLE presence_settings");
    old.close();
    server = createApp({ databasePath, now: () => time });
    await listen();
    assert.deepEqual((await state(alice)).presence, {
      sharing: true,
      revision: 0,
    });
    assert.deepEqual((await state(bob)).presence, {
      sharing: true,
      revision: 0,
    });
    assert.equal((await state(bob)).friends[0]?.online, true);
    assert.equal(
      (await call("PATCH", "/presence", undefined, { sharing: false })).status,
      401,
    );
    for (const body of [
      null,
      [],
      {},
      { sharing: "false" },
      { sharing: 0 },
      { sharing: null },
    ])
      assert.equal(
        (await call("PATCH", "/presence", alice.token, body)).status,
        400,
      );
    assert.deepEqual((await state(alice)).presence, {
      sharing: true,
      revision: 0,
    });

    const hidden = await call("PATCH", "/presence", alice.token, {
      sharing: false,
      userId: bob.profile.id,
      revision: 999,
    });
    assert.equal(hidden.status, 200);
    assert.deepEqual(hidden.body, { sharing: false, revision: 1 });
    for (let i = 0; i < 3; i++) {
      const own = await state(alice);
      assert.deepEqual(own.presence, hidden.body);
      assert.equal(
        own.friends[0]?.online,
        true,
        "hiding presence does not stop incoming presence",
      );
      const observer = await state(bob);
      assert.deepEqual(
        observer.presence,
        { sharing: true, revision: 0 },
        "only the authenticated profile is changed",
      );
      assert.equal(observer.friends[0]?.online, false);
      assert.deepEqual(
        Object.keys(observer.friends[0]!).sort(),
        ["character", "id", "name", "online", "status"],
        "friends cannot distinguish hidden presence from being offline",
      );
    }
    const updated = await call("PATCH", "/profile", alice.token, {
      name: "Alicia",
      character: "bear",
      status: "쉬는 중",
      sharing: true,
    });
    assert.equal(updated.status, 200);
    assert.deepEqual(
      (await state(alice)).presence,
      hidden.body,
      "old clients editing a profile must not reset privacy",
    );
    assert.equal((await state(bob)).friends[0]?.name, "Alicia");
    assert.equal((await state(bob)).friends[0]?.online, false);
    assert.equal(
      (
        await call("POST", "/friends/wave", bob.token, {
          friendId: alice.profile.id,
        })
      ).status,
      201,
    );
    assert.ok((await state(alice)).friends[0]?.wave);
    assert.equal(
      (
        await call("POST", "/friends/wave", alice.token, {
          friendId: bob.profile.id,
        })
      ).status,
      201,
    );
    assert.ok((await state(bob)).friends[0]?.wave);
    assert.equal(
      (await state(bob)).friends[0]?.online,
      false,
      "explicit greetings do not reset privacy",
    );

    assert.deepEqual((await share(alice, true)).body, {
      sharing: true,
      revision: 2,
    });
    assert.equal((await state(bob)).friends[0]?.online, true);
    time += ONLINE_TIMEOUT_MS;
    assert.equal(
      (await state(bob)).friends[0]?.online,
      false,
      "visible users still time out",
    );
    await state(alice);
    assert.equal((await state(bob)).friends[0]?.online, true);
    const hiddenAgain = (await share(alice, false)).body;
    const recovery = (await call("POST", "/recovery-code", alice.token, {}))
      .body as { code: string };
    await close();
    server = createApp({ databasePath, now: () => time });
    await listen();
    assert.deepEqual((await state(alice)).presence, hiddenAgain);
    assert.equal((await state(bob)).friends[0]?.online, false);
    const recovered = (
      await call("POST", "/session/recover", undefined, recovery)
    ).body as Session;
    assert.equal(
      (await share(alice, true)).status,
      401,
      "revoked sessions cannot publish presence",
    );
    assert.deepEqual((await state(recovered)).presence, hiddenAgain);
    assert.equal(
      (await state(bob)).friends[0]?.online,
      false,
      "recovery does not briefly expose a hidden profile",
    );

    const simultaneous = await Promise.all([
      share(recovered, true),
      share(recovered, false),
    ]);
    assert.ok(simultaneous.every((result) => result.status === 200));
    const settings = simultaneous
      .map((result) => result.body as { sharing: boolean; revision: number })
      .sort((a, b) => a.revision - b.revision);
    assert.equal(settings[1]!.revision, settings[0]!.revision + 1);
    assert.deepEqual((await state(recovered)).presence, settings[1]);
    assert.equal((await state(bob)).friends[0]?.online, settings[1]!.sharing);
  } finally {
    if (server.listening) await close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("profile deletion is authenticated, atomic, durable and limited to the confirmed identity", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "wappy-delete-"));
  const databasePath = join(directory, "test.sqlite");
  let server = createApp({ databasePath });
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
  try {
    await listen();
    const create = async (name: string) =>
      (
        await call("POST", "/session", undefined, {
          name,
          character: "cat",
          status: "",
        })
      ).body as Session;
    const alice = await create("Alice");
    const bob = await create("Bob");
    const carol = await create("Carol");
    for (const [from, to] of [
      [alice, bob],
      [alice, carol],
      [bob, carol],
    ] as const) {
      const invite = (await call("POST", "/invites", from.token, {}))
        .body as Invite;
      assert.equal(
        (await call("POST", "/invites/accept", to.token, { code: invite.code }))
          .status,
        200,
      );
    }
    for (const [from, to] of [
      [alice, bob],
      [bob, alice],
      [bob, carol],
    ] as const)
      assert.equal(
        (
          await call("POST", "/friends/wave", from.token, {
            friendId: to.profile.id,
          })
        ).status,
        201,
      );
    const invite = (await call("POST", "/invites", alice.token, {}))
      .body as Invite;
    const recovery = (await call("POST", "/recovery-code", alice.token, {}))
      .body;
    const bobRecovery = (await call("POST", "/recovery-code", bob.token, {}))
      .body;
    const bobInvite = (await call("POST", "/invites", bob.token, {}))
      .body as Invite;
    await call("PATCH", "/presence", alice.token, { sharing: false });
    await call("PATCH", "/presence", bob.token, { sharing: false });
    const remove = (token?: string, profileId = alice.profile.id) =>
      call("POST", "/profile/delete", token, { profileId });
    assert.equal((await remove()).status, 401);
    assert.equal(
      (await remove(bob.token)).status,
      409,
      "another profile cannot be targeted",
    );
    assert.equal((await remove(alice.token, "")).status, 400);

    const inspection = new DatabaseSync(databasePath);
    try {
      const tables = [
        "users",
        "friendships",
        "invites",
        "recovery_codes",
        "presence_settings",
        "waves",
      ];
      const snapshot = () =>
        tables.map((table) =>
          inspection.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all(),
        );
      const before = snapshot();
      inspection.exec(
        "CREATE TRIGGER prevent_delete BEFORE DELETE ON users BEGIN SELECT RAISE(ABORT, 'test rollback'); END;",
      );
      const logging = t.mock.method(console, "error", () => {});
      try {
        assert.equal((await remove(alice.token)).status, 500);
      } finally {
        logging.mock.restore();
      }
      assert.deepEqual(
        snapshot(),
        before,
        "failed deletion must restore friends, greetings and credentials",
      );
      inspection.exec("DROP TRIGGER prevent_delete");

      const pending = httpRequest(base + "/recovery-code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${alice.token}`,
        },
      });
      const responsePromise = once(pending, "response");
      const arrived = once(server, "request");
      pending.write("{");
      await arrived;
      assert.deepEqual(await remove(alice.token), {
        status: 200,
        body: { ok: true },
      });
      pending.end("}");
      const [rejected] = await responsePromise;
      assert.equal(
        rejected.statusCode,
        401,
        "a pending write cannot recreate deleted credentials",
      );
      rejected.resume();
      assert.equal(
        JSON.stringify(snapshot()).includes(alice.profile.id),
        false,
      );
      assert.equal(
        inspection.prepare("SELECT COUNT(*) AS count FROM users").get()!.count,
        2,
      );
      assert.equal(
        inspection.prepare("SELECT COUNT(*) AS count FROM friendships").get()!
          .count,
        1,
      );
      assert.equal(
        inspection.prepare("SELECT COUNT(*) AS count FROM waves").get()!.count,
        1,
      );
      assert.deepEqual(
        inspection.prepare("PRAGMA foreign_key_check").all(),
        [],
      );
    } finally {
      inspection.close();
    }

    for (let attempt = 0; attempt < 2; attempt++) {
      assert.equal((await call("GET", "/state", alice.token)).status, 401);
      assert.equal((await remove(alice.token)).status, 401);
      assert.equal(
        (await call("POST", "/session/recover", undefined, recovery)).status,
        401,
      );
      assert.equal(
        (await call("POST", "/invites/accept", carol.token, invite)).status,
        404,
      );
      const remaining = (await call("GET", "/state", carol.token))
        .body as SidebarState;
      assert.deepEqual(
        remaining.friends.map((friend) => friend.id),
        [bob.profile.id],
      );
      assert.ok(
        remaining.friends[0]?.wave,
        "another pair's greeting is preserved",
      );
      if (!attempt) {
        await close();
        server = createApp({ databasePath });
        await listen();
      }
    }
    const restoredBob = (
      await call("POST", "/session/recover", undefined, bobRecovery)
    ).body as Session;
    assert.equal(restoredBob.profile.id, bob.profile.id);
    const dave = await create("Dave");
    assert.equal(
      (await call("POST", "/invites/accept", dave.token, bobInvite)).status,
      200,
    );
    assert.equal(
      ((await call("GET", "/state", restoredBob.token)).body as SidebarState)
        .presence?.sharing,
      false,
    );
  } finally {
    if (server.listening) await close();
    rmSync(directory, { recursive: true, force: true });
  }
});
