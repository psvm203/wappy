import { HEARTBEAT_INTERVAL_MS, parseSidebarState } from "@wappy/api";
import { subscribeBrowserState, type StateUpdate } from "./state-polling.ts";

const MAX_EVENT_BYTES = 1024 * 1024;
const IDLE_TIMEOUT_MS = 30_000;

/** SSE lines may span chunks, including CRLF and UTF-8 characters. Bound each frame. */
export function stateEventParser(
  receive: (event: string, data: string) => void,
) {
  const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
  let line: number[] = [];
  let event = "";
  let data: string[] = [];
  let size = 0;
  let skipLF = false;
  let first = true;
  return (chunk: Uint8Array) => {
    for (const byte of chunk) {
      if (skipLF && byte === 10) {
        skipLF = false;
        continue;
      }
      skipLF = byte === 13;
      if (++size > MAX_EVENT_BYTES) throw new Error("State event too large");
      if (byte !== 10 && byte !== 13) {
        line.push(byte);
        continue;
      }
      let text = decoder.decode(Uint8Array.from(line));
      if (first) {
        text = text.replace(/^\uFEFF/, "");
        first = false;
      }
      line = [];
      if (!text) {
        if (data.length) receive(event || "message", data.join("\n"));
        event = "";
        data = [];
        size = 0;
      } else {
        const colon = text.indexOf(":");
        const field = colon < 0 ? text : text.slice(0, colon);
        const value = colon < 0 ? "" : text.slice(colon + 1).replace(/^ /, "");
        if (field === "event") event = value;
        if (field === "data") data.push(value);
      }
    }
  };
}

export function subscribeStreamState(
  session: { server: string; token: string },
  onUpdate: (update: StateUpdate) => void,
): () => void {
  let disposed = false;
  let active: AbortController | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let stopPolling: (() => void) | undefined;
  let failures = 0;
  const headers = { Authorization: `Bearer ${session.token}` };

  async function connect() {
    const controller = new AbortController();
    active = controller;
    let unauthorized = false;
    let fallback = false;
    let heartbeatTimer: ReturnType<typeof setTimeout> | undefined;
    let idle = setTimeout(() => controller.abort(), 10_000);
    const alive = () => {
      clearTimeout(idle);
      idle = setTimeout(() => controller.abort(), IDLE_TIMEOUT_MS);
    };
    async function heartbeat() {
      if (controller.signal.aborted) return;
      const request = new AbortController();
      const abort = () => request.abort();
      controller.signal.addEventListener("abort", abort, { once: true });
      const timeout = setTimeout(abort, 10_000);
      try {
        const response = await fetch(session.server + "/heartbeat", {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: "{}",
          signal: request.signal,
          redirect: "error",
          cache: "no-store",
        });
        await response.body?.cancel();
        if (response.status === 401) unauthorized = true;
        if (response.status !== 204) throw new Error("Heartbeat failed");
        if (!controller.signal.aborted)
          heartbeatTimer = setTimeout(
            () => void heartbeat(),
            HEARTBEAT_INTERVAL_MS,
          );
      } catch {
        controller.abort();
      } finally {
        clearTimeout(timeout);
        controller.signal.removeEventListener("abort", abort);
      }
    }
    try {
      const response = await fetch(session.server + "/events", {
        headers: { ...headers, Accept: "text/event-stream" },
        signal: controller.signal,
        redirect: "error",
        cache: "no-store",
      });
      if (response.status === 401) unauthorized = true;
      // Only an explicitly unsupported endpoint selects legacy polling for this session.
      fallback = [404, 405, 501].includes(response.status);
      if (unauthorized || fallback) {
        await response.body?.cancel();
        return;
      }
      if (
        response.status !== 200 ||
        response.headers.get("Content-Type")?.split(";")[0]?.trim() !==
          "text/event-stream"
      ) {
        await response.body?.cancel();
        throw new Error("Invalid state stream");
      }
      const reader = response.body?.getReader();
      if (!reader) throw new Error("Missing state stream");
      alive();
      heartbeatTimer = setTimeout(
        () => void heartbeat(),
        HEARTBEAT_INTERVAL_MS,
      );
      const parse = stateEventParser((event, data) => {
        if (event === "unauthorized") {
          unauthorized = true;
          controller.abort();
        } else if (
          event === "state" &&
          !controller.signal.aborted &&
          !disposed
        ) {
          const state = parseSidebarState(JSON.parse(data));
          failures = 0;
          onUpdate({ connection: "online", state });
        }
      });
      try {
        while (!controller.signal.aborted) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value.length) {
            alive();
            parse(value);
          }
        }
      } finally {
        await reader.cancel().catch(() => {});
        reader.releaseLock();
      }
    } catch {
      // Network errors, invalid frames and idle streams all reconnect with a new snapshot.
    } finally {
      controller.abort();
      clearTimeout(idle);
      clearTimeout(heartbeatTimer);
      if (!disposed) {
        if (unauthorized) onUpdate({ connection: "unauthorized" });
        else if (fallback)
          stopPolling = subscribeBrowserState(session, onUpdate);
        else {
          onUpdate({ connection: "offline" });
          retry = setTimeout(
            () => void connect(),
            Math.min(30_000, 1000 * 2 ** Math.min(failures++, 5)) +
              Math.random() * 250,
          );
        }
      }
    }
  }
  void connect();
  return () => {
    disposed = true;
    active?.abort();
    clearTimeout(retry);
    stopPolling?.();
  };
}
