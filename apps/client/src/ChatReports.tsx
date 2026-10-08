import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  CHAT_REPORT_REASONS,
  MAX_REPORT_DETAILS,
  parseChatReportReceipt,
  parseChatReportReceipts,
  type ChatReportInput,
  type ChatReportReceipt,
} from "@wappy/api";
import { ApiError, request, type SavedSession } from "./api";

const statusText: Record<ChatReportReceipt["status"], string> = {
  pending: "접수됨 · 검토 대기",
  removed: "검토 완료 · 메시지 삭제 처리",
  dismissed: "검토 완료 · 조치하지 않음",
};
const failure = (cause: unknown) =>
  cause instanceof ApiError
    ? cause.message
    : "신고 요청 결과를 확인하지 못했어요. 내 신고 내역을 확인하거나 다시 시도해 주세요.";

export function MessageReport({
  session,
  messageId,
  text,
  senderName,
  disabled,
}: {
  session: SavedSession;
  messageId: number;
  text: string;
  senderName: string;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ChatReportInput["reason"] | "">("");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<ChatReportReceipt | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  useEffect(() => {
    if (open) dialog.current?.showModal();
  }, [open]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending.current || disabled || !reason) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setError("");
    try {
      const result = parseChatReportReceipt(
        await request(
          session,
          "POST /chat/report",
          { messageId, reason, details },
          controller.signal,
        ),
      );
      if (result.messageId !== messageId)
        throw new Error("Mismatched report receipt");
      setReceipt(result);
      setOpen(false);
      setDetails("");
      requestAnimationFrame(() => trigger.current?.focus());
    } catch (cause) {
      if (!controller.signal.aborted) setError(failure(cause));
    } finally {
      pending.current = null;
      setBusy(false);
    }
  }
  return (
    <div className="message-report">
      <button
        type="button"
        ref={trigger}
        className="text-button"
        disabled={disabled || busy}
        aria-expanded={open}
        aria-label={`${senderName} 님의 메시지 신고`}
        onClick={() => {
          setOpen(!open);
          setError("");
        }}
      >
        메시지 신고
      </button>
      {receipt && (
        <p className="hint" role="status">
          신고를 접수했어요. 처리 결과는 내 신고 내역에서 확인해 주세요.
        </p>
      )}
      {open && (
        <dialog
          ref={dialog}
          aria-label="메시지 신고"
          onCancel={(event) => {
            event.preventDefault();
            if (!busy) {
              setOpen(false);
              requestAnimationFrame(() => trigger.current?.focus());
            }
          }}
        >
          <h2>메시지 신고</h2>
          <p className="hint">{senderName} 님의 메시지를 신고합니다.</p>
          <blockquote>{text}</blockquote>
          <form
            onSubmit={(event) => void submit(event)}
            aria-label={`${senderName} 님의 메시지 신고 양식`}
          >
            <p className="hint">
              이 메시지, 보낸 사람, 내 프로필 식별자와 신고 사유를 이 서버
              운영자에게 보냅니다. 상대에게 신고 내역을 공개하지 않아요. 접수 후
              최대 30일간 보관하며, 두 사람 중 한 명이 프로필을 삭제하면 신고도
              삭제됩니다.
            </p>
            <label className="field">
              신고 사유
              <select
                autoFocus
                required
                value={reason}
                disabled={busy}
                onChange={(event) =>
                  setReason(event.target.value as ChatReportInput["reason"])
                }
              >
                <option value="">사유를 선택해 주세요</option>
                {Object.entries(CHAT_REPORT_REASONS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              추가 설명 (선택)
              <textarea
                value={details}
                maxLength={MAX_REPORT_DETAILS}
                rows={3}
                disabled={busy}
                placeholder="상황을 알려 주세요. 연락처나 비밀번호는 적지 마세요."
                onChange={(event) => setDetails(event.target.value)}
              />
            </label>
            <p className="hint">
              신고만으로 상대가 차단되지는 않아요. 연락을 멈추려면 친구들 탭에서
              차단해 주세요.
            </p>
            <div className="report-actions">
              <button
                type="button"
                className="text-button"
                disabled={busy}
                onClick={() => {
                  setOpen(false);
                  requestAnimationFrame(() => trigger.current?.focus());
                }}
              >
                취소
              </button>
              <button
                type="submit"
                className="secondary"
                disabled={busy || disabled || !reason}
              >
                {busy ? "접수 중…" : "신고 접수하기"}
              </button>
            </div>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
          </form>
        </dialog>
      )}
    </div>
  );
}

export function ChatReportHistory({
  session,
  connected,
}: {
  session: SavedSession;
  connected: boolean;
}) {
  const [receipts, setReceipts] = useState<ChatReportReceipt[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  async function refresh() {
    if (pending.current || !connected) return;
    const controller = new AbortController();
    pending.current = controller;
    setBusy(true);
    setError("");
    try {
      setReceipts(
        parseChatReportReceipts(
          await request(
            session,
            "GET /chat/reports",
            undefined,
            controller.signal,
          ),
        ),
      );
    } catch (cause) {
      if (!controller.signal.aborted) setError(failure(cause));
    } finally {
      pending.current = null;
      setBusy(false);
    }
  }
  return (
    <details
      className="invite-card report-history"
      onToggle={(event) => {
        if (event.currentTarget.open) void refresh();
      }}
    >
      <summary>내 신고 내역</summary>
      <p className="hint">
        최근 30일 안에 접수한 신고 중 최신 50개예요. 처리 결과는 새로고침으로
        확인해 주세요.
      </p>
      <button
        type="button"
        className="secondary"
        disabled={busy || !connected}
        onClick={() => void refresh()}
      >
        {busy ? "확인 중…" : "신고 내역 새로고침"}
      </button>
      {!connected && (
        <p className="hint">서버에 다시 연결되면 내역을 확인할 수 있어요.</p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {receipts?.length === 0 && (
        <p className="hint">보관 중인 신고가 없어요.</p>
      )}
      <ul aria-label="내가 접수한 신고" className="report-receipts">
        {receipts?.map((receipt) => (
          <li key={receipt.id}>
            <strong>{receipt.senderName} 님의 메시지</strong>
            <p>
              {CHAT_REPORT_REASONS[receipt.reason]} ·{" "}
              {statusText[receipt.status]}
            </p>
            <time dateTime={new Date(receipt.reportedAt).toISOString()}>
              {new Date(receipt.reportedAt).toLocaleString("ko-KR")}
            </time>
            <p className="hint">접수 번호: {receipt.id}</p>
          </li>
        ))}
      </ul>
    </details>
  );
}
