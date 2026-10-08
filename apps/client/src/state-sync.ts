import { Channel, invoke, isTauri } from "@tauri-apps/api/core";
import {
  POLL_INTERVAL_MS,
  parseSidebarState,
  type SidebarState,
} from "@wappy/api";
import { ApiError, request, type SavedSession } from "./api";

export type StateUpdate =
  | { connection: "online"; state: SidebarState }
  | { connection: "offline" | "unauthorized" };

export function subscribeState(
  session: SavedSession,
  onUpdate: (update: StateUpdate) => void,
): () => void {
  let disposed = false;
  const receive = (update: StateUpdate) => {
    if (disposed) return;
    try {
      onUpdate(
        update.connection === "online"
          ? { connection: "online", state: parseSidebarState(update.state) }
          : update,
      );
    } catch {
      onUpdate({ connection: "offline" });
    }
  };

  if (isTauri()) {
    let subscription: number | undefined;
    const updates = new Channel<StateUpdate>(receive);
    const stop = (id: number) =>
      invoke("stop_state_polling", { id }).catch(() => {});
    void invoke<number>("start_state_polling", { ...session, updates })
      .then((id) => {
        subscription = id;
        if (disposed) void stop(id);
      })
      .catch(() => receive({ connection: "offline" }));
    return () => {
      disposed = true;
      if (subscription !== undefined) void stop(subscription);
    };
  }

  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  async function poll() {
    let unauthorized = false;
    try {
      const state = await request(
        session,
        "GET /state",
        undefined,
        controller.signal,
      );
      receive({ connection: "online", state });
    } catch (cause) {
      unauthorized = cause instanceof ApiError && cause.status === 401;
      receive({ connection: unauthorized ? "unauthorized" : "offline" });
    } finally {
      if (!disposed && !unauthorized)
        timer = setTimeout(poll, POLL_INTERVAL_MS);
    }
  }
  void poll();
  return () => {
    disposed = true;
    controller.abort();
    clearTimeout(timer);
  };
}
