import { describe, expect, test } from "vitest";
import { intentFor, payloadOf, type TransferPayload } from "./transfer-intent";

const payload: TransferPayload = {
  toUserId: "00000000-0000-4000-a000-000000000002",
  amount: { amount: "12.50", currency: "EUR" },
  note: "Dinner",
};

describe("payloadOf", () => {
  test("builds the request body from the form values", () => {
    expect(
      payloadOf({
        recipientId: payload.toUserId,
        amount: " 12.50 ",
        currency: "EUR",
        note: "Dinner",
      }),
    ).toStrictEqual(payload);
  });

  test("leaves the note out when it is empty", () => {
    expect(
      payloadOf({
        recipientId: payload.toUserId,
        amount: "12.50",
        currency: "EUR",
        note: "",
      }),
    ).toStrictEqual({
      toUserId: payload.toUserId,
      amount: { amount: "12.50", currency: "EUR" },
    });
  });
});

describe("intentFor", () => {
  test("starts an intent with a new key when there is none", () => {
    expect(intentFor(undefined, payload, () => "key-1")).toStrictEqual({
      key: "key-1",
      payload,
    });
  });

  test("keeps the key of an intent whose payload is unchanged", () => {
    const previous = { key: "key-1", payload };

    expect(intentFor(previous, structuredClone(payload), () => "key-2")).toBe(
      previous,
    );
  });

  test.each<[string, TransferPayload]>([
    ["recipient", { ...payload, toUserId: "other" }],
    ["amount", { ...payload, amount: { amount: "12.51", currency: "EUR" } }],
    ["currency", { ...payload, amount: { amount: "12.50", currency: "USD" } }],
    ["note", { ...payload, note: "Lunch" }],
    ["note removed", { toUserId: payload.toUserId, amount: payload.amount }],
  ])("starts a new intent when the %s changed", (_name, changed) => {
    expect(
      intentFor({ key: "key-1", payload }, changed, () => "key-2"),
    ).toStrictEqual({ key: "key-2", payload: changed });
  });
});
