import { useRef, useState } from "react";
import type { ApiError } from "../../api/api-error";
import type { Transfer } from "../activity";
import {
  intentFor,
  samePayload,
  type TransferIntent,
  type TransferPayload,
} from "./transfer-intent";
import { useCreateTransferMutation } from "./transfer-api";

export type SendNoticeKind = "uncertain" | "key-reused" | "failed";

type Outcome =
  | { kind: SendNoticeKind; payload: TransferPayload }
  | { kind: "accepted"; transfer: Transfer };

function noticeOf(error: ApiError): SendNoticeKind {
  if (error.kind === "uncertain") return "uncertain";
  return error.kind === "problem" && error.code === "IDEMPOTENCY_KEY_REUSED"
    ? "key-reused"
    : "failed";
}

export function useSubmitTransfer(payload: TransferPayload | undefined) {
  const [createTransfer, { isLoading }] = useCreateTransferMutation();
  const [intent, setIntent] = useState<TransferIntent>();
  const [outcome, setOutcome] = useState<Outcome>();

  const inFlight = useRef(false);

  async function send(toSend: TransferPayload) {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const current = intentFor(intent, toSend, () => crypto.randomUUID());
      setIntent(current);
      const transfer = await createTransfer(current).unwrap();
      setOutcome({ kind: "accepted", transfer });
    } catch (error) {
      const notice = noticeOf(error as ApiError);
      if (notice === "key-reused") setIntent(undefined);
      setOutcome({ kind: notice, payload: toSend });
    } finally {
      inFlight.current = false;
    }
  }

  return {
    submit:
      payload === undefined
        ? undefined
        : () => {
            void send(payload);
          },
    sending: isLoading,
    accepted: outcome?.kind === "accepted" ? outcome.transfer : undefined,
    notice:
      outcome !== undefined &&
      outcome.kind !== "accepted" &&
      payload !== undefined &&
      samePayload(outcome.payload, payload)
        ? outcome.kind
        : undefined,
  };
}
