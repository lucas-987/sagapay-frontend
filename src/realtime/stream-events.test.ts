import { describe, expect, test } from "vitest";
import { decodeStreamEvent } from "./stream-events";

const eventId = "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed";
const transferId = "7d1d2a3e-5a0e-4c7a-9a55-0c7a4b1f2e01";
const body = {
  transferId,
  senderId: "00000000-0000-4000-a000-000000000001",
  recipientId: "00000000-0000-4000-a000-000000000002",
  amount: "25.00",
  currency: "EUR",
};

function message(event: string | undefined, data: unknown, id = eventId) {
  return {
    event: event ?? "",
    id,
    data: typeof data === "string" ? data : JSON.stringify(data),
  };
}

describe("decodeStreamEvent", () => {
  test("decodes a posted event", () => {
    expect(decodeStreamEvent(message("transfer.posted", body))).toEqual({
      type: "transfer.posted",
      id: eventId,
      ...body,
    });
  });

  test("decodes a blocked event with its deadline", () => {
    const confirmationDeadline = "2026-11-12T12:05:00Z";

    expect(
      decodeStreamEvent(
        message("transfer.blocked", { ...body, confirmationDeadline }),
      ),
    ).toEqual({
      type: "transfer.blocked",
      id: eventId,
      ...body,
      confirmationDeadline,
    });
  });

  test("decodes a blocked event without a deadline", () => {
    expect(decodeStreamEvent(message("transfer.blocked", body))).toEqual({
      type: "transfer.blocked",
      id: eventId,
      ...body,
      confirmationDeadline: undefined,
    });
  });

  test("decodes a failed event with its cause", () => {
    expect(
      decodeStreamEvent(
        message("transfer.failed", { ...body, cause: "INSUFFICIENT_FUNDS" }),
      ),
    ).toEqual({
      type: "transfer.failed",
      id: eventId,
      ...body,
      cause: "INSUFFICIENT_FUNDS",
    });
  });

  test("decodes a failed event without a cause", () => {
    expect(decodeStreamEvent(message("transfer.failed", body))).toEqual({
      type: "transfer.failed",
      id: eventId,
      ...body,
      cause: undefined,
    });
  });

  test.each([
    "transferId",
    "senderId",
    "recipientId",
    "amount",
    "currency",
  ] as const)("drops an event without %s", (field) => {
    const { [field]: _omitted, ...incomplete } = body;

    expect(
      decodeStreamEvent(message("transfer.posted", incomplete)),
    ).toBeUndefined();
  });

  test.each([
    { why: "a number", value: 25 },
    { why: "an empty string", value: "" },
    { why: "null", value: null },
  ])("drops an event whose amount is $why", ({ value }) => {
    expect(
      decodeStreamEvent(message("transfer.posted", { ...body, amount: value })),
    ).toBeUndefined();
  });

  test("drops an event without an id", () => {
    expect(
      decodeStreamEvent(message("transfer.posted", body, "")),
    ).toBeUndefined();
  });

  test.each([
    { why: "unknown", name: "transfer.created" },
    { why: "missing", name: undefined },
    { why: "empty", name: "" },
  ])("drops an event whose name is $why", ({ name }) => {
    expect(decodeStreamEvent(message(name, body))).toBeUndefined();
  });

  test.each([
    { why: "not JSON", data: "{not json" },
    { why: "empty", data: "" },
    { why: "a JSON array", data: "[]" },
    { why: "JSON null", data: "null" },
    { why: "a JSON string", data: '"posted"' },
  ])("drops an event whose data is $why", ({ data }) => {
    expect(decodeStreamEvent(message("transfer.posted", data))).toBeUndefined();
  });

  test("drops a blocked event whose deadline is not text", () => {
    expect(
      decodeStreamEvent(
        message("transfer.blocked", { ...body, confirmationDeadline: 12 }),
      ),
    ).toBeUndefined();
  });

  test("drops a failed event whose cause is not text", () => {
    expect(
      decodeStreamEvent(message("transfer.failed", { ...body, cause: 7 })),
    ).toBeUndefined();
  });
});
