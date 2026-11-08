export const FEE = {
  equityCommission: 0,
  equityPassThroughPerShare: 0.0002,
  optionPerContract: 0.05,
  cryptoTakerBps: 10,
  cryptoMakerBps: 4,
  fxSpreadBps: 40,
  wireDomesticMinor: 1500,
  overdraftMinor: 2500,
  wireCutoffHourEt: 15,
  cashbackBps: 100,
  stepUpMinor: 500_000,
  dailySendMinor: 5_000_000,
  hysaApyBps: 415,
} as const;

export type AssetClass = "equity" | "etf" | "option" | "fx" | "bond" | "commodity" | "crypto";

export function slippageBps(notional: number): number {
  const bps = 0.5 * Math.sqrt(Math.max(notional, 1_000) / 1_000);
  return Math.min(15, Math.max(0.5, bps));
}

export function equitySpreadBps(price: number): number {
  if (price >= 100) return 1;
  if (price >= 20) return 2;
  if (price >= 5) return 3;
  return 5;
}

export function tradeFee(assetClass: AssetClass, liquidity: "maker" | "taker", qty: number, price: number): number {
  const notional = Math.abs(qty * price);
  if (assetClass === "crypto") {
    const bps = liquidity === "taker" ? FEE.cryptoTakerBps : FEE.cryptoMakerBps;
    return (notional * bps) / 10_000;
  }
  if (assetClass === "option") return Math.abs(qty) * FEE.optionPerContract;
  if (assetClass === "fx" || assetClass === "bond") return 0;
  return Math.max(qty === 0 ? 0 : 0.01, Math.abs(qty) * FEE.equityPassThroughPerShare);
}

export function displayedDepth(assetClass: AssetClass): number {
  if (assetClass === "crypto") return 0.5;
  if (assetClass === "option") return 10;
  if (assetClass === "fx") return 100_000;
  if (assetClass === "bond") return 10;
  return 40;
}
