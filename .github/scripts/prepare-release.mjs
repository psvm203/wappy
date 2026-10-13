import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";

const config = JSON.parse(
  await readFile("apps/client/src-tauri/tauri.conf.json", "utf8"),
);
assert.match(
  config.version,
  /^\d+\.\d+\.\d+$/,
  "Only stable versions belong in the stable update feed",
);
assert.equal(
  process.env.GITHUB_REF_NAME,
  `v${config.version}`,
  "The tag must match tauri.conf.json's version",
);
const publicKey = process.env.TAURI_SIGNING_PUBLIC_KEY?.trim();
assert.ok(publicKey, "Set the TAURI_SIGNING_PUBLIC_KEY repository variable");
assert.match(
  Buffer.from(publicKey, "base64").toString(),
  /^untrusted comment: .+\r?\n[A-Za-z0-9+/=]+\s*$/,
  "Use the entire generated .pub file, not a path",
);
assert.ok(
  process.env.TAURI_SIGNING_PRIVATE_KEY?.trim(),
  "Set the TAURI_SIGNING_PRIVATE_KEY repository secret",
);
await writeFile(
  "apps/client/src-tauri/tauri.release.conf.json",
  JSON.stringify(
    {
      bundle: { createUpdaterArtifacts: true },
      plugins: { updater: { pubkey: publicKey } },
    },
    null,
    2,
  ) + "\n",
);
