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

/** A readable invitation can be pasted without registering an OS URL handler. */
export function formatInvitation(server: string, code: string): string {
  if (!/^[A-Za-z0-9_-]{43}$/.test(code))
    throw new Error("올바른 초대 코드가 아닙니다.");
  return `Wappy 초대\n서버: ${serverUrl(server)}\n초대 코드: ${code}`;
}

export function parseInvitation(value: string): {
  code: string;
  server?: string;
} {
  const text = value.trim();
  if (/^[A-Za-z0-9_-]{43}$/.test(text)) return { code: text };
  if (text.startsWith("wappy-recovery-"))
    throw new Error(
      "복구 코드는 친구에게 보내지 마세요. 초대 코드를 사용해 주세요.",
    );
  const lines = text.split(/\r?\n/).map((line) => line.trim());
  if (
    text.length > 2048 ||
    lines.length !== 3 ||
    lines[0] !== "Wappy 초대" ||
    !lines[1]?.startsWith("서버:") ||
    !/^초대 코드: *[A-Za-z0-9_-]{43}$/.test(lines[2] ?? "")
  )
    throw new Error(
      "친구가 보낸 초대장 전체 또는 초대 코드를 붙여넣어 주세요.",
    );
  return {
    server: serverUrl(lines[1].slice("서버:".length).trim()),
    code: lines[2]!.slice("초대 코드:".length).trim(),
  };
}
