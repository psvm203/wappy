import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

test("release preparation requires keys and a matching stable tag; publishing requires complete platform assets", async (t) => {
  const cwd = await mkdtemp(join(tmpdir(), "wappy-release-"));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  const writeJson = (path: string, value: unknown) =>
    writeFile(join(cwd, path), JSON.stringify(value));
  const run = (script: string, env: Record<string, string>) =>
    spawnSync(
      process.execPath,
      [
        fileURLToPath(
          new URL(`../../../.github/scripts/${script}.mjs`, import.meta.url),
        ),
      ],
      { cwd, env: { ...process.env, ...env }, encoding: "utf8" },
    );
  await mkdir(join(cwd, "apps/client/src-tauri"), { recursive: true });
  await writeJson("apps/client/src-tauri/tauri.conf.json", {
    version: "0.2.0",
  });
  const publicKey = Buffer.from(
    "untrusted comment: minisign public key\nRWtest=\n",
  ).toString("base64");
  const env = {
    GITHUB_REF_NAME: "v0.2.0",
    TAURI_SIGNING_PUBLIC_KEY: publicKey,
    TAURI_SIGNING_PRIVATE_KEY: "private-test-key",
  };
  assert.notEqual(
    run("prepare-release", { ...env, TAURI_SIGNING_PUBLIC_KEY: "" }).status,
    0,
  );
  assert.notEqual(
    run("prepare-release", { ...env, TAURI_SIGNING_PRIVATE_KEY: "" }).status,
    0,
  );
  assert.notEqual(
    run("prepare-release", { ...env, GITHUB_REF_NAME: "v0.1.0" }).status,
    0,
  );
  const prepared = run("prepare-release", env);
  assert.equal(prepared.status, 0, prepared.stderr);
  const config = await readFile(
    join(cwd, "apps/client/src-tauri/tauri.release.conf.json"),
    "utf8",
  );
  assert.equal(JSON.parse(config).plugins.updater.pubkey, publicKey);
  assert.equal(JSON.parse(config).bundle.createUpdaterArtifacts, true);
  assert.ok(!config.includes(env.TAURI_SIGNING_PRIVATE_KEY));
  await writeJson("apps/client/src-tauri/tauri.conf.json", {
    version: "0.2.0-beta.1",
  });
  assert.notEqual(
    run("prepare-release", { ...env, GITHUB_REF_NAME: "v0.2.0-beta.1" }).status,
    0,
  );

  await mkdir(join(cwd, "release-metadata"));
  const prefix = "https://github.com/example/wappy/releases/download/v0.2.0/";
  const mac = { url: `${prefix}Wappy.app.tar.gz`, signature: "mac-signature" };
  const windows = {
    url: `${prefix}Wappy-setup.exe`,
    signature: "windows-signature",
  };
  const manifest = {
    version: "0.2.0",
    platforms: {
      "darwin-aarch64": mac,
      "darwin-x86_64": mac,
      "windows-x86_64": windows,
    },
  };
  const release = {
    isDraft: true,
    tagName: "v0.2.0",
    assets: [
      "Wappy.dmg",
      "Wappy.app.tar.gz",
      "Wappy.app.tar.gz.sig",
      "Wappy-setup.exe",
      "Wappy-setup.exe.sig",
    ].map((name, index) => ({
      name,
      size: 100,
      url: `${prefix}${name}`,
      apiUrl: `https://api.github.com/repos/example/wappy/releases/assets/${index}`,
    })),
  };
  await writeFile(
    join(cwd, "release-metadata/Wappy.app.tar.gz.sig"),
    mac.signature,
  );
  await writeFile(
    join(cwd, "release-metadata/Wappy-setup.exe.sig"),
    windows.signature,
  );
  await writeJson("release-assets.json", release);
  await writeJson("release-metadata/latest.json", manifest);
  const publishEnv = {
    RELEASE_TAG: "v0.2.0",
    GITHUB_REPOSITORY: "example/wappy",
  };
  const valid = run("check-release", publishEnv);
  assert.equal(valid.status, 0, valid.stderr);
  const apiManifest = {
    ...manifest,
    platforms: Object.fromEntries(
      Object.entries(manifest.platforms).map(([platform, entry]) => [
        platform,
        {
          ...entry,
          url: release.assets.find((asset) => asset.url === entry.url)!.apiUrl,
        },
      ]),
    ),
  };
  await writeJson("release-metadata/latest.json", apiManifest);
  const apiResult = run("check-release", publishEnv);
  assert.equal(apiResult.status, 0, apiResult.stderr);
  for (const platforms of [
    { ...manifest.platforms, "darwin-x86_64": undefined },
    {
      ...manifest.platforms,
      "windows-x86_64": { ...windows, signature: "wrong" },
    },
    {
      ...manifest.platforms,
      "windows-x86_64": { ...windows, url: "https://other.test/update.exe" },
    },
    {
      ...manifest.platforms,
      "windows-x86_64-nsis": { ...windows, signature: "wrong" },
    },
  ]) {
    await writeJson("release-metadata/latest.json", { ...manifest, platforms });
    assert.notEqual(run("check-release", publishEnv).status, 0);
  }
  await writeJson("release-metadata/latest.json", manifest);
  await writeJson("release-assets.json", {
    ...release,
    assets: release.assets.filter((asset) => !asset.name.endsWith(".exe")),
  });
  assert.notEqual(run("check-release", publishEnv).status, 0);
  await writeJson("release-assets.json", { ...release, isDraft: false });
  assert.notEqual(run("check-release", publishEnv).status, 0);
});
