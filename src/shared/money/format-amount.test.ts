import { expect, test } from "vitest";
import { formatAmount } from "./format-amount";

test.each([
  { amount: "0", expected: "0 EUR" },
  { amount: "0.10", expected: "0.10 EUR" },
  { amount: "999", expected: "999 EUR" },
  { amount: "1000", expected: "1,000 EUR" },
  { amount: "4285.50", expected: "4,285.50 EUR" },
  { amount: "1234567.891", expected: "1,234,567.891 EUR" },
  { amount: "-1500.25", expected: "-1,500.25 EUR" },
  {
    amount: "12345678901234567890.12",
    expected: "12,345,678,901,234,567,890.12 EUR",
  },
  { amount: "9007199254740993.01", expected: "9,007,199,254,740,993.01 EUR" },
  { amount: "not a number", expected: "not a number EUR" },
  { amount: "", expected: " EUR" },
])("shows $amount as $expected without rounding", ({ amount, expected }) => {
  expect(formatAmount(amount, "EUR")).toBe(expected);
});
