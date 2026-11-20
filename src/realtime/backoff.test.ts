import { describe, expect, test } from "vitest";
import { createBackoff } from "./backoff";

const options = { initialDelayMs: 1000, maxDelayMs: 8000 };

describe("createBackoff", () => {
  test("doubles the upper bound of the delay up to the maximum", () => {
    const backoff = createBackoff({ ...options, random: () => 1 });

    expect([1, 2, 3, 4, 5, 6].map(() => backoff.next())).toEqual([
      1000, 2000, 4000, 8000, 8000, 8000,
    ]);
  });

  test("keeps half of the bound at least, and jitters the other half", () => {
    const low = createBackoff({ ...options, random: () => 0 });
    const middle = createBackoff({ ...options, random: () => 0.5 });

    expect([low.next(), low.next()]).toEqual([500, 1000]);
    expect([middle.next(), middle.next()]).toEqual([750, 1500]);
  });

  test("never exceeds the maximum however many attempts fail", () => {
    const backoff = createBackoff({ ...options, random: () => 0.999 });
    const delays = Array.from({ length: 2000 }, () => backoff.next());

    expect(Math.max(...delays)).toBeLessThanOrEqual(8000);
    expect(delays.at(-1)).toBeGreaterThan(7900);
  });

  test("starts again from the initial delay after a reset", () => {
    const backoff = createBackoff({ ...options, random: () => 1 });
    backoff.next();
    backoff.next();
    backoff.next();

    backoff.reset();

    expect(backoff.next()).toBe(1000);
  });
});
