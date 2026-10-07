import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { test } from "node:test";
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
