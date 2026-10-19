import { isRecord, parseSidebarState, type Output } from "@wappy/api";

export function parseKakaoStart(
  value: unknown,
  server: string,
): Output<"POST /auth/kakao/start"> {
  if (
    !isRecord(value) ||
    typeof value.loginToken !== "string" ||
    !/^[A-Za-z0-9_-]{43}$/.test(value.loginToken) ||
    typeof value.authorizationUrl !== "string" ||
    typeof value.expiresAt !== "number" ||
    !Number.isSafeInteger(value.expiresAt) ||
    value.expiresAt <= 0
  )
    throw new Error("잘못된 로그인 응답입니다.");
  const url = new URL(value.authorizationUrl);
  if (
    url.origin !== server ||
    url.pathname !== "/auth/kakao/authorize" ||
    url.username ||
    url.password ||
    url.hash ||
    [...url.searchParams].length !== 1 ||
    !/^[a-f0-9]{64}$/.test(url.searchParams.get("state") ?? "")
  )
    throw new Error("로그인 주소가 연결할 서버와 다릅니다.");
  return {
    loginToken: value.loginToken,
    authorizationUrl: url.href,
    expiresAt: value.expiresAt,
  };
}

export function parseKakaoResult(
  value: unknown,
): Output<"POST /auth/kakao/poll"> {
  if (isRecord(value) && value.status === "pending")
    return { status: "pending" };
  if (
    !isRecord(value) ||
    value.status !== "complete" ||
    !isRecord(value.session) ||
    typeof value.session.token !== "string" ||
    !/^[A-Za-z0-9_-]{43}$/.test(value.session.token)
  )
    throw new Error("잘못된 로그인 응답입니다.");
  return {
    status: "complete",
    session: {
      token: value.session.token,
      profile: parseSidebarState({ self: value.session.profile, friends: [] })
        .self,
    },
  };
}
