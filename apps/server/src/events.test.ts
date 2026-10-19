import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test, type TestContext } from "node:test";
import { parseSidebarState, type Session, type SidebarState } from "@wappy/api";
import { createApp } from "./server.ts";

async function fixture(t: TestContext) {
  let now = 1_800_000_000_000;
  const directory = mkdtempSync(join(tmpdir(), "wappy-events-"));
  const databasePath = join(directory, "test.sqlite");
  const server = createApp({ databasePath, now: () => now });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  t.after(async () => {
    const closed = once(server, "close");
    server.close();
    server.closeAllConnections();
    await closed;
    rmSync(directory, { recursive: true, force: true });
  });
  async function write(
    path: string,
    body: unknown,
    token?: string,
    method = "POST",
  ) {
    const response = await fetch(base + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      // oxlint-disable-next-line unicorn/no-invalid-fetch-options -- Write helper supports POST and PATCH.
      body: JSON.stringify(body),
    });
    assert.ok(
      response.ok,
      `${path}: ${response.status} ${await (response.ok ? Promise.resolve("") : response.text())}`,
    );
    return response.status === 204 ? undefined : response.json();
  }
  async function connect(token: string) {
    const controller = new AbortController();
    const response = await fetch(base + "/events", {
      headers: {
        Authorization: `Bearer ${token}`,
        Origin: "http://localhost:1420",
      },
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10_000)]),
    });
    assert.equal(response.status, 200);
    assert.match(response.headers.get("Content-Type")!, /text\/event-stream/);
    assert.equal(
      response.headers.get("Access-Control-Allow-Origin"),
      "http://localhost:1420",
    );
    const reader = response.body!.getReader();
    t.after(() => controller.abort());
    let buffer = "";
    const decoder = new TextDecoder();
    async function event() {
      while (true) {
        const end = buffer.indexOf("\n\n");
        if (end >= 0) {
          const frame = buffer.slice(0, end);
          buffer = buffer.slice(end + 2);
          return frame;
        }
        const chunk = await reader.read();
        assert.equal(chunk.done, false, "stream closed before expected event");
        buffer += decoder.decode(chunk.value, { stream: true });
      }
    }
    async function state(
      matches: (state: SidebarState) => boolean = () => true,
    ) {
      while (true) {
        const frame = await event();
        if (!frame.startsWith("event: state\n")) continue;
        const snapshot = parseSidebarState(
          JSON.parse(frame.slice(frame.indexOf("data: ") + 6)),
        );
        if (matches(snapshot)) return snapshot;
      }
    }
    return { event, state, close: () => controller.abort() };
  }
  const user = (name: string): Promise<Session> =>
    write("/session", { name, character: "hachiware" });
  return {
    base,
    databasePath,
    server,
    write,
    connect,
    user,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

test("SSE pushes personalized snapshots, chat and attacks; moves and kicks revoke delivery", async (t) => {
  const f = await fixture(t);
  const alice = await f.user("Alice"),
    bob = await f.user("Bob"),
    eve = await f.user("Eve");
  const aliceInvite = await f.write("/invites", {}, alice.token);
  const eveInvite = await f.write("/invites", {}, eve.token);
  await f.write("/invites/accept", aliceInvite, bob.token);
  const a = await f.connect(alice.token),
    b = await f.connect(bob.token),
    e = await f.connect(eve.token);
  assert.equal((await a.state()).self.id, alice.profile.id);
  assert.equal((await b.state()).self.id, bob.profile.id);
  assert.equal((await e.state()).friends.length, 0);
  const chat = await f.write("/chat", { text: "안녕\n친구" }, alice.token);
  assert.equal(
    (await b.state((s) => s.messages?.at(-1)?.id === chat.id)).messages!.at(-1)!
      .text,
    "안녕\n친구",
  );
  const attack = await f.write(
    "/friends/attack",
    { friendId: bob.profile.id },
    alice.token,
  );
  assert.equal(
    (await b.state((s) => s.attacks?.at(-1)?.id === attack.id)).attacks!.at(-1)!
      .targetId,
    bob.profile.id,
  );
  await f.write("/presence", { sharing: false }, bob.token, "PATCH");
  const hidden = await a.state((s) => s.friends[0]?.online === false);
  assert.equal(
    hidden.presence!.sharing,
    true,
    "another member's private setting is never sent as self",
  );
  assert.equal(
    (await b.state((s) => s.presence?.sharing === false)).self.id,
    bob.profile.id,
  );

  await f.write("/invites/accept", eveInvite, bob.token);
  const moved = await b.state((s) => s.friends[0]?.id === eve.profile.id);
  assert.deepEqual(moved.messages, []);
  assert.deepEqual(moved.attacks, []);
  assert.equal(
    (await a.state((s) => s.friends.length === 0)).messages!.length,
    1,
  );
  assert.deepEqual((await e.state((s) => s.friends.length === 1)).messages, []);
  await f.write("/friends/remove", { friendId: bob.profile.id }, eve.token);
  const kicked = await b.state((s) => s.friends.length === 0);
  assert.equal(kicked.room!.ownerId, bob.profile.id);
  assert.deepEqual(kicked.messages, []);

  b.close();
  await f.write("/invites/accept", aliceInvite, bob.token);
  f.advance(1000);
  const next = await f.write("/chat", { text: "after reconnect" }, alice.token);
  const reconnected = await f.connect(bob.token);
  assert.deepEqual(
    (await reconnected.state()).messages!.map((m) => m.id),
    [next.id],
    "new membership cannot read earlier messages",
  );
});

test("SSE keepalive never preserves presence; heartbeat restores sleep counts and TTL expiry is pushed", async (t) => {
  const f = await fixture(t);
  const alice = await f.user("Alice"),
    bob = await f.user("Bob");
  await f.write(
    "/invites/accept",
    await f.write("/invites", {}, alice.token),
    bob.token,
  );
  const a = await f.connect(alice.token),
    b = await f.connect(bob.token);
  assert.equal((await a.state()).friends[0]!.online, true);
  await b.state();
  f.advance(30_001);
  assert.equal(
    (await a.state((s) => !s.friends[0]!.online)).friends[0]!.online,
    false,
  );
  await f.write("/heartbeat", {}, alice.token);
  const attack = await f.write(
    "/friends/attack",
    { friendId: bob.profile.id },
    alice.token,
  );
  await a.state((s) => s.attacks?.[0]?.id === attack.id);
  await f.write("/heartbeat", {}, bob.token);
  assert.equal((await b.state((s) => s.sleepHitCount === 1)).sleepHitCount, 1);
  assert.equal(
    (await a.state((s) => s.friends[0]!.online)).friends[0]!.online,
    true,
  );
  f.advance(15_001);
  assert.deepEqual((await a.state((s) => s.attacks?.length === 0)).attacks, []);
  // A fresh connection alone is also a heartbeat and reuses the latest authorized snapshot.
  a.close();
  assert.deepEqual((await (await f.connect(alice.token)).state()).attacks, []);
});

test("SSE authenticates opens and active streams, bounds connections, and releases disconnected slots", async (t) => {
  const f = await fixture(t);
  const alice = await f.user("Alice");
  for (const [path, headers, status] of [
    [`/events?token=${alice.token}`, {}, 401],
    [
      "/events",
      {
        Authorization: `Bearer ${alice.token}`,
        Origin: "https://untrusted.test",
      },
      403,
    ],
  ] as const) {
    const response = await fetch(f.base + path, { headers });
    assert.equal(response.status, status);
    await response.body?.cancel();
  }
  const connections = [];
  for (let i = 0; i < 4; i++) {
    const stream = await f.connect(alice.token);
    await stream.state();
    connections.push(stream);
  }
  const blocked = await fetch(f.base + "/events", {
    headers: { Authorization: `Bearer ${alice.token}` },
  });
  assert.equal(blocked.status, 429);
  await blocked.body?.cancel();
  connections[0]!.close();
  // Observe the server-side close before checking the slot can be reused.
  await new Promise((resolve) => setTimeout(resolve, 30));
  const replacement = await f.connect(alice.token);
  await replacement.state();
  // Model a second device's separately issued session for the same profile.
  const otherToken = "z".repeat(43);
  const db = new DatabaseSync(f.databasePath);
  db.prepare("INSERT INTO sessions (token_hash, user_id) VALUES (?, ?)").run(
    createHash("sha256").update(otherToken).digest("hex"),
    alice.profile.id,
  );
  db.close();
  const otherDevice = await f.connect(otherToken);
  await otherDevice.state();
  await f.write("/session/logout", {}, alice.token);
  f.advance(10_000);
  assert.match(await replacement.event(), /event: unauthorized/);
  await f.write(
    "/profile",
    { name: "Still connected", character: "usagi" },
    otherToken,
    "PATCH",
  );
  assert.equal(
    (await otherDevice.state((s) => s.self.name === "Still connected")).self
      .character,
    "usagi",
    "logging out one session must leave another device's stream and writes authorized",
  );
  const heartbeat = await fetch(f.base + "/heartbeat", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${alice.token}`,
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  assert.equal(heartbeat.status, 401);
  await heartbeat.body?.cancel();
});
