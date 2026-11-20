import { describe, expect, test } from "vitest";
import { checkAmount } from "./amount";

const available = { amount: "4285.50", currency: "EUR" };

describe("checkAmount", () => {
  test.each([
    { name: "a whole amount", text: "10" },
    { name: "one cent", text: "0.01" },
    { name: "one decimal", text: "1.5" },
    { name: "two decimals", text: "12.34" },
    { name: "surrounding spaces", text: "  12.34 " },
    { name: "leading zeros", text: "007.50" },
    { name: "the available funds", text: "4285.50" },
    {
      name: "the available funds without cents",
      text: "4285.5",
    },
  ])("accepts $name", ({ text }) => {
    expect(checkAmount(text, available)).toEqual({ ok: true });
  });

  test.each([
    { name: "empty", text: "", error: "empty" },
    { name: "only spaces", text: "   ", error: "empty" },
    { name: "zero", text: "0", error: "not-positive" },
    { name: "zero with cents", text: "0.00", error: "not-positive" },
    { name: "negative", text: "-5", error: "not-positive" },
    { name: "negative cent", text: "-0.01", error: "not-positive" },
    { name: "a third decimal", text: "1.001", error: "too-precise" },
    { name: "a zero third decimal", text: "1.000", error: "too-precise" },
    { name: "a comma separator", text: "1,5", error: "format" },
    { name: "an exponent", text: "1e3", error: "format" },
    { name: "an upper-case exponent", text: "1E3", error: "format" },
    { name: "letters", text: "ten", error: "format" },
    { name: "a plus sign", text: "+5", error: "format" },
    { name: "a trailing dot", text: "5.", error: "format" },
    { name: "a leading dot", text: ".5", error: "format" },
    { name: "inner spaces", text: "1 000", error: "format" },
    {
      name: "one cent above the available funds",
      text: "4285.51",
      error: "above-available",
    },
    {
      name: "a very large value",
      text: "123456789012345678901234567890.00",
      error: "above-available",
    },
  ])("refuses $name", ({ text, error }) => {
    expect(checkAmount(text, available)).toEqual({ ok: false, error });
  });

  test("compares against available funds written with more digits than the scale", () => {
    const wallet = { amount: "10.0000", currency: "EUR" };
    expect(checkAmount("10.00", wallet)).toEqual({ ok: true });
    expect(checkAmount("10.01", wallet)).toEqual({
      ok: false,
      error: "above-available",
    });
  });

  test("uses the scale of the currency", () => {
    const yen = { amount: "500", currency: "JPY" };
    expect(checkAmount("500", yen)).toEqual({ ok: true });
    expect(checkAmount("1.5", yen)).toEqual({
      ok: false,
      error: "too-precise",
    });
  });
});
