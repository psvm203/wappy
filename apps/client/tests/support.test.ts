import assert from "node:assert/strict";
import { test } from "node:test";
import { supportReport, type SupportState } from "../src/support.ts";

const state: SupportState = {
  desktop: true,
  connection: "online",
  server: "https://private-host.test:9443",
  paused: false,
  visible: true,
};

test("support reports expose only coarse app states, never profile data or addresses", () => {
  const privateState = {
    ...state,
    token: "private-token",
    profile: {
      id: "private-id",
      name: "private-name",
      status: "private-status",
    },
    friends: [{ name: "private-friend" }],
    recoveryCode: "wappy-recovery-private-code",
    invite: "private-invitation",
    error: "private-server-message",
  };
  const report = supportReport(
    privateState,
    "0.2.0-beta.1+build.2",
    "MacIntel/private-machine",
  );
  assert.match(report, /앱 버전: 0.2.0-beta.1\+build.2/);
  assert.match(report, /macOS · 데스크톱 앱/);
  assert.match(report, /연결 상태: 연결됨/);
  assert.match(report, /서버 종류: HTTPS/);
  assert.match(report, /캐릭터 표시: 켜짐/);
  assert.match(report, /캐릭터 움직임: 자동 이동 허용/);
  assert.ok(!report.includes("private"));
  assert.ok(!report.includes("9443"));
  assert.match(
    supportReport(
      privateState,
      "0.1.0",
      "MacIntel",
      "0123456789abcdef0123456789abcdef01234567",
    ),
    /빌드: 0123456789ab/,
  );
  assert.match(
    supportReport(privateState, "0.1.0", "MacIntel", "private-build-token"),
    /빌드: 식별 정보 없음/,
  );
  for (const server of [
    "http://user:private-password@example.test",
    "https://example.test/?token=private-token",
    "wappy-recovery-private-code",
  ])
    assert.match(
      supportReport({ ...privateState, server }, "0.1.0", "Win32"),
      /서버 종류: 주소 확인 필요/,
    );
  assert.ok(
    !supportReport(
      privateState,
      "0.1.0\nprivate-token",
      "private-platform",
    ).includes("private"),
  );
});

test("support reports distinguish local preview, connectivity and desktop controls", () => {
  const local = supportReport(
    {
      ...state,
      server: "http://127.0.0.1:54321",
      connection: "offline",
      paused: true,
      visible: false,
    },
    "0.1.0",
    "Win32",
  );
  assert.match(local, /Windows · 데스크톱 앱/);
  assert.match(local, /연결 끊김/);
  assert.match(local, /서버 종류: 이 컴퓨터/);
  assert.match(local, /표시: 꺼짐/);
  assert.match(local, /움직임: 일시정지/);
  assert.ok(!local.includes("54321"));
  assert.match(
    supportReport(
      { ...state, connection: "preview", server: null },
      "0.1.0",
      "MacIntel",
    ),
    /서버 없이 체험 중\n서버 종류: 사용 안 함/,
  );
  for (const [connection, label] of [
    ["none", "프로필 선택 전"],
    ["connecting", "연결 확인 중"],
    ["unauthorized", "인증 만료"],
  ] as const)
    assert.match(
      supportReport({ ...state, connection }, "", ""),
      new RegExp(label),
    );
  const browser = supportReport(
    { ...state, desktop: false, server: "http://192.0.2.1:3001" },
    "0.1.0",
    "Linux",
  );
  assert.match(browser, /기타 환경 · 브라우저/);
  assert.match(browser, /서버 종류: HTTP/);
  assert.match(browser, /표시: 데스크톱 앱에서 지원/);
  assert.match(browser, /움직임: 데스크톱 앱에서 지원/);
  assert.ok(!browser.includes("192.0.2.1"));
});
