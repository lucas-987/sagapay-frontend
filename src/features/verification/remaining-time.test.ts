import { describe, expect, test } from "vitest";
import { formatRemaining, remainingMs } from "./remaining-time";

const now = Date.parse("2026-11-20T10:00:00Z");

describe("remainingMs", () => {
  test.each([
    ["a future deadline", "2026-11-20T10:01:30Z", 90_000],
    ["a deadline exactly now", "2026-11-20T10:00:00Z", 0],
    ["a past deadline", "2026-11-20T09:59:59Z", 0],
    ["a deadline with fractional seconds", "2026-11-20T10:00:01.250Z", 1_250],
    ["a deadline in a +02:00 offset", "2026-11-20T12:00:30+02:00", 30_000],
    ["a deadline in a -05:00 offset", "2026-11-20T05:00:30-05:00", 30_000],
  ])("is measured for %s", (_name, deadline, expected) => {
    expect(remainingMs(deadline, now)).toBe(expected);
  });

  test("is zero for text that is not a date", () => {
    expect(remainingMs("soon", now)).toBe(0);
  });
});

describe("formatRemaining", () => {
  test.each([
    [0, "0:00"],
    [1, "0:01"],
    [1_000, "0:01"],
    [1_001, "0:02"],
    [59_000, "0:59"],
    [59_001, "1:00"],
    [60_000, "1:00"],
    [61_000, "1:01"],
    [120_000, "2:00"],
    [599_000, "9:59"],
    [600_000, "10:00"],
  ])("shows %i ms as %s", (ms, text) => {
    expect(formatRemaining(ms)).toBe(text);
  });
});
