import assert from "node:assert/strict";
import { once } from "node:events";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import {
  CHAT_TTL_MS,
  REPORT_DAILY_LIMIT,
  REPORT_RETENTION_MS,
  parseChatReportReceipt,
  parseChatReportReceipts,
  parseSidebarState,
} from "@wappy/api";
import { createApp } from "./server.ts";
import { createReports } from "./reports.ts";

test("reports verify recipients, persist evidence privately, enforce limits, and support atomic operator review", async (t) => {
  const directory = mkdtempSync(join(tmpdir(), "wappy-reports-"));
  const databasePath = join(directory, "reports.sqlite");
  let now = Date.now();
  let server = createApp({
    databasePath,
    now: () => now,
    reportsEnabled: true,
  });
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
    etag?: string,
  ) {
    const response = await fetch(base + path, {
      method: body === undefined ? "GET" : "POST",
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
  async function create(name: string) {
    return (
      await call("/session", undefined, {
        name,
        character: "hachiware",
        status: "",
      })
    ).body;
  }
  async function connect(a: string, b: string) {
    const invite = (await call("/invites", a, {})).body;
    assert.equal((await call("/invites/accept", b, invite)).status, 200);
  }
  async function send(token: string, friendId?: string) {
    now += 60_001;
    const result = await call(friendId ? "/chat/direct" : "/chat", token, {
      text: "서버에 저장된 원문",
      ...(friendId ? { friendId } : {}),
    });
    assert.equal(result.status, 201);
    return result.body;
  }
  const alice = await create("Alice"),
    bob = await create("Bob"),
    carol = await create("Carol"),
    stranger = await create("Stranger");
  await connect(alice.token, bob.token);
  await connect(alice.token, carol.token);
  const broadcast = await send(alice.token);
  const direct = await send(alice.token, bob.profile.id);
  // Upgrade a database that already contains delivered messages and profiles.
  await close();
  inspection = new DatabaseSync(databasePath);
  inspection.exec("PRAGMA foreign_keys = ON; DROP TABLE chat_reports;");
  server = createApp({ databasePath, now: () => now, reportsEnabled: true });
  await listen();
  const reports = createReports(inspection, () => now);
  assert.equal(
    parseSidebarState((await call("/state", bob.token)).body).chatReporting,
    true,
  );
  const input = {
    messageId: broadcast.id,
    reason: "spam",
    details: "반복해서 보냈어요",
  };
  assert.equal((await call("/chat/report", undefined, input)).status, 401);
  assert.equal((await call("/chat/reports")).status, 401);
  for (const body of [
    null,
    {},
    { ...input, reason: "constructor" },
    { ...input, messageId: -1 },
    { ...input, details: "x".repeat(501) },
    { ...input, details: "bad\u001btext" },
  ])
    assert.equal((await call("/chat/report", bob.token, body)).status, 400);
  for (const [token, messageId] of [
    [alice.token, broadcast.id],
    [stranger.token, broadcast.id],
    [carol.token, direct.id],
    [bob.token, 999999],
  ])
    assert.equal(
      (await call("/chat/report", token, { ...input, messageId })).status,
      404,
    );
  const before = await call("/state", alice.token);
  const response = await call("/chat/report", bob.token, {
    ...input,
    senderId: stranger.profile.id,
    text: "위조",
    reporterId: carol.profile.id,
  });
  assert.equal(response.status, 200);
  const receipt = parseChatReportReceipt(response.body);
  assert.equal(receipt.status, "pending");
  const evidence = reports.inspect(receipt.id)!;
  assert.equal(evidence.reporterId, bob.profile.id);
  assert.equal(evidence.senderId, alice.profile.id);
  assert.equal(evidence.text, broadcast.text);
  assert.equal(evidence.details, input.details);
  assert.equal("reporterId" in response.body, false);
  assert.equal("text" in response.body, false);
  assert.deepEqual(
    (
      await call("/chat/report", bob.token, {
        ...input,
        reason: "other",
        details: "변경 시도",
      })
    ).body,
    response.body,
    "retries preserve the original report",
  );
  for (const person of [alice, carol, stranger])
    assert.deepEqual((await call("/chat/reports", person.token)).body, []);
  assert.equal(
    (await call("/state", alice.token, undefined, before.etag)).status,
    304,
    "neither state nor ETag discloses a report to the sender",
  );
  assert.equal(
    (await call("/reports", alice.token)).status,
    404,
    "the operator queue has no public HTTP endpoint",
  );
  const privateReceipt = (
    await call("/chat/report", bob.token, { ...input, messageId: direct.id })
  ).body;
  const carolReceipt = (await call("/chat/report", carol.token, input)).body;
  await call("/friends/block", bob.token, { friendId: alice.profile.id });
  assert.equal(
    inspection
      .prepare("SELECT 1 FROM chat_messages WHERE id = ?")
      .get(direct.id),
    undefined,
  );
  assert.equal(
    reports.inspect(privateReceipt.id)!.text,
    direct.text,
    "blocking cannot erase submitted evidence",
  );
  assert.equal(
    (await call("/chat/report", bob.token, { ...input, messageId: direct.id }))
      .body.id,
    privateReceipt.id,
    "lost-response retries still succeed after blocking",
  );
  const afterBlock = await send(alice.token);
  assert.equal(
    (
      await call("/chat/report", bob.token, {
        ...input,
        messageId: afterBlock.id,
      })
    ).status,
    404,
  );
  const recovery = (await call("/recovery-code", bob.token, {})).body;
  await close();
  server = createApp({ databasePath, now: () => now });
  await listen();
  bob.token = (await call("/session/recover", undefined, recovery)).body.token;
  assert.equal(
    parseSidebarState((await call("/state", bob.token)).body).chatReporting,
    false,
  );
  assert.equal((await call("/chat/report", bob.token, input)).status, 503);
  assert.equal(
    parseChatReportReceipts((await call("/chat/reports", bob.token)).body)
      .length,
    2,
    "receipts survive restart/recovery and pausing intake",
  );
  await close();
  server = createApp({ databasePath, now: () => now, reportsEnabled: true });
  await listen();
  const carolBeforeRemoval = await call("/state", carol.token);
  inspection.exec(
    "CREATE TRIGGER fail_report_removal BEFORE DELETE ON chat_messages BEGIN SELECT RAISE(ABORT, 'test rollback'); END;",
  );
  assert.throws(() => reports.resolve(receipt.id, "remove"), /test rollback/);
  assert.equal(reports.inspect(receipt.id)!.status, "pending");
  assert.equal(reports.inspect(carolReceipt.id)!.status, "pending");
  inspection.exec("DROP TRIGGER fail_report_removal;");
  const cli = fileURLToPath(new URL("./review-reports.ts", import.meta.url));
  const cliOptions = {
    env: { ...process.env, DATABASE_PATH: databasePath },
    encoding: "utf8" as const,
  };
  const runCli = (...args: string[]) =>
    JSON.parse(execFileSync(process.execPath, [cli, ...args], cliOptions));
  assert.equal(runCli("list").length, 3);
  assert.equal(runCli("show", privateReceipt.id).text, direct.text);
  assert.equal(runCli("resolve", receipt.id, "remove").status, "removed");
  assert.equal(
    reports.inspect(carolReceipt.id)!.status,
    "removed",
    "removal resolves other pending reports for the same message",
  );
  const refreshed = await call(
    "/state",
    carol.token,
    undefined,
    carolBeforeRemoval.etag,
  );
  assert.equal(
    refreshed.status,
    200,
    "live API notices external operator database changes",
  );
  assert.ok(
    !refreshed.body.messages.some(
      (message: { id: number }) => message.id === broadcast.id,
    ),
  );
  assert.ok(!refreshed.body.unreadChatIds.includes(broadcast.id));
  assert.equal(
    runCli("resolve", receipt.id, "remove").status,
    "removed",
    "operator retry is idempotent",
  );
  assert.equal(
    spawnSync(
      process.execPath,
      [cli, "resolve", receipt.id, "dismiss"],
      cliOptions,
    ).status,
    1,
  );
  assert.equal(
    runCli("resolve", privateReceipt.id, "dismiss").status,
    "dismissed",
  );
  assert.equal(
    parseChatReportReceipts((await call("/chat/reports", bob.token)).body).find(
      (item) => item.id === privateReceipt.id,
    )!.status,
    "dismissed",
  );
  // Reconnection never grants access to the old broadcast delivery.
  await call("/friends/unblock", bob.token, { friendId: alice.profile.id });
  await connect(alice.token, bob.token);
  assert.equal(
    (
      await call("/chat/report", bob.token, {
        ...input,
        messageId: afterBlock.id,
      })
    ).status,
    404,
  );
  for (let index = 2; index < REPORT_DAILY_LIMIT; index++) {
    const message = await send(alice.token, bob.profile.id);
    assert.equal(
      (
        await call("/chat/report", bob.token, {
          ...input,
          messageId: message.id,
        })
      ).status,
      200,
    );
  }
  const limited = await send(alice.token, bob.profile.id);
  assert.equal(
    (await call("/chat/report", bob.token, { ...input, messageId: limited.id }))
      .status,
    429,
  );
  assert.equal(
    (await call("/chat/report", bob.token, input)).status,
    200,
    "duplicate retries do not consume the daily limit",
  );
  now += CHAT_TTL_MS;
  assert.equal(
    (await call("/chat/report", bob.token, { ...input, messageId: limited.id }))
      .status,
    404,
    "unreported expired messages cannot be reported",
  );
  const afterReset = await send(alice.token, bob.profile.id);
  assert.equal(
    (
      await call("/chat/report", bob.token, {
        ...input,
        messageId: afterReset.id,
      })
    ).status,
    200,
  );
  assert.equal(
    reports.inspect(privateReceipt.id)!.text,
    direct.text,
    "evidence outlives normal chat retention",
  );
  assert.equal(
    (await call("/profile/delete", bob.token, { profileId: bob.profile.id }))
      .status,
    200,
  );
  assert.equal(
    reports.inspect(privateReceipt.id),
    undefined,
    "reporter deletion purges their submissions",
  );
  assert.ok(reports.inspect(carolReceipt.id));
  assert.equal(
    (
      await call("/profile/delete", alice.token, {
        profileId: alice.profile.id,
      })
    ).status,
    200,
  );
  assert.equal(
    reports.inspect(carolReceipt.id),
    undefined,
    "sender deletion also purges associated evidence",
  );
  await connect(carol.token, stranger.token);
  const expires = await send(stranger.token, carol.profile.id);
  const expiringReport = (
    await call("/chat/report", carol.token, { ...input, messageId: expires.id })
  ).body;
  now += REPORT_RETENTION_MS;
  assert.deepEqual((await call("/chat/reports", carol.token)).body, []);
  assert.equal(reports.inspect(expiringReport.id), undefined);
  assert.throws(
    () => reports.resolve(expiringReport.id, "remove"),
    /찾을 수 없습니다/,
  );
  reports.prune();
  assert.equal(
    inspection.prepare("SELECT count(*) AS count FROM chat_reports").get()!
      .count,
    0,
  );
  assert.deepEqual(inspection.prepare("PRAGMA foreign_key_check").all(), []);
});
