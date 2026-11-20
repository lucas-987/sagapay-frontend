import { describe, expect, test } from "vitest";
import { progressOf } from "./transfer-progress";

describe("progressOf", () => {
  test.each([
    ["INITIATED", [false, false, false]],
    ["RESERVED", [true, false, false]],
    ["SCREENING", [true, false, false]],
    ["CLEARED", [true, true, false]],
    ["BLOCKED", [true, false, false]],
    ["POSTED", [true, true, true]],
    ["SETTLED", [true, true, true]],
  ] as const)("confirms the steps reached by %s", (status, reached) => {
    expect(progressOf(status)).toStrictEqual([
      { label: "Funds reserved", reached: reached[0] },
      { label: "Checking", reached: reached[1] },
      { label: "Sent", reached: reached[2] },
    ]);
  });

  test.each(["FAILED", "REVERSED"] as const)(
    "shows no steps for %s",
    (status) => {
      expect(progressOf(status)).toStrictEqual([]);
    },
  );
});
