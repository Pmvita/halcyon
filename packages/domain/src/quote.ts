import type { QuoteStatus } from "./budget";

export type LiveQuote = {
  symbol: string;
  bid: number;
  ask: number;
  last: number;
  prev: number;
  changePct: number;
  asOf: string;
  source: string;
  status: QuoteStatus;
  currency: string;
  session: string;
  detail?: string;
};

export type Bar = { t: string; o: number; h: number; l: number; c: number; v: number };
