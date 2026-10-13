import assert from "node:assert/strict";
import { test } from "node:test";
import { setImmediate } from "node:timers/promises";
import { mockIPC, clearMocks } from "@tauri-apps/api/mocks";

test("updates are single-flight, require an install action, and recover without restarting on failure", async (t) => {
  globalThis.window = { crypto: globalThis.crypto } as unknown as Window &
    typeof globalThis;
  t.after(() => {
    clearMocks();
    delete (globalThis as { window?: unknown }).window;
  });
  const updater = await import("../src/updater.ts");
  const calls: string[] = [];
  let checkFailure = false;
  let installFailure = true;
  let restartFailure = true;
  let available = true;
  let releaseCheck: (() => void) | undefined;
  mockIPC(async (command, args) => {
    calls.push(command);
    if (command === "updater_enabled") return true;
    if (command === "plugin:updater|check") {
      assert.equal(args!.timeout, 15_000);
      if (checkFailure) throw new Error("private upstream response");
      if (!available) return null;
      await new Promise<void>((resolve) => {
        releaseCheck = resolve;
      });
      return { rid: 1, currentVersion: "0.1.0", version: "0.2.0" };
    }
    if (command === "plugin:updater|download_and_install") {
      const channel = args!.onEvent as { onmessage: (event: unknown) => void };
      channel.onmessage({ event: "Started", data: { contentLength: 100 } });
      channel.onmessage({ event: "Progress", data: { chunkLength: 60 } });
      assert.equal(updater.getUpdateState().progress, 60);
      await updater.installUpdate();
      await updater.checkForUpdates(true);
      channel.onmessage({ event: "Finished" });
      if (installFailure) throw new Error("signature verification failed");
    } else if (command === "plugin:process|restart") {
      if (restartFailure) throw new Error("restart failed");
    } else if (command !== "plugin:resources|close") {
      assert.fail(`Unexpected IPC: ${command}`);
    }
  });

  const first = updater.checkForUpdates();
  await setImmediate();
  await updater.checkForUpdates(true);
  releaseCheck!();
  await first;
  assert.equal(
    calls.filter((call) => call === "plugin:updater|check").length,
    1,
  );
  assert.equal(updater.getUpdateState().version, "0.2.0");
  assert.ok(
    !calls.includes("plugin:updater|download_and_install"),
    "checking never installs",
  );
  await updater.checkForUpdates();
  assert.equal(
    calls.filter((call) => call === "plugin:updater|check").length,
    1,
    "automatic checks are throttled",
  );

  // A failed refresh preserves a valid pending update, without displaying server text.
  checkFailure = true;
  await updater.checkForUpdates(true);
  assert.equal(updater.getUpdateState().version, "0.2.0");
  assert.ok(!updater.getUpdateState().error.includes("private"));
  checkFailure = false;
  available = false;
  await updater.checkForUpdates(true);
  assert.equal(updater.getUpdateState().status, "current");
  assert.ok(calls.includes("plugin:resources|close"));
  await updater.installUpdate();
  assert.ok(!calls.includes("plugin:updater|download_and_install"));

  available = true;
  const next = updater.checkForUpdates(true);
  releaseCheck!();
  await next;
  await updater.installUpdate();
  assert.equal(updater.getUpdateState().status, "available");
  assert.ok(updater.getUpdateState().error);
  assert.ok(
    !calls.includes("plugin:process|restart"),
    "failed installs must not restart",
  );
  installFailure = false;
  await updater.installUpdate();
  assert.equal(updater.getUpdateState().status, "ready");
  assert.ok(updater.getUpdateState().error);
  const installs = calls.filter(
    (call) => call === "plugin:updater|download_and_install",
  ).length;
  assert.equal(
    installs,
    2,
    "duplicate actions cannot start another installation",
  );
  restartFailure = false;
  await updater.installUpdate();
  assert.equal(
    calls.filter((call) => call === "plugin:updater|download_and_install")
      .length,
    installs,
    "retry restart without reinstalling",
  );
  assert.equal(updater.getUpdateState().error, "");
});

test("preview builds never request updates", async (t) => {
  globalThis.window = { crypto: globalThis.crypto } as unknown as Window &
    typeof globalThis;
  t.after(() => {
    clearMocks();
    delete (globalThis as { window?: unknown }).window;
  });
  // Fresh module state represents a separate application process.
  const updater = await import("../src/updater.ts?preview");
  const calls: string[] = [];
  mockIPC((command) => {
    calls.push(command);
    return false;
  });
  await updater.checkForUpdates();
  await updater.checkForUpdates(true);
  await updater.installUpdate();
  assert.equal(updater.getUpdateState().status, "disabled");
  assert.deepEqual(calls, ["updater_enabled"]);
});
