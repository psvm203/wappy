import { useEffect, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { emitTo, listen, type UnlistenFn } from "@tauri-apps/api/event";
import { DesktopCharacters } from "./DesktopCharacters";
import { visibleResidents } from "./resident-selection";
import {
  DESKTOP_READY_EVENT,
  DESKTOP_STATE_EVENT,
  type DesktopSnapshot,
} from "./desktop";

export function DesktopOverlay() {
  const [snapshot, setSnapshot] = useState<DesktopSnapshot | null>(null);
  useEffect(() => {
    if (!isTauri()) return;
    let disposed = false;
    let unlisten: UnlistenFn | undefined;
    void listen<DesktopSnapshot>(DESKTOP_STATE_EVENT, ({ payload }) => {
      if (!disposed) setSnapshot(payload);
    })
      .then(async (stop) => {
        if (disposed) {
          stop();
          return;
        }
        unlisten = stop;
        await emitTo("main", DESKTOP_READY_EVENT);
      })
      .catch((error) => console.error("Desktop character sync failed:", error));
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  if (!snapshot?.state || !snapshot.visible) return null;
  const residents = visibleResidents(
    snapshot.state,
    snapshot.connected,
    snapshot.hiddenIds,
  );
  if (residents.length === 0) return null;
  return (
    <DesktopCharacters
      residents={residents}
      paused={snapshot.paused}
      profileKey={snapshot.profileKey}
      messages={snapshot.state.messages}
    />
  );
}
