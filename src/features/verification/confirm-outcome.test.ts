import { describe, expect, test } from "vitest";
import type { ApiError } from "../../api/api-error";
import { confirmOutcomeOf } from "./confirm-outcome";

const problem = (status: number, code: string): ApiError => ({
  kind: "problem",
  status,
  code,
});

describe("confirmOutcomeOf", () => {
  test.each<[string, ApiError, string]>([
    [
      "422 INVALID_VERIFICATION_CODE",
      problem(422, "INVALID_VERIFICATION_CODE"),
      "incorrect",
    ],
    [
      "410 VERIFICATION_EXPIRED",
      problem(410, "VERIFICATION_EXPIRED"),
      "expired",
    ],
    [
      "409 TRANSFER_NOT_BLOCKED",
      problem(409, "TRANSFER_NOT_BLOCKED"),
      "resolved",
    ],
    ["404 TRANSFER_NOT_FOUND", problem(404, "TRANSFER_NOT_FOUND"), "not-found"],
    ["another 422 code", problem(422, "IDEMPOTENCY_KEY_REUSED"), "failed"],
    ["a 500 problem", problem(500, "INTERNAL"), "failed"],
    ["an uncertain outcome", { kind: "uncertain" }, "failed"],
    ["an unauthenticated outcome", { kind: "unauthenticated" }, "failed"],
    [
      "an unexpected 410 without a code",
      { kind: "unexpected", status: 410 },
      "failed",
    ],
  ])("maps %s to %s", (_name, error, outcome) => {
    expect(confirmOutcomeOf(error)).toBe(outcome);
  });
});
