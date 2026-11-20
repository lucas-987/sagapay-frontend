import type { ApiError } from "../../api/api-error";

export type ConfirmOutcome =
  "incorrect" | "expired" | "resolved" | "not-found" | "failed";

const refusals: Record<string, ConfirmOutcome | undefined> = {
  INVALID_VERIFICATION_CODE: "incorrect",
  VERIFICATION_EXPIRED: "expired",
  TRANSFER_NOT_BLOCKED: "resolved",
  TRANSFER_NOT_FOUND: "not-found",
};

export function confirmOutcomeOf(error: ApiError): ConfirmOutcome {
  return (
    (error.kind === "problem" ? refusals[error.code] : undefined) ?? "failed"
  );
}
