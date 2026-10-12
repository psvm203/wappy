export const WAPPY_SERVER = "https://wappy-api.waps.im";
const INVITE_CODE = /^(?:[A-HJ-NP-Z2-9]{5}|[a-z0-9_-]{43})$/i;

export function serverUrl(value: string): string {
  const url = new URL(value);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  ) {
    throw new Error(
      "서버 주소는 http:// 또는 https://로 시작하는 기본 주소를 입력해 주세요.",
    );
  }
  return url.origin;
}

export function isLocalServer(server: string): boolean {
  const { hostname } = new URL(server);
  return (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname === "[::1]" ||
    /^127(?:\.\d+){3}$/.test(hostname)
  );
}

/** The default server only needs a code; custom servers retain their address. */
export function formatInvitation(server: string, code: string): string {
  if (!INVITE_CODE.test(code)) throw new Error("올바른 초대 코드가 아닙니다.");
  const address = serverUrl(server);
  const normalized = code.length === 5 ? code.toUpperCase() : code;
  return address === WAPPY_SERVER
    ? normalized
    : `Wappy 초대\n서버: ${address}\n초대 코드: ${normalized}`;
}

export function parseInvitation(value: string): {
  code: string;
  server?: string;
} {
  const text = value.trim();
  if (INVITE_CODE.test(text))
    return { code: text.length === 5 ? text.toUpperCase() : text };
  const lines = text.split(/\r?\n/).map((line) => line.trim());
  const code = lines[2]?.slice("초대 코드:".length).trim() ?? "";
  if (
    text.length > 2048 ||
    lines.length !== 3 ||
    lines[0] !== "Wappy 초대" ||
    !lines[1]?.startsWith("서버:") ||
    !lines[2]?.startsWith("초대 코드:") ||
    !INVITE_CODE.test(code)
  )
    throw new Error("친구가 보낸 5자리 초대 코드를 입력해 주세요.");
  return {
    server: serverUrl(lines[1].slice("서버:".length).trim()),
    code: code.length === 5 ? code.toUpperCase() : code,
  };
}
