import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { emitTo, listen, type UnlistenFn } from "@tauri-apps/api/event";
import { DesktopCharacters } from "./DesktopCharacters";
import { visibleResidents } from "./resident-selection";
import { collectAttacks, createAttackInbox } from "./online-attacks";
import {
  DESKTOP_READY_EVENT,
  DESKTOP_STATE_EVENT,
  type DesktopSnapshot,
} from "./desktop";

export function DesktopOverlay() {
  const [snapshot, setSnapshot] = useState<DesktopSnapshot | null>(null);
  const attackInbox = useMemo(
    () => createAttackInbox(snapshot?.state?.self.id ?? null),
    [snapshot?.profileKey, snapshot?.state?.self.id],
  );
  const residents = snapshot?.state
    ? visibleResidents(snapshot.state, snapshot.connected, snapshot.hiddenIds)
    : [];
  useLayoutEffect(() => {
    if (
      !snapshot?.visible ||
      !snapshot.connected ||
      snapshot.paused ||
      residents.length === 0
    )
      collectAttacks(
        attackInbox,
        snapshot?.state?.attacks ?? [],
        new Set(),
        false,
        performance.now(),
      );
  }, [snapshot, attackInbox, residents.length]);
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
  if (residents.length === 0) return null;
  return (
    <DesktopCharacters
      key={snapshot.profileKey ?? "preview"}
      residents={residents}
      paused={snapshot.paused}
      profileKey={snapshot.profileKey}
      messages={snapshot.state.messages}
      attacks={snapshot.state.attacks}
      attackInbox={attackInbox}
      connected={snapshot.connected}
    />
  );
}
