import { Channel, invoke, isTauri } from "@tauri-apps/api/core";
import { parseSidebarState } from "@wappy/api";
import type { SavedSession } from "./sessions";
import { subscribeBrowserState, type StateUpdate } from "./state-polling";
export type { StateUpdate } from "./state-polling";

export function subscribeState(
  session: SavedSession,
  onUpdate: (update: StateUpdate) => void,
): () => void {
  let disposed = false;
  let validated = false;
  const receive = (update: StateUpdate) => {
    if (disposed) return;
    try {
      if (update.connection === "online") {
        if (update.state !== undefined) {
          const state = parseSidebarState(update.state);
          validated = true;
          onUpdate({ connection: "online", state });
        } else onUpdate({ connection: validated ? "online" : "offline" });
      } else onUpdate(update);
    } catch {
      validated = false;
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

  return subscribeBrowserState(session, onUpdate);
}
