import { isRecord, MAX_NAME_LENGTH } from "@wappy/api";

export interface KakaoConfig {
  restApiKey: string;
  clientSecret: string;
  redirectUri: string;
}

export function kakaoConfig(env: NodeJS.ProcessEnv): KakaoConfig | undefined {
  const restApiKey = env.KAKAO_REST_API_KEY?.trim();
  const clientSecret = env.KAKAO_CLIENT_SECRET?.trim();
  const redirectUri = env.KAKAO_REDIRECT_URI?.trim();
  if (!restApiKey && !clientSecret && !redirectUri) return undefined;
  if (!restApiKey || !clientSecret || !redirectUri)
    throw new Error(
      "Set KAKAO_REST_API_KEY, KAKAO_CLIENT_SECRET and KAKAO_REDIRECT_URI together",
    );
  const url = new URL(redirectUri);
  if (
    (url.protocol !== "https:" &&
      !(
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
      )) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/auth/kakao/callback"
  )
    throw new Error(
      "KAKAO_REDIRECT_URI must be an HTTPS /auth/kakao/callback URL (HTTP is allowed on localhost)",
    );
  return { restApiKey, clientSecret, redirectUri };
}

/** Provider tokens stay on the server and are discarded after identifying the account. */
export async function kakaoIdentity(
  config: KakaoConfig,
  code: string,
  request = fetch,
) {
  const signal = AbortSignal.timeout(10_000);
  const tokenResponse = await request("https://kauth.kakao.com/oauth/token", {
    method: "POST",
    redirect: "error",
    signal,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: config.restApiKey,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      code,
    }),
  });
  if (!tokenResponse.ok) throw new Error("Kakao token exchange failed");
  const token: unknown = await tokenResponse.json();
  if (
    !isRecord(token) ||
    typeof token.access_token !== "string" ||
    !token.access_token
  )
    throw new Error("Invalid Kakao token response");
  const userResponse = await request("https://kapi.kakao.com/v2/user/me", {
    signal,
    redirect: "error",
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  if (!userResponse.ok) throw new Error("Kakao user lookup failed");
  const user: unknown = await userResponse.json();
  if (
    !isRecord(user) ||
    typeof user.id !== "number" ||
    !Number.isSafeInteger(user.id) ||
    user.id <= 0
  )
    throw new Error("Invalid Kakao user response");
  const account = isRecord(user.kakao_account) ? user.kakao_account : {};
  const profile = isRecord(account.profile) ? account.profile : {};
  const nickname = typeof profile.nickname === "string" ? profile.nickname : "";
  return {
    id: String(user.id),
    name:
      nickname
        .replace(/[\u0000-\u001f\u007f]/g, "")
        .trim()
        .slice(0, MAX_NAME_LENGTH) || "카카오 친구",
  };
}
