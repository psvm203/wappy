import { isRecord } from "@wappy/api";
import { serverUrl } from "./invitations.ts";

class ServerCheckError extends Error {}

/** A public, read-only probe; never send profile credentials or follow a redirect. */
export async function checkServer(server: string, signal?: AbortSignal) {
  let address: string;
  try {
    address = serverUrl(server);
  } catch {
    throw new ServerCheckError(
      "http:// 또는 https://로 시작하는 서버 주소를 입력해 주세요. 경로·로그인 정보·초대 코드는 넣지 않아요.",
    );
  }
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  let timedOut = false;
  let received = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 10_000);
  try {
    const response = await fetch(address + "/health", {
      signal: controller.signal,
      credentials: "omit",
      cache: "no-store",
      redirect: "error",
    });
    received = true;
    if (!response.ok) {
      await response.body?.cancel();
      throw new ServerCheckError(
        response.status === 404
          ? "이 주소에서 서버를 찾지 못했어요. Wappy 서버 주소인지 확인해 주세요."
          : `서버가 연결 확인을 처리하지 못했어요. 잠시 후 다시 확인하거나 서버 운영자에게 문의해 주세요. (HTTP ${response.status})`,
      );
    }
    const body: unknown = await response.json();
    if (!isRecord(body) || body.ok !== true)
      throw new ServerCheckError(
        "응답을 확인하지 못했어요. Wappy 서버 주소인지 확인해 주세요.",
      );
    return address;
  } catch (cause) {
    if (signal?.aborted || cause instanceof ServerCheckError) throw cause;
    throw new ServerCheckError(
      timedOut
        ? "10초 안에 응답하지 않았어요. 주소와 네트워크를 확인한 뒤 다시 시도해 주세요."
        : received
          ? "응답을 확인하지 못했어요. Wappy 서버 주소인지 확인해 주세요."
          : "서버에 연결하지 못했어요. 주소·네트워크·서버 실행 상태를 확인해 주세요. HTTPS 주소라면 인증서도 확인해 주세요.",
    );
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}
