import { FEE } from "./fees";

/** midQuotePerBase is destination currency units per 1 source currency unit. */
export function convertWithSpread(amountMinor: number, midQuotePerBase: number, side: "buy" | "sell"): {
  quoteMinor: number;
  appliedRate: number;
  spreadMinor: number;
} {
  const edge = FEE.fxSpreadBps / 10_000;
  const applied = side === "buy" ? midQuotePerBase * (1 - edge) : midQuotePerBase * (1 + edge);
  const quoteMinor = Math.round(amountMinor * applied);
  const fair = Math.round(amountMinor * midQuotePerBase);
  return { quoteMinor, appliedRate: applied, spreadMinor: Math.abs(fair - quoteMinor) };
}
