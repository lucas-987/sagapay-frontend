export interface TransferPayload {
  toUserId: string;
  amount: { amount: string; currency: string };
  note?: string;
}

export interface Intent {
  key: string;
  payload: TransferPayload;
}

export function payloadOf({
  recipientId,
  amount,
  currency,
  note,
}: {
  recipientId: string;
  amount: string;
  currency: string;
  note: string;
}): TransferPayload {
  return {
    toUserId: recipientId,
    amount: { amount: amount.trim(), currency },
    ...(note === "" ? {} : { note }),
  };
}

function samePayload(a: TransferPayload, b: TransferPayload): boolean {
  return (
    a.toUserId === b.toUserId &&
    a.amount.amount === b.amount.amount &&
    a.amount.currency === b.amount.currency &&
    a.note === b.note
  );
}

export function intentFor(
  previous: Intent | undefined,
  payload: TransferPayload,
  newKey: () => string,
): Intent {
  return previous !== undefined && samePayload(previous.payload, payload)
    ? previous
    : { key: newKey(), payload };
}
