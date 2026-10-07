import { useEffect, useState } from "react";
import { isTauri, invoke } from "@tauri-apps/api/core";
import { emitTo, listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { SidebarState } from "@wappy/api";
import { loadCharacterPreferences, PREFERENCES_KEY } from "./preferences";

export function useCharacterPreferences() {
  const [preferences, setPreferences] = useState(() =>
    loadCharacterPreferences(
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    ),
  );
  const [storageError, setStorageError] = useState("");
  const [trayError, setTrayError] = useState("");
  const [trayReady, setTrayReady] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
      setStorageError("");
    } catch {
      setStorageError(
        "캐릭터 설정을 저장하지 못했어요. 이번 실행에만 적용됩니다.",
      );
    }
  }, [preferences]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () =>
      setPreferences((current) => ({ ...current, paused: media.matches }));
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!isTauri()) return;
    let disposed = false;
    let unlisten: UnlistenFn | undefined;
    void listen<string>("wappy:tray-control", ({ payload }) => {
      if (disposed) return;
      if (payload === "toggle-paused")
        setPreferences((current) => ({ ...current, paused: !current.paused }));
      if (payload === "toggle-visible")
        setPreferences((current) => ({
          ...current,
          visible: !current.visible,
        }));
    })
      .then((stop) => {
        if (disposed) return stop();
        unlisten = stop;
        setTrayReady(true);
      })
      .catch(() => {
        if (!disposed)
          setTrayError(
            "트레이 제어를 연결하지 못했어요. 사이드바에서 캐릭터를 제어해 주세요.",
          );
      });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    if (!trayReady) return;
    let disposed = false;
    void invoke("sync_tray_controls", { ...preferences })
      .then(() => {
        if (!disposed) setTrayError("");
      })
      .catch(() => {
        if (!disposed)
          setTrayError(
            "트레이 메뉴를 갱신하지 못했어요. 사이드바에서 캐릭터를 제어해 주세요.",
          );
      });
    return () => {
      disposed = true;
    };
  }, [preferences, trayReady]);

  return { preferences, setPreferences, error: storageError || trayError };
}

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
