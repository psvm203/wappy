import assert from "node:assert/strict";
import { test } from "node:test";
import {
  parseChatReportInput,
  parseChatReportReceipt,
  parseChatReportReceipts,
  parseSidebarState,
} from "@wappy/api";

test("report boundaries validate reasons, limits, receipts and explicit server support", () => {
  const input = { messageId: 2, reason: "harassment", details: " 상황 설명 " };
  assert.deepEqual(parseChatReportInput({ ...input, senderId: "forged" }), {
    ...input,
    details: "상황 설명",
  });
  for (const value of [
    null,
    [],
    {},
    { ...input, messageId: "2" },
    { ...input, messageId: 0.5 },
    { ...input, reason: "__proto__" },
    { ...input, reason: "constructor" },
    { ...input, details: null },
    { ...input, details: "x".repeat(501) },
    { ...input, details: "\u001b" },
  ])
    assert.throws(() => parseChatReportInput(value));
  const receipt = {
    id: "report-1",
    messageId: 2,
    senderName: "친구",
    reason: "harassment",
    status: "pending",
    reportedAt: 1_800_000_000_000,
  };
  assert.deepEqual(
    parseChatReportReceipt({
      ...receipt,
      reporterId: "private",
      text: "private",
    }),
    receipt,
  );
  for (const patch of [
    { id: "" },
    { id: "x".repeat(129) },
    { messageId: -1 },
    { senderName: "" },
    { senderName: "x".repeat(25) },
    { reason: "unknown" },
    { status: "approved" },
    { reportedAt: 0 },
    { reportedAt: Infinity },
    { reportedAt: 8_640_000_000_000_001 },
  ])
    assert.throws(() => parseChatReportReceipt({ ...receipt, ...patch }));
  assert.deepEqual(parseChatReportReceipts([receipt]), [receipt]);
  for (const invalid of [
    {},
    [receipt, receipt],
    Array.from({ length: 51 }, (_, index) => ({
      ...receipt,
      id: String(index),
    })),
  ])
    assert.throws(() => parseChatReportReceipts(invalid));
  const state = {
    self: { id: "self", name: "나", character: "hachiware", status: "" },
    friends: [],
  };
  assert.equal(parseSidebarState(state).chatReporting, undefined);
  for (const chatReporting of [false, true])
    assert.equal(
      parseSidebarState({ ...state, chatReporting }).chatReporting,
      chatReporting,
    );
  for (const chatReporting of [null, 1, "true"])
    assert.throws(() => parseSidebarState({ ...state, chatReporting }));
});
