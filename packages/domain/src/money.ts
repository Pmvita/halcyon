import { HalcyonError } from "./errors";

export function dollarsToMinor(input: string): number {
  const clean = input.trim().replace(/[$,\s]/g, "");
  if (!/^-?\d+(\.\d{1,2})?$/.test(clean)) {
    throw new HalcyonError("amount", "Enter an amount with at most two decimal places.");
  }
  const negative = clean.startsWith("-");
  const [wholeRaw, fracRaw = ""] = clean.replace("-", "").split(".");
  const whole = Number(wholeRaw);
  const frac = Number((fracRaw + "00").slice(0, 2));
  if (!Number.isSafeInteger(whole) || whole > 20_000_000) {
    throw new HalcyonError("amount", "That amount is outside the demo limit.");
  }
  return (negative ? -1 : 1) * (whole * 100 + frac);
}

export function minorToDollars(minor: number): number {
  return minor / 100;
}

export function roundMinor(major: number): number {
  return Math.round(major * 100);
}

export function assertPositiveMinor(amountMinor: number): void {
  if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
    throw new HalcyonError("amount", "Enter an amount greater than zero.");
  }
}
