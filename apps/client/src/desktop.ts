import { useEffect, useRef, useState } from "react";
import { isTauri, invoke } from "@tauri-apps/api/core";
import { emitTo, listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { SidebarState } from "@wappy/api";
import { loadCharacterPreferences, PREFERENCES_KEY } from "./preferences";
import { loadHiddenResidents, saveHiddenResidents } from "./resident-selection";

const NO_HIDDEN_RESIDENTS: string[] = [];

export function useResidentSelection(key: string | null) {
  const [selection, setSelection] = useState<{
    key: string | null;
    hiddenIds: string[];
    changed: boolean;
  }>({ key: null, hiddenIds: [], changed: false });
  const [error, setError] = useState("");
  useEffect(() => {
    if (!key) {
      setSelection({ key: null, hiddenIds: [], changed: false });
      setError("");
      return;
    }
    let hiddenIds: string[] = [];
    try {
      hiddenIds = loadHiddenResidents(key);
      setError("");
    } catch {
      setError(
        "캐릭터 선택을 읽지 못해 모두 선택했어요. 다시 선택하거나 앱을 다시 열어 주세요.",
      );
    }
    // Do not overwrite an unreadable saved selection until the user makes a choice.
    setSelection({ key, hiddenIds, changed: false });
  }, [key]);
  useEffect(() => {
    if (!key || selection.key !== key || !selection.changed) return;
    try {
      saveHiddenResidents(key, selection.hiddenIds);
      setError("");
    } catch {
      setError(
        "캐릭터 선택을 저장하지 못했어요. 앱을 다시 열거나 프로필을 전환하면 유지되지 않을 수 있어요.",
      );
    }
  }, [key, selection]);

  const ready = key !== null && selection.key === key;
  return {
    ready,
    hiddenIds: ready ? selection.hiddenIds : NO_HIDDEN_RESIDENTS,
    error: ready ? error : "",
    setHiddenIds: (update: (current: string[]) => string[]) =>
      setSelection((current) =>
        key && current.key === key
          ? { ...current, hiddenIds: update(current.hiddenIds), changed: true }
          : current,
      ),
  };
}

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
  profileKey: string | null;
  connected: boolean;
  paused: boolean;
  visible: boolean;
  hiddenIds: string[];
}

export const DESKTOP_STATE_EVENT = "wappy:desktop-state";
export const DESKTOP_READY_EVENT = "wappy:desktop-ready";
export const OPEN_GREETING_EVENT = "wappy:open-greeting";
export const OPEN_CHAT_EVENT = "wappy:open-chat";

export interface GreetingTarget {
  profileKey: string;
  friendId: string;
}

export function useDesktopGreeting(
  onOpen: (target: GreetingTarget) => void,
  eventName = OPEN_GREETING_EVENT,
) {
  const handler = useRef(onOpen);
  handler.current = onOpen;
  const [error, setError] = useState("");
  useEffect(() => {
    if (!isTauri()) return;
    let disposed = false;
    let unlisten: UnlistenFn | undefined;
    void listen<unknown>(eventName, ({ payload }) => {
      if (
        !disposed &&
        payload &&
        typeof payload === "object" &&
        "profileKey" in payload &&
        typeof payload.profileKey === "string" &&
        "friendId" in payload &&
        typeof payload.friendId === "string"
      )
        handler.current({
          profileKey: payload.profileKey,
          friendId: payload.friendId,
        });
    })
      .then((stop) => {
        if (disposed) return stop();
        unlisten = stop;
      })
      .catch(() => {
        if (!disposed)
          setError(
            "캐릭터 바로가기를 연결하지 못했어요. 트레이에서 사이드바를 열어 주세요.",
          );
      });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [eventName]);
  return error;
}

export function useDesktopSync({
  state,
  profileKey,
  connected,
  paused,
  visible,
  hiddenIds,
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
        // Only public profiles and navigation/display settings cross windows, never session tokens.
        await emitTo("desktop", DESKTOP_STATE_EVENT, {
          state,
          profileKey,
          connected,
          paused,
          visible,
          hiddenIds,
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
  }, [state, profileKey, connected, paused, visible, hiddenIds]);
  return error;
}
