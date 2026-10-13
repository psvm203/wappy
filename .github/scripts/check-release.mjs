import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";

const release = JSON.parse(await readFile("release-assets.json", "utf8"));
const manifest = JSON.parse(
  await readFile("release-metadata/latest.json", "utf8"),
);
assert.ok(release.isDraft, "Never replace assets of a published release");
assert.equal(release.tagName, process.env.RELEASE_TAG);
assert.equal(`v${manifest.version.replace(/^v/, "")}`, release.tagName);
const prefix = `https://github.com/${process.env.GITHUB_REPOSITORY}/releases/download/${release.tagName}/`;
const assets = new Map(release.assets.map((asset) => [asset.name, asset]));
for (const platform of ["darwin-aarch64", "darwin-x86_64", "windows-x86_64"]) {
  assert.ok(
    manifest.platforms[platform],
    `Missing updater platform: ${platform}`,
  );
}
// Tauri Action v1 uses GitHub asset API URLs and also emits bundle-specific keys.
for (const [platform, entry] of Object.entries(manifest.platforms)) {
  assert.equal(typeof entry.url, "string");
  const asset = release.assets.find(
    (asset) => entry.url === asset.url || entry.url === asset.apiUrl,
  );
  assert.ok(asset?.size > 0, `Missing updater bundle for ${platform}`);
  assert.ok(
    asset.url.startsWith(prefix),
    `${platform} must download from this release`,
  );
  const name = asset.name;
  assert.equal(name, basename(name));
  assert.ok(
    assets.get(`${name}.sig`)?.size > 0,
    `Missing updater signature: ${name}`,
  );
  const signature = (
    await readFile(`release-metadata/${name}.sig`, "utf8")
  ).trim();
  assert.ok(signature.length > 0);
  assert.equal(
    entry.signature.trim(),
    signature,
    `Mismatched signature: ${name}`,
  );
  assert.ok(
    platform.startsWith("darwin-")
      ? name.endsWith(".app.tar.gz")
      : name.endsWith(".exe"),
  );
}
assert.equal(
  manifest.platforms["darwin-aarch64"].url,
  manifest.platforms["darwin-x86_64"].url,
  "Both Mac architectures must use the universal bundle",
);
assert.ok(
  release.assets.some((asset) => asset.name.endsWith(".dmg") && asset.size > 0),
  "Missing macOS installer",
);
console.log(
  "Release contains both installers and all three updater platforms.",
);
