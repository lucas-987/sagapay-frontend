import { useState } from "react";
import { useGetWalletQuery } from "../activity";
import { checkAmount, type AmountCheck } from "./amount";
import type { Recipient } from "./recipient-api";
import { payloadOf } from "./transfer-intent";
import { useRecipientLookup } from "./use-recipient-lookup";
import { useSubmitTransfer } from "./use-submit-transfer";

export const noteMaxLength = 200;

export function useSendForm() {
  const wallet = useGetWalletQuery(undefined);
  const [typedHandle, setTypedHandle] = useState("");
  const [recipient, setRecipient] = useState<Recipient | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const lookup = useRecipientLookup(typedHandle);

  const available = wallet.data?.available;
  const amountCheck: AmountCheck | undefined =
    available === undefined ? undefined : checkAmount(amount, available);
  const noteTooLong = note.length > noteMaxLength;
  const canSend =
    recipient !== null &&
    available !== undefined &&
    amountCheck?.ok === true &&
    !noteTooLong;
  const submission = useSubmitTransfer(
    canSend
      ? payloadOf({
          recipientId: recipient.accountId,
          amount,
          currency: available.currency,
          note,
        })
      : undefined,
  );

  return {
    wallet: {
      status: wallet.isError
        ? ("error" as const)
        : available === undefined
          ? ("pending" as const)
          : ("loaded" as const),
      available,
      retry: () => {
        void wallet.refetch();
      },
    },
    recipient: {
      typed: typedHandle,
      selected: recipient,
      lookup,
      type: (text: string) => {
        setTypedHandle(text);
        setRecipient(null);
      },
      select: setRecipient,
    },
    amount: { text: amount, check: amountCheck, change: setAmount },
    note: { text: note, tooLong: noteTooLong, change: setNote },
    canSend: canSend && !submission.sending,
    submission,
  };
}

export type SendForm = ReturnType<typeof useSendForm>;
