export interface TransferEventData {
  transferId: string;
  senderId: string;
  recipientId: string;
  amount: string;
  currency: string;
}

export type StreamEvent = { id: string } & (
  | ({ type: "transfer.posted" } & TransferEventData)
  | ({
      type: "transfer.blocked";
      confirmationDeadline: string | undefined;
    } & TransferEventData)
  | ({ type: "transfer.failed"; cause: string | undefined } & TransferEventData)
);

export interface RawStreamMessage {
  id: string;
  event: string;
  data: string;
}

function textOf(value: unknown): string | undefined {
  return typeof value === "string" && value !== "" ? value : undefined;
}

function optionalTextOf(value: unknown): string | undefined | null {
  if (value === undefined) return undefined;
  return typeof value === "string" ? value : null;
}

function transferDataOf(data: object): TransferEventData | undefined {
  const record = data as Record<string, unknown>;
  const transferId = textOf(record.transferId);
  const senderId = textOf(record.senderId);
  const recipientId = textOf(record.recipientId);
  const amount = textOf(record.amount);
  const currency = textOf(record.currency);
  if (
    transferId === undefined ||
    senderId === undefined ||
    recipientId === undefined ||
    amount === undefined ||
    currency === undefined
  ) {
    return undefined;
  }
  return { transferId, senderId, recipientId, amount, currency };
}

function parseObject(text: string): object | undefined {
  try {
    const parsed: unknown = JSON.parse(text);
    return typeof parsed === "object" &&
      parsed !== null &&
      !Array.isArray(parsed)
      ? parsed
      : undefined;
  } catch {
    return undefined;
  }
}

export function decodeStreamEvent({
  id,
  event,
  data,
}: RawStreamMessage): StreamEvent | undefined {
  if (id === "") return undefined;
  const parsed = parseObject(data);
  if (parsed === undefined) return undefined;
  const transfer = transferDataOf(parsed);
  if (transfer === undefined) return undefined;
  const extra = parsed as Record<string, unknown>;

  switch (event) {
    case "transfer.posted":
      return { type: event, id, ...transfer };
    case "transfer.blocked": {
      const confirmationDeadline = optionalTextOf(extra.confirmationDeadline);
      return confirmationDeadline === null
        ? undefined
        : { type: event, id, ...transfer, confirmationDeadline };
    }
    case "transfer.failed": {
      const cause = optionalTextOf(extra.cause);
      return cause === null
        ? undefined
        : { type: event, id, ...transfer, cause };
    }
    default:
      return undefined;
  }
}
