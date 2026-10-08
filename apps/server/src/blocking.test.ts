import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { parseSidebarState } from "@wappy/api";
import { createApp } from "./server.ts";

test("profile blocks revoke delivery and invitations atomically, remain private, survive recovery, and unblock without restoring history", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "wappy-blocking-"));
  const databasePath = join(directory, "app.sqlite");
  let now = 1_800_000_000_000;
  let server = createApp({ databasePath, now: () => now });
  let base = "";
  let inspection: DatabaseSync | undefined;
  async function listen() {
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    base = `http://127.0.0.1:${address.port}`;
  }
  async function close() {
    if (!server.listening) return;
    const closed = once(server, "close");
    server.close();
    server.closeAllConnections();
    await closed;
  }
  t.after(async () => {
    inspection?.close();
    await close();
    rmSync(directory, { recursive: true, force: true });
  });
  await listen();
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
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return {
      status: response.status,
      etag: response.headers.get("ETag")!,
      body: response.status === 304 ? null : await response.json(),
    };
  }
  async function state(token: string) {
    const response = await call("/state", token);
    assert.equal(response.status, 200);
    return parseSidebarState(response.body);
  }
  async function create(name: string) {
    return (
      await call("/session", undefined, { name, character: "cat", status: "" })
    ).body;
  }
  async function invite(token: string) {
    return (await call("/invites", token, {})).body;
  }
  async function connect(a: string, b: string) {
    assert.equal(
      (await call("/invites/accept", b, await invite(a))).status,
      200,
    );
  }
  async function send(token: string, friendId?: string) {
    now += 1001;
    const result = await call(friendId ? "/chat/direct" : "/chat", token, {
      text: "함께",
      ...(friendId ? { friendId } : {}),
    });
    assert.equal(result.status, 201);
    return result.body;
  }
  const alice = await create("Alice"),
    bob = await create("Bob"),
    carol = await create("Carol");
  await connect(alice.token, bob.token);
  await connect(alice.token, carol.token);
  await connect(bob.token, carol.token);
  const broadcast = await send(bob.token);
  await send(bob.token, alice.profile.id);
  await send(alice.token, bob.profile.id);
  await call("/friends/wave", bob.token, { friendId: alice.profile.id });
  // Model upgrading a database from before blocking existed.
  await close();
  const legacy = new DatabaseSync(databasePath);
  legacy.exec("DROP TABLE profile_blocks; DROP TABLE blocking_settings;");
  legacy.close();
  server = createApp({ databasePath, now: () => now });
  await listen();
  assert.equal((await state(alice.token)).friends.length, 2);
  assert.deepEqual((await state(alice.token)).blocking, {
    revision: 0,
    profiles: [],
  });
  const fromAlice = await invite(alice.token),
    fromBob = await invite(bob.token);
  for (const path of ["/friends/block", "/friends/unblock"]) {
    assert.equal(
      (await call(path, undefined, { friendId: bob.profile.id })).status,
      401,
    );
    for (const friendId of [null, "", 12, "x".repeat(129)])
      assert.equal((await call(path, alice.token, { friendId })).status, 400);
  }
  assert.equal(
    (await call("/friends/block", alice.token, { friendId: alice.profile.id }))
      .status,
    400,
  );
  assert.equal(
    (await call("/friends/block", alice.token, { friendId: "missing" })).status,
    404,
  );
  // Failure anywhere in disconnecting must also undo the newly inserted block.
  inspection = new DatabaseSync(databasePath);
  inspection.exec(
    "CREATE TRIGGER fail_disconnect BEFORE DELETE ON friendships BEGIN SELECT RAISE(ABORT, 'test rollback'); END;",
  );
  const logged = t.mock.method(console, "error", () => {});
  assert.equal(
    (await call("/friends/block", alice.token, { friendId: bob.profile.id }))
      .status,
    500,
  );
  logged.mock.restore();
  inspection.exec("DROP TRIGGER fail_disconnect");
  assert.equal((await state(alice.token)).friends.length, 2);
  assert.equal((await state(alice.token)).messages?.length, 3);
  assert.deepEqual((await state(alice.token)).blocking, {
    revision: 0,
    profiles: [],
  });
  const beforeAlice = await call("/state", alice.token),
    beforeBob = await call("/state", bob.token),
    beforeCarol = await call("/state", carol.token);
  const blocked = await call("/friends/block", alice.token, {
    friendId: bob.profile.id,
    userId: carol.profile.id,
  });
  assert.equal(blocked.status, 200);
  assert.deepEqual(blocked.body, {
    revision: 1,
    profiles: [{ id: bob.profile.id, name: "Bob", character: "cat" }],
  });
  const afterAlice = await state(alice.token),
    afterBob = await state(bob.token);
  assert.deepEqual(afterAlice.blocking, blocked.body);
  assert.deepEqual(afterBob.blocking, { revision: 0, profiles: [] });
  assert.deepEqual(
    afterAlice.friends.map((friend) => friend.id),
    [carol.profile.id],
  );
  assert.deepEqual(
    afterBob.friends.map((friend) => friend.id),
    [carol.profile.id],
  );
  assert.deepEqual(afterAlice.messages, []);
  assert.deepEqual(afterAlice.unreadChatIds, []);
  assert.equal(
    afterAlice.friends.some((friend) => friend.wave),
    false,
  );
  assert.deepEqual(afterBob.messages, [broadcast]);
  assert.deepEqual((await state(carol.token)).messages, [broadcast]);
  assert.equal(
    (await call("/state", alice.token, undefined, "GET", beforeAlice.etag))
      .status,
    200,
  );
  assert.equal(
    (await call("/state", bob.token, undefined, "GET", beforeBob.etag)).status,
    200,
  );
  assert.equal(
    (await call("/state", carol.token, undefined, "GET", beforeCarol.etag))
      .status,
    304,
  );
  for (const [token, friendId] of [
    [alice.token, bob.profile.id],
    [bob.token, alice.profile.id],
  ]) {
    assert.equal(
      (await call("/friends/wave", token, { friendId })).status,
      404,
    );
    assert.equal(
      (await call("/chat/direct", token, { friendId, text: "차단 후" })).status,
      404,
    );
  }
  assert.equal(
    (await call("/invites/accept", bob.token, fromAlice)).status,
    409,
  );
  assert.equal(
    (await call("/invites/accept", alice.token, fromBob)).status,
    409,
  );
  const later = await send(bob.token);
  assert.deepEqual((await state(alice.token)).messages, []);
  assert.deepEqual((await state(carol.token)).messages, [broadcast, later]);
  await call(
    "/profile",
    bob.token,
    { name: "Changed", character: "frog", status: "private update" },
    "PATCH",
  );
  assert.deepEqual(
    (await call("/friends/block", alice.token, { friendId: bob.profile.id }))
      .body,
    blocked.body,
    "repeated blocking does not reveal profile changes or alter the revision",
  );
  assert.deepEqual((await state(alice.token)).blocking, blocked.body);
  await close();
  server = createApp({ databasePath, now: () => now });
  await listen();
  const recovery = (await call("/recovery-code", alice.token, {})).body;
  alice.token = (
    await call("/session/recover", undefined, recovery)
  ).body.token;
  assert.deepEqual((await state(alice.token)).blocking, blocked.body);
  assert.equal(
    (await call("/invites/accept", bob.token, fromAlice)).status,
    409,
  );
  assert.deepEqual(
    (await call("/friends/unblock", bob.token, { friendId: alice.profile.id }))
      .body,
    { revision: 0, profiles: [] },
    "only the blocker can remove their block",
  );
  await call("/friends/block", bob.token, { friendId: alice.profile.id });
  const unblocked = await call("/friends/unblock", alice.token, {
    friendId: bob.profile.id,
  });
  assert.deepEqual(unblocked.body, { revision: 2, profiles: [] });
  assert.deepEqual(
    (await call("/friends/unblock", alice.token, { friendId: bob.profile.id }))
      .body,
    unblocked.body,
  );
  assert.deepEqual(
    (await state(alice.token)).friends.map((friend) => friend.id),
    [carol.profile.id],
  );
  assert.equal(
    (await call("/invites/accept", bob.token, fromAlice)).status,
    409,
    "a reverse-direction block still prevents connection",
  );
  await call("/friends/unblock", bob.token, { friendId: alice.profile.id });
  assert.equal(
    (await call("/invites/accept", bob.token, fromAlice)).status,
    200,
    "failed blocked accepts never consume invitations",
  );
  assert.deepEqual(
    (await state(alice.token)).messages,
    [],
    "reconnecting does not restore revoked history",
  );
  const fresh = await send(bob.token, alice.profile.id);
  assert.deepEqual((await state(alice.token)).messages, [fresh]);
  await call("/friends/block", alice.token, { friendId: bob.profile.id });
  assert.equal((await state(alice.token)).blocking?.revision, 3);
  await call("/profile/delete", bob.token, { profileId: bob.profile.id });
  assert.deepEqual(
    (await state(alice.token)).blocking,
    { revision: 4, profiles: [] },
    "deleting a blocked profile also advances the private list revision",
  );
  assert.equal(
    inspection.prepare("SELECT COUNT(*) AS count FROM profile_blocks").get()!
      .count,
    0,
  );
  assert.deepEqual(inspection.prepare("PRAGMA foreign_key_check").all(), []);
});
