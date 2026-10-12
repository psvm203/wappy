import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import {
  CHARACTERS,
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

test("proxy rate limits require opt-in and use only the last valid forwarded address", async () => {
  for (const trustProxy of [false, true]) {
    const server = createApp({ databasePath: ":memory:", trustProxy });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    async function call(forwarded?: string) {
      const response = await fetch(`http://127.0.0.1:${address.port}/session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(forwarded === undefined ? {} : { "X-Forwarded-For": forwarded }),
        },
        body: "{}",
      });
      await response.body?.cancel();
      return response.status;
    }
    try {
      for (let i = 0; i < 10; i++)
        assert.equal(await call(`192.0.2.${i}, 198.51.100.1`), 400);
      assert.equal(await call("203.0.113.1, 198.51.100.1"), 429);
      assert.equal(await call("198.51.100.2"), trustProxy ? 400 : 429);
      assert.equal(await call("2001:db8::1"), trustProxy ? 400 : 429);
      if (trustProxy) {
        // Invalid/missing final addresses share the socket address's allowance;
        // never fall back to an attacker-controlled earlier address in the list.
        for (let i = 0; i < 10; i++)
          assert.equal(await call(`192.0.2.${i}, invalid-${i}`), 400);
        assert.equal(await call("198.51.100.3, unknown"), 429);
        assert.equal(await call("198.51.100.4,"), 429);
      }
      assert.equal(await call(), 429);
    } finally {
      const closed = once(server, "close");
      server.close();
      server.closeAllConnections();
      await closed;
    }
  }
});

test("public invitation previews are read-only, bounded and reveal only invitation display data", async () => {
  const directory = mkdtempSync(join(tmpdir(), "wappy-preview-"));
  const databasePath = join(directory, "test.sqlite");
  let time = Date.now();
  const server = createApp({ databasePath, now: () => time });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  const inspection = new DatabaseSync(databasePath);
  async function call(
    path: string,
    body?: unknown,
    token?: string,
    method = body === undefined ? "GET" : "POST",
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
  const preview = (code: string) => call("/invites/preview", { code });
  const snapshot = () =>
    ["users", "friendships", "invites", "presence_settings", "waves"].map(
      (table) =>
        inspection.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all(),
    );
  try {
    const input = {
      name: "Alice",
      character: "rakko",
    };
    const alice = (await call("/session", input)).body as Session;
    const bob = (await call("/session", { ...input, name: "Bob" }))
      .body as Session;
    const invite = (await call("/invites", {}, alice.token)).body as Invite;
    assert.equal(
      (await call("/invites/accept", invite, bob.token)).status,
      200,
    );
    const available = (await call("/invites", {}, alice.token)).body as Invite;
    time += ONLINE_TIMEOUT_MS;
    const before = snapshot();
    for (let i = 0; i < 2; i++)
      assert.deepEqual(await preview(available.code), {
        status: 200,
        body: {
          name: "Alice",
          character: "rakko",
          expiresAt: available.expiresAt,
        },
      });
    assert.deepEqual(
      snapshot(),
      before,
      "preview does not consume or change server data",
    );
    const state = (await call("/state", undefined, bob.token))
      .body as SidebarState;
    assert.equal(
      state.friends[0]?.online,
      false,
      "preview does not keep the inviter online",
    );
    await call("/presence", { sharing: false }, alice.token, "PATCH");
    await call(
      "/profile",
      { ...input, name: "Alicia", character: "chiikawa" },
      alice.token,
      "PATCH",
    );
    assert.deepEqual((await preview(available.code)).body, {
      name: "Alicia",
      character: "chiikawa",
      expiresAt: available.expiresAt,
    });
    assert.equal(
      (await call("/state", undefined, bob.token)).body.friends[0].online,
      false,
    );
    assert.equal((await call("/state")).status, 401);
    assert.equal((await call("/invites", {})).status, 401);
    assert.equal((await preview("")).status, 400);
    assert.equal((await preview("x".repeat(43))).status, 404);
    const blocked = await fetch(base + "/invites/preview", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://untrusted.test",
      },
      body: JSON.stringify(available),
    });
    assert.equal(blocked.status, 403);
    await blocked.body?.cancel();
    const carol = (await call("/session", { ...input, name: "Carol" }))
      .body as Session;
    assert.equal(
      (await call("/invites/accept", available, carol.token)).status,
      200,
      "preview leaves the code usable",
    );
    assert.equal(
      (await preview(available.code)).status,
      404,
      "consumed codes cannot reveal a profile",
    );
    const old = (await call("/invites", {}, alice.token)).body as Invite;
    const replacement = (await call("/invites", {}, alice.token))
      .body as Invite;
    assert.equal((await preview(old.code)).status, 404);
    time = replacement.expiresAt;
    assert.equal(
      (await preview(replacement.code)).status,
      404,
      "expiry applies without waiting for housekeeping",
    );
    time += 60_001;
    for (let i = 0; i < 60; i++)
      assert.equal((await preview("x".repeat(43))).status, 404);
    assert.equal((await preview("x".repeat(43))).status, 429);
    assert.equal(
      (await call("/session", { ...input, name: "Dave" })).status,
      201,
      "previews do not consume the session creation allowance",
    );
    assert.equal(
      (await call("/invites", {}, bob.token)).status,
      201,
      "previews do not consume the write allowance",
    );
    time += 60_001;
    assert.equal((await preview("x".repeat(43))).status, 404);
  } finally {
    inspection.close();
    const closed = once(server, "close");
    server.close();
    server.closeAllConnections();
    await closed;
    rmSync(directory, { recursive: true, force: true });
  }
});

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
    character: "usagi",
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
          name: "x".repeat(25),
        })
      ).status,
      400,
    );
    const aliceResponse = await call("POST", "/session", undefined, {
      ...input(" Alice "),
      status: "legacy status",
    });
    assert.equal(aliceResponse.status, 201);
    const alice = aliceResponse.body as Session;
    const bob = (await call("POST", "/session", undefined, input("Bob")))
      .body as Session;
    const carol = (await call("POST", "/session", undefined, input("Carol")))
      .body as Session;
    assert.deepEqual(alice.profile, {
      id: alice.profile.id,
      ...input("Alice"),
    });
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

    for (const character of CHARACTERS) {
      assert.equal(
        (
          await call("PATCH", "/profile", bob.token, {
            ...input("Bobby"),
            character,
          })
        ).status,
        200,
      );
      const updated = (await call("GET", "/state", alice.token))
        .body as SidebarState;
      assert.equal(updated.friends[0]?.character, character);
      assert.equal(updated.friends[0]?.name, "Bobby");
    }
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

test("startup removes recovery codes and retired profile fields while preserving existing accounts", async () => {
  const directory = mkdtempSync(join(tmpdir(), "wappy-migration-"));
  const databasePath = join(directory, "test.sqlite");
  const token = "a".repeat(43);
  const code = `wappy-recovery-${"c".repeat(43)}`;
  const hash = (value: string) =>
    createHash("sha256").update(value).digest("hex");
  const legacy = new DatabaseSync(databasePath);
  legacy.exec(`
    CREATE TABLE users (
      id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL, character TEXT NOT NULL, status TEXT NOT NULL
    ) STRICT;
    CREATE TABLE recovery_codes (
      code_hash TEXT PRIMARY KEY, owner_id TEXT NOT NULL UNIQUE REFERENCES users(id)
    ) STRICT;
    CREATE TABLE friendships (
      user_id TEXT NOT NULL REFERENCES users(id),
      friend_id TEXT NOT NULL REFERENCES users(id),
      PRIMARY KEY (user_id, friend_id), CHECK (user_id < friend_id)
    ) STRICT;
    CREATE TABLE invites (
      code_hash TEXT PRIMARY KEY, owner_id TEXT NOT NULL UNIQUE REFERENCES users(id),
      expires_at INTEGER NOT NULL
    ) STRICT;
  `);
  legacy
    .prepare("INSERT INTO users VALUES (?, ?, ?, ?, ?)")
    .run("alice", hash(token), "Alice", "hachiware", "친구들과 함께");
  legacy
    .prepare("INSERT INTO users VALUES (?, ?, ?, ?, ?)")
    .run("bob", hash("b".repeat(43)), "Bob", "shisa", "안녕");
  legacy
    .prepare("INSERT INTO recovery_codes VALUES (?, ?)")
    .run(hash(code), "alice");
  legacy.exec("INSERT INTO friendships VALUES ('alice', 'bob')");
  legacy
    .prepare("INSERT INTO invites VALUES (?, ?, ?)")
    .run(hash("i".repeat(43)), "alice", Date.now() + INVITE_TTL_MS);
  legacy.close();
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const server = createApp({ databasePath });
      try {
        server.listen(0, "127.0.0.1");
        await once(server, "listening");
        const address = server.address();
        assert.ok(address && typeof address !== "string");
        const base = `http://127.0.0.1:${address.port}`;
        for (const path of ["/recovery-code", "/session/recover"]) {
          for (const authenticated of [false, true]) {
            const response = await fetch(base + path, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(authenticated ? { Authorization: `Bearer ${token}` } : {}),
              },
              body: JSON.stringify({ code }),
            });
            assert.equal(response.status, authenticated ? 404 : 401);
            assert.deepEqual(Object.keys(await response.json()), ["error"]);
          }
        }
        const response = await fetch(base + "/state", {
          headers: { Authorization: `Bearer ${token}` },
        });
        assert.equal(response.status, 200);
        const state = (await response.json()) as SidebarState;
        assert.deepEqual(state.self, {
          id: "alice",
          name: "Alice",
          character: "hachiware",
        });
        assert.deepEqual(state.friends, [
          { id: "bob", name: "Bob", character: "shisa", online: false },
        ]);
        const inspection = new DatabaseSync(databasePath, { readOnly: true });
        try {
          assert.equal(
            inspection
              .prepare(
                "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'recovery_codes'",
              )
              .get(),
            undefined,
          );
          assert.equal(
            inspection
              .prepare("PRAGMA table_info(users)")
              .all()
              .some((column) => column.name === "status"),
            false,
          );
          assert.equal(
            inspection
              .prepare("SELECT token_hash FROM users WHERE id = 'alice'")
              .get()?.token_hash,
            hash(token),
          );
          assert.equal(
            inspection
              .prepare("SELECT owner_id FROM invites WHERE code_hash = ?")
              .get(hash("i".repeat(43)))?.owner_id,
            "alice",
          );
          assert.deepEqual(
            inspection.prepare("PRAGMA foreign_key_check").all(),
            [],
          );
        } finally {
          inspection.close();
        }
      } finally {
        const closed = once(server, "close");
        server.close();
        server.closeAllConnections();
        await closed;
      }
    }
  } finally {
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
        character: "hachiware",
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

    time += WAVE_TTL_MS - 1;
    assert.deepEqual((await state(bob)).friends[0]?.wave, third);
    time += 1;
    assert.equal((await state(bob)).friends[0]?.wave, undefined);
    assert.equal((await state(alice)).friends[0]?.wave, undefined);
    assert.equal((await send(alice, bob)).status, 201);
    assert.equal((await send(bob, alice)).status, 201);
    assert.equal(
      (
        await call("/friends/remove", bob.token, {
          friendId: alice.profile.id,
        })
      ).status,
      200,
    );
    assert.equal((await send(alice, bob)).status, 404);
    assert.deepEqual((await state(alice)).friends, []);
    await connect(alice, bob);
    assert.equal((await state(alice)).friends[0]?.wave, undefined);
    assert.equal(
      (await state(bob)).friends[0]?.wave,
      undefined,
      "reconnecting must not restore removed greetings",
    );
  } finally {
    if (server.listening) await close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("presence sharing stays private and hidden through polling, profile edits, restart", async () => {
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
        character: "hachiware",
      })
    ).body as Session;
    const bob = (
      await call("POST", "/session", undefined, {
        name: "Bob",
        character: "shisa",
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
        ["character", "id", "name", "online"],
        "friends cannot distinguish hidden presence from being offline",
      );
    }
    const updated = await call("PATCH", "/profile", alice.token, {
      name: "Alicia",
      character: "chiikawa",
      status: "legacy status",
      sharing: true,
    });
    assert.equal(updated.status, 200);
    assert.deepEqual(updated.body, {
      id: alice.profile.id,
      name: "Alicia",
      character: "chiikawa",
    });
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
    await close();
    server = createApp({ databasePath, now: () => time });
    await listen();
    assert.deepEqual((await state(alice)).presence, hiddenAgain);
    assert.equal((await state(bob)).friends[0]?.online, false);
    const simultaneous = await Promise.all([
      share(alice, true),
      share(alice, false),
    ]);
    assert.ok(simultaneous.every((result) => result.status === 200));
    const settings = simultaneous
      .map((result) => result.body as { sharing: boolean; revision: number })
      .sort((a, b) => a.revision - b.revision);
    assert.equal(settings[1]!.revision, settings[0]!.revision + 1);
    assert.deepEqual((await state(alice)).presence, settings[1]);
    assert.equal((await state(bob)).friends[0]?.online, settings[1]!.sharing);
  } finally {
    if (server.listening) await close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test("the removed profile deletion endpoint leaves profiles and relationships intact", async () => {
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
          character: "hachiware",
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
    const bobInvite = (await call("POST", "/invites", bob.token, {}))
      .body as Invite;
    await call("PATCH", "/presence", alice.token, { sharing: false });
    await call("PATCH", "/presence", bob.token, { sharing: false });
    const inspection = new DatabaseSync(databasePath, { readOnly: true });
    try {
      const snapshot = () =>
        ["users", "friendships", "invites", "presence_settings", "waves"].map(
          (table) =>
            inspection.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all(),
        );
      const before = snapshot();
      for (const [token, profileId, expected] of [
        [undefined, alice.profile.id, 401],
        [alice.token, alice.profile.id, 404],
        [bob.token, alice.profile.id, 404],
        [alice.token, "", 404],
      ] as const) {
        const response = await call("POST", "/profile/delete", token, {
          profileId,
        });
        assert.equal(response.status, expected);
        assert.deepEqual(Object.keys(response.body), ["error"]);
        assert.deepEqual(snapshot(), before);
      }
      assert.deepEqual(
        inspection.prepare("PRAGMA foreign_key_check").all(),
        [],
      );
    } finally {
      inspection.close();
    }
    for (let attempt = 0; attempt < 2; attempt++) {
      for (const person of [alice, bob, carol]) {
        const response = await call("GET", "/state", person.token);
        assert.equal(response.status, 200);
        assert.deepEqual(response.body.self, person.profile);
        assert.equal(response.body.friends.length, 2);
      }
      assert.equal(
        (await call("POST", "/invites/preview", undefined, invite)).status,
        200,
      );
      assert.equal(
        (await call("POST", "/invites/preview", undefined, bobInvite)).status,
        200,
      );
      if (!attempt) {
        await close();
        server = createApp({ databasePath });
        await listen();
      }
    }
  } finally {
    if (server.listening) await close();
    rmSync(directory, { recursive: true, force: true });
  }
});
