import type { components } from "../../api/generated/transfer";

type Transfer = components["schemas"]["Transfer"];

const heldStatus: Transfer["status"] = "BLOCKED";

type TransferDetail = components["schemas"]["TransferDetail"];

export function verificationDeadlineOf(
  transfer: Pick<Transfer, "status"> &
    Pick<TransferDetail, "confirmationDeadline">,
): string | undefined {
  return transfer.status === heldStatus
    ? (transfer.confirmationDeadline ?? undefined)
    : undefined;
}
