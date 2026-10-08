import assert from "node:assert/strict";
import { test } from "node:test";
import { parseInvitePreview } from "@wappy/api";
import {
  formatInvitation,
  isLocalServer,
  parseInvitation,
} from "../src/invitations.ts";

test("invitation previews validate display data and discard private fields", () => {
  const preview = {
    name: "Alice",
    character: "cat",
    expiresAt: 1_800_000_000_000,
  };
  assert.deepEqual(
    parseInvitePreview({
      ...preview,
      id: "private",
      status: "private",
      token: "private",
      online: true,
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
    ...["tomorrow", 0, -1, 0.5, NaN, Infinity, 8_640_000_000_000_001].map(
      (expiresAt) => ({ ...preview, expiresAt }),
    ),
  ])
    assert.throws(() => parseInvitePreview(invalid));
});

test("shared invitations preserve the server and reject ambiguous or secret input", () => {
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
  assert.throws(() => parseInvitation(`wappy-recovery-${code}`), /복구 코드/);
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
