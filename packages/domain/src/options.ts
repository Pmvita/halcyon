function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const t = 1 / (1 + p * ax);
  const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax);
  return sign * y;
}

function cdf(x: number): number {
  return 0.5 * (1 + erf(x / Math.SQRT2));
}

export type Greeks = { price: number; delta: number; gamma: number; theta: number; vega: number };

export function blackScholes(input: {
  type: "call" | "put";
  spot: number;
  strike: number;
  rate: number;
  iv: number;
  years: number;
}): Greeks {
  const { type, spot, strike, rate, iv, years } = input;
  const intrinsic = type === "call" ? Math.max(0, spot - strike) : Math.max(0, strike - spot);
  if (years <= 0 || iv <= 0 || spot <= 0 || strike <= 0) {
    const delta = intrinsic <= 0 ? 0 : type === "call" ? 1 : -1;
    return { price: intrinsic, delta, gamma: 0, theta: 0, vega: 0 };
  }
  const vol = iv * Math.sqrt(years);
  const d1 = (Math.log(spot / strike) + (rate + (iv * iv) / 2) * years) / vol;
  const d2 = d1 - vol;
  const nd1 = cdf(d1);
  const nd2 = cdf(d2);
  const pdf = Math.exp(-0.5 * d1 * d1) / Math.sqrt(2 * Math.PI);
  const call = spot * nd1 - strike * Math.exp(-rate * years) * nd2;
  const price = type === "call" ? call : call - spot + strike * Math.exp(-rate * years);
  const delta = type === "call" ? nd1 : nd1 - 1;
  const gamma = pdf / (spot * vol);
  const vega = (spot * pdf * Math.sqrt(years)) / 100;
  const theta =
    (-(spot * pdf * iv) / (2 * Math.sqrt(years)) -
      (type === "call" ? 1 : -1) * rate * strike * Math.exp(-rate * years) * cdf(type === "call" ? d2 : -d2)) /
    365;
  return { price: Math.max(0, price), delta, gamma, theta, vega };
}

export function optionExpiry(input: {
  type: "call" | "put";
  position: "long" | "short";
  strike: number;
  spot: number;
  contracts: number;
  multiplier?: number;
}): { exercise: boolean; cashMinor: number; shareDelta: number; note: string } {
  const multiplier = input.multiplier ?? 100;
  const shares = input.contracts * multiplier;
  const itm = input.type === "call" ? input.spot > input.strike : input.spot < input.strike;
  if (!itm) {
    return { exercise: false, cashMinor: 0, shareDelta: 0, note: "Expired worthless. No shares were assigned." };
  }
  const cashMajor = input.strike * shares;
  const sign = input.position === "long" ? 1 : -1;
  const shareSign = input.type === "call" ? sign : -sign;
  return {
    exercise: true,
    cashMinor: Math.round(-sign * cashMajor * 100),
    shareDelta: shareSign * shares,
    note: input.position === "long" ? "Exercised at the strike." : "Assigned at the strike.",
  };
}

export function payoffSeries(input: {
  type: "call" | "put";
  strike: number;
  premium: number;
  from: number;
  to: number;
  steps?: number;
}): { spot: number; value: number }[] {
  const steps = input.steps ?? 40;
  const points: { spot: number; value: number }[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const spot = input.from + ((input.to - input.from) * i) / steps;
    const intrinsic = input.type === "call" ? Math.max(0, spot - input.strike) : Math.max(0, input.strike - spot);
    points.push({ spot, value: intrinsic - input.premium });
  }
  return points;
}

/** Model price of a par Treasury, semi-annual coupons. Not a dealer quote. */
export function treasuryModelPrice(yieldDecimal: number, years: number, couponDecimal?: number): number {
  const coupon = couponDecimal ?? yieldDecimal;
  if (years <= 0) return 100;
  const periods = Math.max(1, Math.round(years * 2));
  const y = yieldDecimal / 2;
  const c = (coupon * 100) / 2;
  if (Math.abs(y) < 1e-8) return c * periods + 100;
  const annuity = (1 - Math.pow(1 + y, -periods)) / y;
  return c * annuity + 100 / Math.pow(1 + y, periods);
}

export function modifiedDuration(yieldDecimal: number, years: number): number {
  return years / (1 + yieldDecimal);
}
