import assert from "node:assert/strict";
import { test } from "node:test";
import { parseSidebarState } from "@wappy/api";
import { parseKakaoStart, parseKakaoResult } from "../src/kakao-login.ts";
import { GUEST_SESSION_KEY, loadGuestSession } from "../src/sessions.ts";

test("Kakao login validates destinations and sessions before opening a browser or replacing a profile", () => {
  const server = "https://api.example";
  const state = "a".repeat(64);
  const start = {
    loginToken: "b".repeat(43),
    authorizationUrl: `${server}/auth/kakao/authorize?state=${state}`,
    expiresAt: Date.now() + 600_000,
  };
  assert.deepEqual(parseKakaoStart(start, server), start);
  for (const authorizationUrl of [
    `https://evil.example/auth/kakao/authorize?state=${state}`,
    `${server}/elsewhere?state=${state}`,
    `${start.authorizationUrl}&next=https://evil.example`,
    `${start.authorizationUrl}&state=another`,
    `${start.authorizationUrl}#fragment`,
    `${server}/auth/kakao/authorize?state=bad`,
    `https://user:secret@api.example/auth/kakao/authorize?state=${state}`,
    "javascript:alert(1)",
  ])
    assert.throws(() =>
      parseKakaoStart({ ...start, authorizationUrl }, server),
    );
  assert.throws(() => parseKakaoStart({ ...start, loginToken: "bad" }, server));
  assert.deepEqual(parseKakaoResult({ status: "pending" }), {
    status: "pending",
  });
  const session = {
    token: "c".repeat(43),
    profile: { id: "alice", name: "Alice", character: "chiikawa" },
  };
  assert.deepEqual(parseKakaoResult({ status: "complete", session }), {
    status: "complete",
    session,
  });
  for (const value of [
    null,
    {},
    { status: "unknown" },
    { status: "complete", session: { ...session, token: "bad" } },
    { status: "complete", session: { ...session, profile: {} } },
  ])
    assert.throws(() => parseKakaoResult(value));
  const snapshot = {
    self: session.profile,
    friends: [],
    account: { kakao: true },
  };
  assert.deepEqual(parseSidebarState(snapshot).account, { kakao: true });
  assert.throws(() =>
    parseSidebarState({ ...snapshot, account: { kakao: "true" } }),
  );
  assert.equal(
    parseSidebarState({ self: session.profile, friends: [] }).account,
    undefined,
  );
});

test("guest credentials survive account switching and invalid backups cannot become destinations", () => {
  const guest = { server: "https://api.example", token: "a".repeat(43) };
  let saved: string | null = JSON.stringify(guest);
  const storage = {
    getItem(key: string) {
      assert.equal(key, GUEST_SESSION_KEY);
      return saved;
    },
    setItem() {},
  };
  assert.deepEqual(loadGuestSession(storage), guest);
  for (saved of [
    null,
    "broken",
    JSON.stringify({ ...guest, token: "bad" }),
    JSON.stringify({ ...guest, server: "javascript:alert(1)" }),
  ])
    assert.equal(loadGuestSession(storage), null);
});
