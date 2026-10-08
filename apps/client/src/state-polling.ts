import {
  POLL_INTERVAL_MS,
  parseSidebarState,
  type SidebarState,
} from "@wappy/api";

export type StateUpdate =
  | { connection: "online"; state?: SidebarState }
  | { connection: "offline" | "unauthorized" };

/** One subscription owns one validator, request and timer; no profile cache. */
export function subscribeBrowserState(
  session: { server: string; token: string },
  onUpdate: (update: StateUpdate) => void,
): () => void {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  let etag: string | null = null;
  let failures = 0;
  async function poll() {
    const request = new AbortController();
    const timeout = setTimeout(() => request.abort(), 10_000);
    const abort = () => request.abort();
    controller.signal.addEventListener("abort", abort, { once: true });
    let unauthorized = false;
    try {
      const response = await fetch(session.server + "/state", {
        signal: request.signal,
        cache: "no-store",
        redirect: "error",
        headers: {
          Authorization: `Bearer ${session.token}`,
          ...(etag ? { "If-None-Match": etag } : {}),
        },
      });
      let update: StateUpdate;
      if (response.status === 401) {
        unauthorized = true;
        await response.body?.cancel();
        update = { connection: "unauthorized" };
      } else if (response.status === 304 && etag) {
        update = { connection: "online" };
      } else {
        if (!response.ok) {
          await response.body?.cancel();
          throw new Error("State request failed");
        }
        // Match the native client's bound, including chunked responses without a size.
        const reader = response.body?.getReader();
        if (!reader) throw new Error("Missing state body");
        const decoder = new TextDecoder();
        let bytes = 0;
        let body = "";
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            bytes += value.byteLength;
            if (bytes > 1024 * 1024)
              throw new Error("State response too large");
            body += decoder.decode(value, { stream: true });
          }
          body += decoder.decode();
        } finally {
          await reader.cancel();
          reader.releaseLock();
        }
        const state = parseSidebarState(JSON.parse(body));
        // Do not validate a malformed response on the next poll.
        etag = response.headers.get("ETag");
        update = { connection: "online", state };
      }
      failures = 0;
      if (!controller.signal.aborted) onUpdate(update);
    } catch {
      failures++;
      if (!controller.signal.aborted) onUpdate({ connection: "offline" });
    } finally {
      clearTimeout(timeout);
      controller.signal.removeEventListener("abort", abort);
      if (!controller.signal.aborted && !unauthorized)
        timer = setTimeout(
          poll,
          Math.min(
            60_000,
            POLL_INTERVAL_MS * 2 ** Math.min(Math.max(0, failures - 1), 4),
          ),
        );
    }
  }
  void poll();
  return () => {
    controller.abort();
    clearTimeout(timer);
  };
}
