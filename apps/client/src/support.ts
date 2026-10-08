import { isLocalServer, serverUrl } from "./invitations.ts";

export const SUPPORT_URL = "https://github.com/psvm203/wappy/issues/new";

export interface SupportState {
  desktop: boolean;
  connection:
    "none" | "preview" | "connecting" | "online" | "offline" | "unauthorized";
  server: string | null;
  paused: boolean;
  visible: boolean;
}

/** Build from an allowlist of coarse states; never serialize a session or error. */
export function supportReport(
  state: SupportState,
  version: string,
  platform: string,
  buildId?: string,
) {
  let server = "사용 안 함";
  if (state.server) {
    try {
      const address = serverUrl(state.server);
      server = isLocalServer(address)
        ? "이 컴퓨터"
        : address.startsWith("https:")
          ? "HTTPS"
          : "HTTP";
    } catch {
      server = "주소 확인 필요";
    }
  }
  const connection =
    {
      none: "프로필 선택 전",
      preview: "서버 없이 체험 중",
      connecting: "연결 확인 중",
      online: "연결됨",
      offline: "연결 끊김",
      unauthorized: "인증 만료",
    }[state.connection] ?? "확인할 수 없음";
  const os = /mac/i.test(platform)
    ? "macOS"
    : /win/i.test(platform)
      ? "Windows"
      : "기타 환경";
  return [
    "Wappy 문제 확인 정보",
    `앱 버전: ${/^\d+\.\d+\.\d+(?:-[\w.-]+)?(?:\+[\w.-]+)?$/.test(version) && version.length < 80 ? version : "확인할 수 없음"}`,
    `빌드: ${typeof buildId === "string" && /^[a-f0-9]{40}$/i.test(buildId) ? buildId.slice(0, 12) : "식별 정보 없음"}`,
    `실행 환경: ${os} · ${state.desktop ? "데스크톱 앱" : "브라우저"}`,
    `연결 상태: ${connection}`,
    `서버 종류: ${server}`,
    `캐릭터 표시: ${state.desktop ? (state.visible ? "켜짐" : "꺼짐") : "데스크톱 앱에서 지원"}`,
    `캐릭터 움직임: ${state.desktop ? (state.paused ? "일시정지" : "자동 이동 허용") : "데스크톱 앱에서 지원"}`,
  ].join("\n");
}
