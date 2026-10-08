import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import {
  CHAT_HISTORY_LIMIT,
  CHAT_TTL_MS,
  REPORT_DAILY_LIMIT,
  REPORT_RETENTION_MS,
  type ChatReportInput,
  type ChatReportReceipt,
} from "@wappy/api";

export class ReportError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** The HTTP app and the local operator command share the same durable queue. */
export function createReports(db: DatabaseSync, now = Date.now) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS chat_reports (
      id TEXT PRIMARY KEY,
      reporter_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      message_id INTEGER NOT NULL,
      sender_name TEXT NOT NULL, message_text TEXT NOT NULL, sent_at INTEGER NOT NULL,
      reason TEXT NOT NULL CHECK (reason IN ('harassment', 'sexual', 'spam', 'other')),
      details TEXT NOT NULL, reported_at INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'removed', 'dismissed')),
      resolved_at INTEGER,
      UNIQUE (reporter_id, message_id), CHECK (reporter_id <> sender_id)
    ) STRICT;
    CREATE INDEX IF NOT EXISTS reports_reporter ON chat_reports(reporter_id, reported_at DESC);
    CREATE INDEX IF NOT EXISTS reports_sender ON chat_reports(sender_id);
    CREATE INDEX IF NOT EXISTS reports_message ON chat_reports(message_id, status);
    CREATE INDEX IF NOT EXISTS reports_expiry ON chat_reports(reported_at);
    CREATE INDEX IF NOT EXISTS reports_pending ON chat_reports(status, reported_at);
  `);
  const columns = `id, message_id AS messageId, sender_name AS senderName,
    reason, status, reported_at AS reportedAt`;
  const prune = () =>
    db
      .prepare("DELETE FROM chat_reports WHERE reported_at <= ?")
      .run(now() - REPORT_RETENTION_MS);
  prune();
  return {
    prune,
    receipts(userId: string) {
      return db
        .prepare(
          `SELECT ${columns} FROM chat_reports
        WHERE reporter_id = ? AND reported_at > ? ORDER BY reported_at DESC, id LIMIT ?`,
        )
        .all(
          userId,
          now() - REPORT_RETENTION_MS,
          CHAT_HISTORY_LIMIT,
        ) as unknown as ChatReportReceipt[];
    },
    submit(userId: string, input: ChatReportInput): ChatReportReceipt {
      db.exec("BEGIN IMMEDIATE");
      try {
        prune();
        const existing = db
          .prepare(
            `SELECT ${columns} FROM chat_reports WHERE reporter_id = ? AND message_id = ?`,
          )
          .get(userId, input.messageId);
        if (existing) {
          db.exec("COMMIT");
          return existing as unknown as ChatReportReceipt;
        }
        // Never trust client-supplied authors or text, including for private messages.
        const message = db
          .prepare(
            `SELECT m.sender_id, u.name, m.text, m.sent_at
          FROM chat_messages m JOIN users u ON u.id = m.sender_id
          WHERE m.id = ? AND m.sender_id <> ? AND m.sent_at > ?
          AND EXISTS (SELECT 1 FROM chat_recipients r WHERE r.message_id = m.id
            AND (r.user_id = ? OR r.friend_id = ?))`,
          )
          .get(input.messageId, userId, now() - CHAT_TTL_MS, userId, userId);
        if (!message)
          throw new ReportError(
            404,
            "신고할 메시지가 없거나 더 이상 볼 수 없어요.",
          );
        const count = db
          .prepare(
            "SELECT count(*) AS count FROM chat_reports WHERE reporter_id = ? AND reported_at > ?",
          )
          .get(userId, now() - 24 * 60 * 60 * 1000)!;
        if (Number(count.count) >= REPORT_DAILY_LIMIT)
          throw new ReportError(
            429,
            "신고는 24시간 동안 20개까지 접수할 수 있어요. 불편한 친구는 차단할 수 있어요.",
          );
        const id = randomUUID();
        const reportedAt = now();
        db.prepare(
          `INSERT INTO chat_reports
          (id, reporter_id, sender_id, message_id, sender_name, message_text, sent_at, reason, details, reported_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          id,
          userId,
          message.sender_id!,
          input.messageId,
          message.name!,
          message.text!,
          message.sent_at!,
          input.reason,
          input.details,
          reportedAt,
        );
        db.exec("COMMIT");
        return {
          id,
          messageId: input.messageId,
          senderName: String(message.name),
          reason: input.reason,
          status: "pending",
          reportedAt,
        };
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },
    pending() {
      return db
        .prepare(
          `SELECT ${columns} FROM chat_reports WHERE status = 'pending' AND reported_at > ?
        ORDER BY reported_at, id LIMIT 100`,
        )
        .all(now() - REPORT_RETENTION_MS);
    },
    inspect(id: string) {
      return db
        .prepare(
          `SELECT ${columns}, reporter_id AS reporterId, sender_id AS senderId,
        message_text AS text, sent_at AS sentAt, details, resolved_at AS resolvedAt
        FROM chat_reports WHERE id = ? AND reported_at > ?`,
        )
        .get(id, now() - REPORT_RETENTION_MS);
    },
    resolve(id: string, action: "remove" | "dismiss") {
      db.exec("BEGIN IMMEDIATE");
      try {
        const report = db
          .prepare(
            "SELECT message_id, status FROM chat_reports WHERE id = ? AND reported_at > ?",
          )
          .get(id, now() - REPORT_RETENTION_MS);
        if (!report) throw new ReportError(404, "신고를 찾을 수 없습니다.");
        const status = action === "remove" ? "removed" : "dismissed";
        if (report.status !== "pending" && report.status !== status)
          throw new ReportError(409, "이미 다른 결과로 처리된 신고입니다.");
        if (report.status === "pending") {
          if (action === "remove") {
            db.prepare("DELETE FROM chat_messages WHERE id = ?").run(
              report.message_id!,
            );
            db.prepare(
              "UPDATE chat_reports SET status = 'removed', resolved_at = ? WHERE message_id = ? AND status = 'pending'",
            ).run(now(), report.message_id!);
          } else
            db.prepare(
              "UPDATE chat_reports SET status = 'dismissed', resolved_at = ? WHERE id = ?",
            ).run(now(), id);
        }
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },
  };
}
