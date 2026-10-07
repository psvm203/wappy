import { isRecord, type Input, type Output, type Route } from "@wappy/api";
export { serverUrl } from "./invitations";
export { SESSION_KEY, loadSession, type SavedSession } from "./sessions";

export const DEFAULT_SERVER =
  import.meta.env.VITE_API_URL || "http://localhost:3001";
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function request<R extends Route>(
  session: { server: string; token?: string },
  route: R,
  input: Input<R>,
  signal?: AbortSignal,
): Promise<Output<R>> {
  const [method, path] = route.split(" ");
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) controller.abort();
  const timeout = window.setTimeout(abort, 10_000);
  try {
    const response = await fetch(session.server + path, {
      method,
      signal: controller.signal,
      headers: {
        ...(input === undefined ? {} : { "Content-Type": "application/json" }),
        ...(session.token ? { Authorization: `Bearer ${session.token}` } : {}),
      },
      body: input === undefined ? undefined : JSON.stringify(input),
    });
    const body: unknown = await response.json();
    if (!response.ok)
      throw new ApiError(
        response.status,
        isRecord(body) && typeof body.error === "string"
          ? body.error
          : "요청에 실패했습니다.",
      );
    return body as Output<R>;
  } finally {
    window.clearTimeout(timeout);
    signal?.removeEventListener("abort", abort);
  }
}

export function errorMessage(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : "서버에 연결할 수 없습니다. 주소와 네트워크를 확인해 주세요.";
}
