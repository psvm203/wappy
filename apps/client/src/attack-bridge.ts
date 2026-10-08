import { useEffect, useRef, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { emitTo, listen, type UnlistenFn } from "@tauri-apps/api/event";
import { isRecord, parseAttackEvent, type AttackEvent } from "@wappy/api";
import { errorMessage } from "./api";

const REQUEST_ATTACK = "wappy:request-attack";
const ATTACK_RESULT = "wappy:attack-result";

// Credentials remain in the main window; the desktop only sends an intent.
export function useDesktopAttackRequests(
  profileKey: string | null,
  send: (friendId: string) => Promise<AttackEvent>,
) {
  const current = useRef({ profileKey, send });
  current.current = { profileKey, send };
  const [error, setError] = useState("");
  useEffect(() => {
    if (!isTauri()) return;
    let disposed = false;
    let stop: UnlistenFn | undefined;
    void listen<unknown>(REQUEST_ATTACK, async ({ payload }) => {
      if (
        disposed ||
        !isRecord(payload) ||
        !current.current.profileKey ||
        payload.profileKey !== current.current.profileKey ||
        typeof payload.friendId !== "string" ||
        !payload.friendId ||
        payload.friendId.length > 128 ||
        typeof payload.requestId !== "string" ||
        !payload.requestId ||
        payload.requestId.length > 128
      )
        return;
      let failure: string | undefined;
      let attack: AttackEvent | undefined;
      try {
        attack = await current.current.send(payload.friendId);
      } catch (cause) {
        failure = errorMessage(cause);
      }
      if (disposed || payload.profileKey !== current.current.profileKey) return;
      await emitTo("desktop", ATTACK_RESULT, {
        profileKey: payload.profileKey,
        requestId: payload.requestId,
        ...(failure ? { error: failure } : { attack }),
      }).catch(() => setError("공격 결과를 캐릭터 창에 전달하지 못했어요."));
    })
      .then((unlisten) => {
        if (disposed) unlisten();
        else {
          stop = unlisten;
          setError("");
        }
      })
      .catch(() => setError("온라인 공격 기능을 연결하지 못했어요."));
    return () => {
      disposed = true;
      stop?.();
    };
  }, []);
  return error;
}

export async function requestDesktopAttack(
  profileKey: string,
  friendId: string,
): Promise<AttackEvent> {
  const requestId = crypto.randomUUID();
  let finish!: (attack?: unknown, error?: string) => void;
  const response = new Promise<AttackEvent>((resolve, reject) => {
    finish = (attack, error) => {
      if (error) {
        reject(new Error(error));
        return;
      }
      try {
        const event = parseAttackEvent(attack);
        if (event.targetId !== friendId) throw new Error();
        resolve(event);
      } catch {
        reject(new Error("공격 전송 결과를 확인하지 못했어요."));
      }
    };
  });
  const stop = await listen<unknown>(ATTACK_RESULT, ({ payload }) => {
    if (
      !isRecord(payload) ||
      payload.profileKey !== profileKey ||
      payload.requestId !== requestId
    )
      return;
    finish(
      payload.attack,
      typeof payload.error === "string" ? payload.error : undefined,
    );
  });
  const timer = setTimeout(
    () =>
      finish(
        undefined,
        "공격 결과를 확인하지 못했어요. 연결 상태를 확인해 주세요.",
      ),
    12_000,
  );
  try {
    const [attack] = await Promise.all([
      response,
      emitTo("main", REQUEST_ATTACK, { profileKey, friendId, requestId }),
    ]);
    return attack;
  } finally {
    clearTimeout(timer);
    stop();
  }
}
