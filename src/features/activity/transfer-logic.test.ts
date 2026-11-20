import { expect, test } from "vitest";
import {
  avatarColorOf,
  counterpartyOf,
  describeFailure,
  describeStep,
  directionOf,
  formatDate,
  formatDateTime,
  idsToAsk,
  initialsOf,
  signedAmount,
  statusLabel,
  statusTone,
  type Transfer,
} from "./transfer-logic";

const customer = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";

function transfer(overrides: Partial<Transfer>): Transfer {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    senderId: customer,
    recipientId: other,
    amount: { amount: "10.00", currency: "EUR" },
    status: "POSTED",
    createdAt: "2026-11-12T12:00:00Z",
    ...overrides,
  };
}

test.each([
  { status: "INITIATED", label: "Processing" },
  { status: "SCREENING", label: "Checking" },
  { status: "CLEARED", label: "Checked" },
  { status: "POSTED", label: "Completed" },
  { status: "BLOCKED", label: "Verification needed" },
  { status: "FAILED", label: "Failed" },
  { status: "REVERSED", label: "Processing" },
] as const)("labels the API status $status as $label", ({ status, label }) => {
  expect(statusLabel(status)).toBe(label);
});

test.each([
  { status: "POSTED", tone: "success" },
  { status: "FAILED", tone: "error" },
  { status: "SCREENING", tone: "primary" },
  { status: "INITIATED", tone: "warning" },
  { status: "CLEARED", tone: "warning" },
  { status: "BLOCKED", tone: "warning" },
] as const)("shows $status with the $tone tone", ({ status, tone }) => {
  expect(statusTone(status)).toBe(tone);
});

test("a transfer the customer sent is sent", () => {
  expect(directionOf(transfer({}), customer)).toBe("sent");
});

test("a transfer someone else sent is received", () => {
  expect(
    directionOf(transfer({ senderId: other, recipientId: customer }), customer),
  ).toBe("received");
});

test("a transfer to oneself is sent", () => {
  expect(directionOf(transfer({ recipientId: customer }), customer)).toBe(
    "sent",
  );
});

test("the other party of a sent transfer is the recipient, with the name received", () => {
  expect(
    counterpartyOf(transfer({}), customer, { [other]: "Olivia Martin" }),
  ).toEqual({
    id: other,
    name: "Olivia Martin",
    subtitle: "Sent",
  });
});

test("the other party of a received transfer is the sender, with the name received", () => {
  expect(
    counterpartyOf(
      transfer({ senderId: other, recipientId: customer }),
      customer,
      { [other]: "Noah Williams", [customer]: "Julien Simon" },
    ),
  ).toEqual({ id: other, name: "Noah Williams", subtitle: "Received" });
});

test("a sent transfer whose name did not arrive shows the generic recipient label", () => {
  expect(counterpartyOf(transfer({}), customer, {})).toEqual({
    id: other,
    name: "Recipient",
    subtitle: "Sent",
  });
});

test("a received transfer whose name did not arrive shows the generic sender label", () => {
  expect(
    counterpartyOf(
      transfer({ senderId: other, recipientId: customer }),
      customer,
      {},
    ),
  ).toEqual({ id: other, name: "Sender", subtitle: "Received" });
});

test("a sent transfer without a recipient id has no other party id and the generic label", () => {
  expect(
    counterpartyOf(transfer({ recipientId: undefined }), customer, {
      [other]: "Olivia Martin",
    }),
  ).toEqual({ id: undefined, name: "Recipient", subtitle: "Sent" });
});

test("a transfer to oneself shows the customer's own id as the other party", () => {
  expect(
    counterpartyOf(transfer({ recipientId: customer }), customer, {
      [customer]: "Julien Simon",
    }),
  ).toEqual({ id: customer, name: "Julien Simon", subtitle: "Sent" });
});

test.each([
  { direction: "sent", expected: "−1,250.50 EUR" },
  { direction: "received", expected: "+1,250.50 EUR" },
] as const)(
  "shows a $direction amount as $expected",
  ({ direction, expected }) => {
    expect(
      signedAmount(direction, { amount: "1250.50", currency: "EUR" }),
    ).toBe(expected);
  },
);

test("asks each distinct id once, in the order of the page", () => {
  expect(idsToAsk(["b", "a", "b", "c", "a"], new Set())).toEqual([
    ["b", "a", "c"],
  ]);
});

test("does not ask an id that was already asked", () => {
  expect(idsToAsk(["a", "b", "c"], new Set(["b"]))).toEqual([["a", "c"]]);
});

test("asks nothing when every id was already asked", () => {
  expect(idsToAsk(["a"], new Set(["a"]))).toEqual([]);
});

test("asks nothing for no id", () => {
  expect(idsToAsk([], new Set())).toEqual([]);
});

test.each([
  { count: 50, sizes: [50] },
  { count: 51, sizes: [50, 1] },
  { count: 100, sizes: [50, 50] },
  { count: 101, sizes: [50, 50, 1] },
])("splits $count distinct ids into requests of $sizes", ({ count, sizes }) => {
  const ids = Array.from({ length: count }, (_, i) => `id-${String(i)}`);
  const requests = idsToAsk(ids, new Set());
  expect(requests.map((request) => request.length)).toEqual(sizes);
  expect(requests.flat()).toEqual(ids);
});

test.each([
  { name: "Olivia Martin", initials: "OM" },
  { name: "Noah", initials: "N" },
  { name: "Jean Pierre Dupont", initials: "JP" },
  { name: "  lucas   bernard ", initials: "LB" },
])("takes the initials $initials from $name", ({ name, initials }) => {
  expect(initialsOf(name)).toBe(initials);
});

test("gives the same avatar colour to the same account id and one of the palette", () => {
  const color = avatarColorOf(other);
  expect(avatarColorOf(other)).toBe(color);
  expect(color).toMatch(/^#[0-9a-f]{6}$/);
  expect(avatarColorOf(undefined)).toMatch(/^#[0-9a-f]{6}$/);
});

test.each([
  { step: "RESERVE", outcome: "OK", title: "Funds reserved", result: "Done" },
  { step: "SCREEN", outcome: "OK", title: "Checked", result: "Done" },
  { step: "POST", outcome: "RETRY", title: "Posted", result: "Retrying" },
  {
    step: "RELEASE",
    outcome: "FAILED",
    title: "Funds released",
    result: "Failed",
  },
  {
    step: "REVERSE",
    outcome: "COMPENSATED",
    title: "Reversed",
    result: "Compensated",
  },
  { step: "OTHER", outcome: "ODD", title: "OTHER", result: "ODD" },
  { step: undefined, outcome: undefined, title: "Step", result: "" },
])(
  "describes the saga step $step with outcome $outcome",
  ({ step, outcome, title, result }) => {
    expect(describeStep({ step, outcome })).toEqual({ title, result });
  },
);

test.each([
  { code: "INSUFFICIENT_FUNDS", text: "Insufficient funds" },
  { code: "RECIPIENT_NOT_FOUND", text: "Recipient not found" },
  { code: "X", text: "X" },
])("writes the failure code $code as $text", ({ code, text }) => {
  expect(describeFailure(code)).toBe(text);
});

test("shows the date of a transfer in the customer's time zone", () => {
  expect(formatDate("2026-11-12T12:00:00Z")).toBe("12 Nov 2026");
});

test("shows the date and time of a transfer in the customer's time zone", () => {
  expect(formatDateTime("2026-11-12T12:05:00Z")).toBe("12 Nov 2026, 12:05");
});
