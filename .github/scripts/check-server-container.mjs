import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { request } from "node:https";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout } from "node:timers/promises";
import { fileURLToPath } from "node:url";

// Isolated Compose project, volumes and loopback-only random ports, including TLS.
const root = fileURLToPath(new URL("../../", import.meta.url));
const project = `wappy-check-${randomUUID()}`;
const temporary = mkdtempSync(join(tmpdir(), "wappy-container-"));
const envFile = join(temporary, "empty.env");
writeFileSync(envFile, "");
const override = join(temporary, "test.yaml");
writeFileSync(
  override,
  `services:
  proxy:
    ports: !override
      - "127.0.0.1::443"
`,
);
const env = {
  ...process.env,
  WAPPY_PORT: "0",
  WAPPY_DOMAIN: "localhost",
  ALLOWED_ORIGINS: "https://browser.test",
};
const base = [
  "compose",
  "--env-file",
  envFile,
  "-p",
  project,
  "-f",
  "compose.yaml",
];
const publicFiles = ["-f", "compose.https.yaml", "-f", override];
let files = [];
function docker(args, options = {}) {
  const result = spawnSync("docker", args, {
    cwd: root,
    env,
    encoding: "utf8",
    timeout: 600_000,
    maxBuffer: 10 * 1024 * 1024,
    ...options,
  });
  assert.equal(
    result.status,
    0,
    result.error?.message ??
      result.stderr?.toString() ??
      `docker ${args[0]} failed`,
  );
  return result.stdout;
}
const compose = (...args) => docker([...base, ...files, ...args]);
const inspect = (id) => JSON.parse(docker(["inspect", id]))[0];
const serverId = () => compose("ps", "-q", "server").trim();
let endpoint;
async function call(
  path,
  body,
  token,
  method = body === undefined ? "GET" : "POST",
  headers = {},
) {
  const response = await fetch(endpoint + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
  });
  const value = await response.json();
  assert.ok(response.ok, `${method} ${path}: ${response.status}`);
  return value;
}

try {
  compose("build", "server");
  compose("up", "-d", "--wait", "--wait-timeout", "60");
  const initial = serverId();
  const port = inspect(initial).NetworkSettings.Ports["3001/tcp"][0];
  assert.equal(port.HostIp, "127.0.0.1");
  endpoint = `http://127.0.0.1:${port.HostPort}`;
  assert.equal(compose("exec", "-T", "server", "id", "-u").trim(), "1000");
  assert.deepEqual(await call("/health"), { ok: true });
  assert.deepEqual(
    await call("/health", undefined, undefined, "GET", {
      Origin: "https://browser.test",
    }),
    { ok: true },
  );
  const denied = await fetch(endpoint + "/health", {
    headers: { Origin: "https://untrusted.test" },
  });
  assert.equal(denied.status, 403);
  await denied.body.cancel();
  const alice = await call("/session", {
    name: "Alice",
    character: "cat",
    status: "kept",
  });
  const bob = await call("/session", {
    name: "Bob",
    character: "bunny",
    status: "",
  });
  const invite = await call("/invites", {}, alice.token);
  assert.equal((await call("/invites/preview", invite)).name, "Alice");
  await call("/invites/accept", invite, bob.token);
  const pendingInvite = await call("/invites", {}, alice.token);
  const recovery = await call("/recovery-code", {}, alice.token);
  const wave = await call(
    "/friends/wave",
    { friendId: bob.profile.id },
    alice.token,
  );
  await call("/presence", { sharing: false }, alice.token, "PATCH");

  compose("stop", "server");
  assert.equal(
    inspect(initial).State.ExitCode,
    0,
    "SIGTERM must close SQLite cleanly",
  );
  const backup = docker(
    [
      ...base,
      "run",
      "--rm",
      "--no-deps",
      "-T",
      "server",
      "tar",
      "czf",
      "-",
      "-C",
      "/data",
      ".",
    ],
    { encoding: null },
  );
  assert.ok(backup.length > 0);
  compose("rm", "-f", "server");
  compose("up", "-d", "--wait", "--wait-timeout", "60");
  assert.notEqual(
    serverId(),
    initial,
    "recreate the container, retain its volume",
  );
  endpoint = `http://127.0.0.1:${inspect(serverId()).NetworkSettings.Ports["3001/tcp"][0].HostPort}`;
  const state = await call("/state", undefined, bob.token);
  assert.equal(state.friends[0].id, alice.profile.id);
  assert.equal(state.friends[0].online, false);
  assert.equal(state.friends[0].wave.id, wave.id);
  assert.equal(
    (await call("/state", undefined, alice.token)).presence.sharing,
    false,
  );
  assert.equal((await call("/invites/preview", pendingInvite)).name, "Alice");
  const recovered = await call("/session/recover", recovery);
  assert.equal(recovered.profile.id, alice.profile.id);
  assert.notEqual(recovered.token, alice.token);
  console.log(
    "PASS non-root startup, CORS, graceful stop, recreation and persisted profiles/friends/waves/privacy/invites/recovery",
  );

  // Restore the backup into a new, empty test volume, as documented.
  compose("down", "--volumes");
  docker(
    [
      ...base,
      "run",
      "--rm",
      "--no-deps",
      "-T",
      "server",
      "tar",
      "xzf",
      "-",
      "-C",
      "/data",
    ],
    { input: backup },
  );
  files = publicFiles;
  const config = JSON.parse(compose("config", "--format", "json"));
  assert.equal(
    config.services.server.ports?.length ?? 0,
    0,
    "trusted backend has no published port",
  );
  compose("up", "-d", "--wait", "--wait-timeout", "60");
  const proxyPort = inspect(compose("ps", "-q", "proxy").trim()).NetworkSettings
    .Ports["443/tcp"][0];
  assert.equal(
    inspect(serverId()).NetworkSettings.Ports["3001/tcp"],
    null,
    "Docker must not publish the trusted backend",
  );
  assert.equal(proxyPort.HostIp, "127.0.0.1");
  // Trust only this disposable Caddy CA, without disabling TLS validation.
  let ca;
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      ca = compose(
        "exec",
        "-T",
        "proxy",
        "cat",
        "/data/caddy/pki/authorities/local/root.crt",
      );
      break;
    } catch (error) {
      if (attempt === 29) throw error;
      await setTimeout(500);
    }
  }
  async function httpsCall(path, body, token, headers = {}) {
    return new Promise((resolve, reject) => {
      const req = request(
        {
          hostname: "127.0.0.1",
          port: Number(proxyPort.HostPort),
          servername: "localhost",
          path,
          ca,
          method: body === undefined ? "GET" : "POST",
          headers: {
            Host: "localhost",
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...headers,
          },
        },
        (res) => {
          let text = "";
          res.setEncoding("utf8");
          res.on("data", (chunk) => {
            text += chunk;
          });
          res.on("end", () => {
            try {
              resolve({ status: res.statusCode, body: JSON.parse(text) });
            } catch (error) {
              reject(error);
            }
          });
          res.on("error", reject);
        },
      );
      req.on("error", reject);
      req.setTimeout(5000, () =>
        req.destroy(new Error("HTTPS request timed out")),
      );
      req.end(body === undefined ? undefined : JSON.stringify(body));
    });
  }
  assert.deepEqual(await httpsCall("/health"), {
    status: 200,
    body: { ok: true },
  });
  const restored = await httpsCall("/state", undefined, alice.token);
  assert.equal(restored.status, 200, "backup restores the pre-recovery token");
  assert.equal(restored.body.self.id, alice.profile.id);
  assert.equal(restored.body.presence.sharing, false);
  assert.equal(restored.body.friends[0].id, bob.profile.id);
  assert.equal(
    (await httpsCall("/state", undefined, bob.token)).body.friends[0].wave.id,
    wave.id,
  );
  assert.equal(
    (await httpsCall("/invites/preview", pendingInvite)).body.name,
    "Alice",
  );
  assert.equal(
    (await httpsCall("/session/recover", recovery)).body.profile.id,
    alice.profile.id,
  );
  for (let i = 0; i < 12; i++) {
    const reply = await httpsCall("/session", {}, undefined, {
      "X-Forwarded-For": `192.0.2.${i}`,
    });
    assert.equal(
      reply.status,
      i < 9 ? 400 : 429,
      "Caddy must overwrite forged forwarded addresses",
    );
  }
  console.log(
    "PASS backup restore, HTTPS certificate validation, private backend and proxy spoof resistance",
  );
} catch (error) {
  try {
    console.error(compose("logs", "--tail", "60", "--no-color"));
  } catch {}
  throw error;
} finally {
  try {
    docker([
      ...base,
      ...publicFiles,
      "down",
      "--volumes",
      "--rmi",
      "local",
      "--remove-orphans",
    ]);
  } finally {
    rmSync(temporary, { recursive: true, force: true });
  }
}
