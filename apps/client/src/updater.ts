import { invoke } from "@tauri-apps/api/core";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export const UPDATE_CHECK_INTERVAL = 6 * 60 * 60 * 1000;

export interface UpdateState {
  status:
    | "idle"
    | "disabled"
    | "checking"
    | "current"
    | "available"
    | "downloading"
    | "installing"
    | "ready"
    | "error";
  version: string | null;
  progress: number | null;
  error: string;
}

// One operation per sidebar, including React remounts and compact/profile switches.
let state: UpdateState = {
  status: "idle",
  version: null,
  progress: null,
  error: "",
};
let update: Update | null = null;
let enabled: boolean | null = null;
let busy = false;
let installed = false;
let lastCheck: number | null = null;
const listeners = new Set<() => void>();

export const getUpdateState = () => state;
export function subscribeUpdates(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
function publish(next: Partial<UpdateState>) {
  state = { ...state, ...next };
  for (const listener of listeners) listener();
}

export async function checkForUpdates(manual = false) {
  if (busy || installed || enabled === false) return;
  const interval =
    state.status === "error" ? 5 * 60 * 1000 : UPDATE_CHECK_INTERVAL;
  if (!manual && lastCheck !== null && Date.now() - lastCheck < interval)
    return;
  busy = true;
  lastCheck = Date.now();
  publish({ status: "checking", error: "" });
  try {
    enabled ??= await invoke<boolean>("updater_enabled");
    if (!enabled) {
      publish({ status: "disabled" });
      return;
    }
    const next = await check({ timeout: 15_000 });
    const previous = update;
    update = next;
    publish({
      status: next ? "available" : "current",
      version: next?.version ?? null,
    });
    // The old native resource is no longer needed after a successful refresh.
    await previous?.close().catch(() => {});
  } catch {
    publish({
      status: update ? "available" : "error",
      error:
        "업데이트를 확인하지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.",
    });
  } finally {
    busy = false;
  }
}

export async function installUpdate() {
  if (busy || (!update && !installed)) return;
  busy = true;
  publish({ error: "" });
  try {
    if (!installed && update) {
      let downloaded = 0;
      let total: number | undefined;
      publish({ status: "downloading", progress: null });
      await update.downloadAndInstall(
        (event) => {
          if (event.event === "Started") {
            total = event.data.contentLength;
          } else if (event.event === "Progress") {
            downloaded += event.data.chunkLength;
            publish({
              progress: total
                ? Math.min(100, Math.round((downloaded / total) * 100))
                : null,
            });
          } else if (event.event === "Finished") {
            publish({ status: "installing", progress: null });
          }
        },
        { timeout: 120_000 },
      );
      // Windows exits inside the installer. macOS needs an explicit restart.
      installed = true;
    }
    publish({ status: "ready", progress: null });
    await relaunch();
  } catch {
    publish({
      status: installed ? "ready" : "available",
      progress: null,
      error: installed
        ? "업데이트가 설치되었어요. Wappy를 종료한 뒤 다시 열어 주세요."
        : "업데이트를 설치하지 못했어요. 다시 시도해 주세요.",
    });
  } finally {
    busy = false;
  }
}
