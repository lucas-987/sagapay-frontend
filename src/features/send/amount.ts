import type { Money } from "../activity";

export type AmountError =
  "empty" | "format" | "not-positive" | "too-precise" | "above-available";

export type AmountCheck = { ok: true } | { ok: false; error: AmountError };

const decimal = /^(-?)(\d+)(?:\.(\d+))?$/;

function scaleOf(currency: string): number {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
  }).resolvedOptions().maximumFractionDigits as number;
}

function unitsAt(whole: string, fraction: string, scale: number): bigint {
  return BigInt(whole + fraction.padEnd(scale, "0"));
}

export function checkAmount(text: string, available: Money): AmountCheck {
  const trimmed = text.trim();
  if (trimmed === "") return { ok: false, error: "empty" };
  const parts = decimal.exec(trimmed);
  if (parts === null) return { ok: false, error: "format" };
  const [, sign, whole = "", fraction = ""] = parts;
  const scale = scaleOf(available.currency);
  if (sign === "-" || BigInt(whole + fraction) === 0n) {
    return { ok: false, error: "not-positive" };
  }
  if (fraction.length > scale) return { ok: false, error: "too-precise" };

  const [availableWhole = "", availableFraction = ""] =
    available.amount.split(".");
  const commonScale = Math.max(scale, availableFraction.length);
  if (
    unitsAt(whole, fraction, commonScale) >
    unitsAt(availableWhole, availableFraction, commonScale)
  ) {
    return { ok: false, error: "above-available" };
  }
  return { ok: true };
}
