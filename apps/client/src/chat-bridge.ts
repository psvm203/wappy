import { useEffect, useRef, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { emitTo, listen, type UnlistenFn } from "@tauri-apps/api/event";
import {
  isRecord,
  parseChatMessage,
  MAX_CHAT_LENGTH,
  type ChatMessage,
} from "@wappy/api";
import { errorMessage } from "./api";

const REQUEST_CHAT = "wappy:request-chat";
const CHAT_RESULT = "wappy:chat-result";

// Credentials remain in the main window; the desktop only sends an intent.
export function useDesktopChatRequests(
  profileKey: string | null,
  send: (text: string) => Promise<ChatMessage>,
) {
  const current = useRef({ profileKey, send });
  // oxlint-disable-next-line react/refs -- The long-lived native listener must use the latest profile and callback.
  current.current = { profileKey, send };
  const [error, setError] = useState("");
  useEffect(() => {
    if (!isTauri()) return;
    let disposed = false;
    let stop: UnlistenFn | undefined;
    void listen<unknown>(REQUEST_CHAT, async ({ payload }) => {
      if (
        disposed ||
        !isRecord(payload) ||
        !current.current.profileKey ||
        payload.profileKey !== current.current.profileKey ||
        typeof payload.text !== "string" ||
        !payload.text ||
        payload.text.length > MAX_CHAT_LENGTH ||
        typeof payload.requestId !== "string" ||
        !payload.requestId ||
        payload.requestId.length > 128
      )
        return;
      let failure: string | undefined;
      let chat: ChatMessage | undefined;
      try {
        chat = await current.current.send(payload.text);
      } catch (cause) {
        failure = errorMessage(cause);
      }
      if (disposed || payload.profileKey !== current.current.profileKey) return;
      await emitTo("desktop", CHAT_RESULT, {
        profileKey: payload.profileKey,
        requestId: payload.requestId,
        ...(failure ? { error: failure } : { chat }),
      }).catch(() => setError("메시지 결과를 캐릭터 창에 전달하지 못했어요."));
    })
      .then((unlisten) => {
        if (disposed) unlisten();
        else {
          stop = unlisten;
          setError("");
        }
      })
      .catch(() => setError("온라인 메시지 기능을 연결하지 못했어요."));
    return () => {
      disposed = true;
      stop?.();
    };
  }, []);
  return error;
}

export async function requestDesktopChat(
  profileKey: string,
  text: string,
): Promise<ChatMessage> {
  const requestId = crypto.randomUUID();
  let finish!: (chat?: unknown, error?: string) => void;
  const response = new Promise<ChatMessage>((resolve, reject) => {
    finish = (chat, error) => {
      if (error) {
        reject(new Error(error));
        return;
      }
      try {
        const event = parseChatMessage(chat);
        resolve(event);
      } catch {
        reject(new Error("메시지 전송 결과를 확인하지 못했어요."));
      }
    };
  });
  const stop = await listen<unknown>(CHAT_RESULT, ({ payload }) => {
    if (
      !isRecord(payload) ||
      payload.profileKey !== profileKey ||
      payload.requestId !== requestId
    )
      return;
    finish(
      payload.chat,
      typeof payload.error === "string" ? payload.error : undefined,
    );
  });
  const timer = setTimeout(
    () =>
      finish(
        undefined,
        "메시지 결과를 확인하지 못했어요. 연결 상태를 확인해 주세요.",
      ),
    12_000,
  );
  try {
    const [chat] = await Promise.all([
      response,
      emitTo("main", REQUEST_CHAT, { profileKey, text, requestId }),
    ]);
    return chat;
  } finally {
    clearTimeout(timer);
    stop();
  }
}
