import type { components } from "../../api/generated/transfer";
import { formatAmount } from "../../shared/money/format-amount";

export type Transfer = components["schemas"]["Transfer"];
export type TransferDetail = components["schemas"]["TransferDetail"];
export type TransferStatus = components["schemas"]["TransferStatus"];
export type SagaStep = components["schemas"]["SagaStep"];
export type Direction = "sent" | "received";
export type StatusTone = "success" | "error" | "primary" | "warning";

export const namesRequestSize = 50;

const statusLabels: Partial<Record<TransferStatus, string>> = {
  INITIATED: "Processing",
  SCREENING: "Checking",
  CLEARED: "Checked",
  POSTED: "Completed",
  BLOCKED: "Verification needed",
  FAILED: "Failed",
};

export function statusLabel(status: TransferStatus): string {
  return statusLabels[status] ?? "Processing";
}

export function statusTone(status: TransferStatus): StatusTone {
  switch (status) {
    case "POSTED":
      return "success";
    case "FAILED":
      return "error";
    case "SCREENING":
      return "primary";
    default:
      return "warning";
  }
}

export function directionOf(
  transfer: Pick<Transfer, "senderId">,
  customerId: string,
): Direction {
  return transfer.senderId === customerId ? "sent" : "received";
}

export function counterpartyOf(
  transfer: Pick<Transfer, "senderId" | "recipientId">,
  customerId: string,
  names: Readonly<Record<string, string>>,
): { id: string | undefined; name: string; subtitle: string } {
  const sent = directionOf(transfer, customerId) === "sent";
  const id = sent ? transfer.recipientId : transfer.senderId;
  return {
    id,
    name:
      (id === undefined ? undefined : names[id]) ??
      (sent ? "Recipient" : "Sender"),
    subtitle: sent ? "Sent" : "Received",
  };
}

export function signedAmount(
  direction: Direction,
  { amount, currency }: { amount: string; currency: string },
): string {
  return `${direction === "sent" ? "−" : "+"}${formatAmount(amount, currency)}`;
}

export function idsToAsk(
  ids: readonly string[],
  asked: ReadonlySet<string>,
): string[][] {
  const wanted = [...new Set(ids)].filter((id) => !asked.has(id));
  const requests: string[][] = [];
  for (let start = 0; start < wanted.length; start += namesRequestSize) {
    requests.push(wanted.slice(start, start + namesRequestSize));
  }
  return requests;
}

export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter((word) => word !== "")
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
}

const avatarPalette = [
  "#b48ead",
  "#88c0d0",
  "#ebcb8b",
  "#a3be8c",
  "#d08770",
  "#81a1c1",
];

export function avatarColorOf(id = ""): string {
  let sum = 0;
  for (let index = 0; index < id.length; index += 1) {
    sum += id.charCodeAt(index);
  }
  return avatarPalette[sum % avatarPalette.length] ?? "#88c0d0";
}

const stepTitles: Record<string, string> = {
  RESERVE: "Funds reserved",
  SCREEN: "Checked",
  POST: "Posted",
  RELEASE: "Funds released",
  REVERSE: "Reversed",
};

const stepResults: Record<string, string> = {
  OK: "Done",
  RETRY: "Retrying",
  FAILED: "Failed",
  COMPENSATED: "Compensated",
};

export function describeStep({ step, outcome }: SagaStep): {
  title: string;
  result: string;
} {
  return {
    title: step === undefined ? "Step" : (stepTitles[step] ?? step),
    result: outcome === undefined ? "" : (stepResults[outcome] ?? outcome),
  };
}

export function describeFailure(code: string): string {
  const words = code.toLowerCase().replaceAll("_", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}
