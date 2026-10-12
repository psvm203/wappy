import assert from "node:assert/strict";
import { test } from "node:test";
import { parseInvitePreview } from "@wappy/api";
import {
  formatInvitation,
  isLocalServer,
  parseInvitation,
  WAPPY_SERVER,
} from "../src/invitations.ts";

test("invitation previews validate display data and discard private fields", () => {
  const preview = {
    name: "Alice",
    character: "hachiware",
  };
  assert.deepEqual(
    parseInvitePreview({
      ...preview,
      id: "private",
      token: "private",
      online: true,
      expiresAt: 1_800_000_000_000, // Ignore legacy expiration metadata.
    }),
    preview,
  );
  for (const invalid of [
    null,
    [],
    {},
    { ...preview, name: "" },
    { ...preview, name: "x".repeat(25) },
    { ...preview, name: "A\nB" },
    { ...preview, character: "unknown" },
  ])
    assert.throws(() => parseInvitePreview(invalid));
});

test("five-character invitations omit the default server and accept lowercase input", () => {
  assert.equal(WAPPY_SERVER, "https://wappy-api.waps.im");
  assert.equal(formatInvitation(WAPPY_SERVER, "A7K3M"), "A7K3M");
  assert.equal(formatInvitation(`${WAPPY_SERVER}/`, "a7k3m"), "A7K3M");
  assert.deepEqual(parseInvitation(" a7K3m\n"), { code: "A7K3M" });
  assert.deepEqual(
    parseInvitation(formatInvitation("http://localhost:3001", "a7k3m")),
    { server: "http://localhost:3001", code: "A7K3M" },
  );
  for (const code of [
    "ABCD",
    "ABCDEF",
    "A0K3M",
    "A1K3M",
    "AOK3M",
    "AIK3M",
    "A_K3M",
    "A-K3M",
    "A K3M",
  ])
    assert.throws(() => parseInvitation(code));
});

test("legacy invitations preserve the server and reject ambiguous or secret input", () => {
  const code = "a_-".repeat(14) + "A";
  const invitation = formatInvitation("https://EXAMPLE.test:443/", code);
  assert.equal(
    invitation,
    `Wappy 초대\n서버: https://example.test\n초대 코드: ${code}`,
  );
  assert.deepEqual(parseInvitation(invitation), {
    server: "https://example.test",
    code,
  });
  assert.deepEqual(
    parseInvitation(` \n${invitation.replaceAll("\n", "\r\n")}\r\n`),
    { server: "https://example.test", code },
  );
  assert.deepEqual(parseInvitation(` ${code} `), { code });
  assert.deepEqual(
    parseInvitation(formatInvitation("http://[::1]:3001", code)),
    { server: "http://[::1]:3001", code },
  );
  for (const server of [
    "file:///private",
    "javascript:alert(1)",
    "https://user:secret@example.test",
    "https://example.test/path",
    "https://example.test?token=secret",
    "https://example.test#secret",
  ]) {
    assert.throws(() => formatInvitation(server, code));
    assert.throws(() =>
      parseInvitation(`Wappy 초대\n서버: ${server}\n초대 코드: ${code}`),
    );
  }
  for (const input of [
    "",
    "bad-code",
    `wappy-recovery-${code}`,
    `${code}x`,
    `${invitation}\nextra`,
    invitation.replace("Wappy 초대", "Other"),
    invitation.replace(code, "bad-code"),
    invitation.replace(code, `wappy-recovery-${code}`),
    invitation + "x".repeat(2048),
  ])
    assert.throws(() => parseInvitation(input));
  assert.throws(() => formatInvitation("https://example.test", "bad-code"));
  for (const server of [
    "http://localhost:3001",
    "http://dev.localhost",
    "http://127.0.0.2",
    "http://[::1]:3001",
  ])
    assert.equal(isLocalServer(server), true);
  for (const server of [
    "https://example.test",
    "https://localhost.example.test",
    "http://192.168.1.50:3001",
  ])
    assert.equal(isLocalServer(server), false);
});
