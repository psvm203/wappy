import { useEffect, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { emitTo, listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { SidebarState } from "@wappy/api";

export interface DesktopSnapshot {
  state: SidebarState | null;
  connected: boolean;
  paused: boolean;
  visible: boolean;
}

export const DESKTOP_STATE_EVENT = "wappy:desktop-state";
export const DESKTOP_READY_EVENT = "wappy:desktop-ready";

export function useDesktopSync({
  state,
  connected,
  paused,
  visible,
}: DesktopSnapshot) {
  const [error, setError] = useState("");
  useEffect(() => {
    if (!isTauri()) return;
    let disposed = false;
    let unlisten: UnlistenFn | undefined;
    const reportError = () => {
      if (!disposed)
        setError(
          "바탕화면 캐릭터를 연결하지 못했습니다. 앱을 다시 실행해 주세요.",
        );
    };
    const send = async () => {
      if (disposed) return;
      try {
        // Only public profiles and display settings cross windows, never session tokens.
        await emitTo("desktop", DESKTOP_STATE_EVENT, {
          state,
          connected,
          paused,
          visible,
        } satisfies DesktopSnapshot);
        if (!disposed) setError("");
      } catch {
        reportError();
      }
    };
    // Register before sending so either window can finish loading first.
    void listen(DESKTOP_READY_EVENT, send)
      .then((stop) => {
        if (disposed) {
          stop();
          return;
        }
        unlisten = stop;
        void send();
      })
      .catch(reportError);
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [state, connected, paused, visible]);
  return error;
}
