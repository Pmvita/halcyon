import type { AssetClass } from "@halcyon/domain";

export type Instrument = {
  symbol: string;
  name: string;
  assetClass: AssetClass;
  currency: string;
  sector: string;
  close: number;
  marketCap: number;
  dividendYield: number;
  volume: number;
  about: string;
  proxy?: string;
};

/** Versioned snapshot. Not a live close. Source label: Halcyon seed snapshot 2026-11-06. */
export const SNAPSHOT_DATE = "2026-11-06";
export const SNAPSHOT_SOURCE = "Halcyon seed snapshot 2026-11-06";

export const INSTRUMENTS: Instrument[] = [
  { symbol: "AAPL", name: "Apple", assetClass: "equity", currency: "USD", sector: "Technology", close: 228.4, marketCap: 3_400_000_000_000, dividendYield: 0.0044, volume: 54_000_000, about: "Consumer hardware, software, and services. Snapshot profile for the demo universe." },
  { symbol: "MSFT", name: "Microsoft", assetClass: "equity", currency: "USD", sector: "Technology", close: 418.2, marketCap: 3_100_000_000_000, dividendYield: 0.007, volume: 22_000_000, about: "Software, cloud, and productivity. Snapshot profile." },
  { symbol: "NVDA", name: "NVIDIA", assetClass: "equity", currency: "USD", sector: "Technology", close: 142.6, marketCap: 3_500_000_000_000, dividendYield: 0.0003, volume: 180_000_000, about: "Accelerated computing. Snapshot profile." },
  { symbol: "AMZN", name: "Amazon", assetClass: "equity", currency: "USD", sector: "Consumer", close: 197.5, marketCap: 2_100_000_000_000, dividendYield: 0, volume: 38_000_000, about: "Retail and cloud. Snapshot profile." },
  { symbol: "GOOGL", name: "Alphabet", assetClass: "equity", currency: "USD", sector: "Communication", close: 176.1, marketCap: 2_150_000_000_000, dividendYield: 0.003, volume: 28_000_000, about: "Search and cloud. Snapshot profile." },
  { symbol: "META", name: "Meta Platforms", assetClass: "equity", currency: "USD", sector: "Communication", close: 586.4, marketCap: 1_480_000_000_000, dividendYield: 0.003, volume: 15_000_000, about: "Social platforms. Snapshot profile." },
  { symbol: "JPM", name: "JPMorgan Chase", assetClass: "equity", currency: "USD", sector: "Financials", close: 224.8, marketCap: 640_000_000_000, dividendYield: 0.021, volume: 9_000_000, about: "Banking. Snapshot profile. Halcyon is not affiliated." },
  { symbol: "XOM", name: "Exxon Mobil", assetClass: "equity", currency: "USD", sector: "Energy", close: 116.2, marketCap: 510_000_000_000, dividendYield: 0.033, volume: 14_000_000, about: "Integrated energy. Snapshot profile." },
  { symbol: "JNJ", name: "Johnson & Johnson", assetClass: "equity", currency: "USD", sector: "Health", close: 162.4, marketCap: 390_000_000_000, dividendYield: 0.031, volume: 7_000_000, about: "Health products. Snapshot profile." },
  { symbol: "V", name: "Visa", assetClass: "equity", currency: "USD", sector: "Financials", close: 312.7, marketCap: 610_000_000_000, dividendYield: 0.007, volume: 6_000_000, about: "Payments network. Snapshot profile." },
  { symbol: "UNH", name: "UnitedHealth", assetClass: "equity", currency: "USD", sector: "Health", close: 542.3, marketCap: 500_000_000_000, dividendYield: 0.015, volume: 4_000_000, about: "Health coverage. Snapshot profile." },
  { symbol: "SPY", name: "SPDR S&P 500", assetClass: "etf", currency: "USD", sector: "Index", close: 578.4, marketCap: 560_000_000_000, dividendYield: 0.012, volume: 48_000_000, about: "S&P 500 proxy used as a benchmark." },
  { symbol: "QQQ", name: "Invesco QQQ", assetClass: "etf", currency: "USD", sector: "Index", close: 504.2, marketCap: 320_000_000_000, dividendYield: 0.006, volume: 32_000_000, about: "Nasdaq-100 proxy." },
  { symbol: "IWM", name: "iShares Russell 2000", assetClass: "etf", currency: "USD", sector: "Index", close: 221.5, marketCap: 70_000_000_000, dividendYield: 0.011, volume: 25_000_000, about: "US small-cap proxy." },
  { symbol: "VTI", name: "Vanguard Total Stock Market", assetClass: "etf", currency: "USD", sector: "Index", close: 292.8, marketCap: 480_000_000_000, dividendYield: 0.013, volume: 4_000_000, about: "Broad US equity ETF." },
  { symbol: "SCHD", name: "Schwab US Dividend Equity", assetClass: "etf", currency: "USD", sector: "Income", close: 27.6, marketCap: 68_000_000_000, dividendYield: 0.035, volume: 5_000_000, about: "Dividend-growth ETF used in the house basket." },
  { symbol: "TLT", name: "iShares 20+ Year Treasury", assetClass: "etf", currency: "USD", sector: "Bonds", close: 91.4, marketCap: 55_000_000_000, dividendYield: 0.039, volume: 38_000_000, about: "Long Treasury ETF. Not a Treasury itself." },
  { symbol: "BND", name: "Vanguard Total Bond Market", assetClass: "etf", currency: "USD", sector: "Bonds", close: 74.2, marketCap: 120_000_000_000, dividendYield: 0.037, volume: 6_000_000, about: "Aggregate bond proxy for benchmarks." },
  { symbol: "HYG", name: "iShares High Yield Corp", assetClass: "etf", currency: "USD", sector: "Bonds", close: 78.4, marketCap: 16_000_000_000, dividendYield: 0.058, volume: 28_000_000, about: "High-yield bond ETF." },
  { symbol: "SHY", name: "iShares 1-3 Year Treasury", assetClass: "etf", currency: "USD", sector: "Bonds", close: 82.1, marketCap: 22_000_000_000, dividendYield: 0.041, volume: 4_000_000, about: "Short Treasury ETF." },
  { symbol: "BIL", name: "SPDR 1-3 Month T-Bill", assetClass: "etf", currency: "USD", sector: "Bonds", close: 91.5, marketCap: 32_000_000_000, dividendYield: 0.048, volume: 5_000_000, about: "Cash-like T-bill ETF proxy." },
  { symbol: "GLD", name: "SPDR Gold Shares", assetClass: "commodity", currency: "USD", sector: "Metals", close: 248.6, marketCap: 78_000_000_000, dividendYield: 0, volume: 8_000_000, about: "ETF proxy for gold when a spot series is not in the free feed.", proxy: "ETF proxy" },
  { symbol: "SLV", name: "iShares Silver Trust", assetClass: "commodity", currency: "USD", sector: "Metals", close: 31.2, marketCap: 16_000_000_000, dividendYield: 0, volume: 18_000_000, about: "ETF proxy for silver.", proxy: "ETF proxy" },
  { symbol: "USO", name: "United States Oil Fund", assetClass: "commodity", currency: "USD", sector: "Energy", close: 76.4, marketCap: 1_200_000_000, dividendYield: 0, volume: 3_000_000, about: "ETF proxy for oil.", proxy: "ETF proxy" },
  { symbol: "DBA", name: "Invesco DB Agriculture", assetClass: "commodity", currency: "USD", sector: "Agriculture", close: 26.4, marketCap: 800_000_000, dividendYield: 0, volume: 400_000, about: "ETF proxy for a grain basket.", proxy: "ETF proxy" },
];

export const CRYPTO: { symbol: string; name: string; id: string; coincap: string; binance: string; seed: number }[] = [
  { symbol: "BTC", name: "Bitcoin", id: "bitcoin", coincap: "bitcoin", binance: "BTCUSDT", seed: 68420 },
  { symbol: "ETH", name: "Ether", id: "ethereum", coincap: "ethereum", binance: "ETHUSDT", seed: 3240 },
  { symbol: "SOL", name: "Solana", id: "solana", coincap: "solana", binance: "SOLUSDT", seed: 168 },
  { symbol: "XRP", name: "XRP", id: "ripple", coincap: "ripple", binance: "XRPUSDT", seed: 0.62 },
  { symbol: "ADA", name: "Cardano", id: "cardano", coincap: "cardano", binance: "ADAUSDT", seed: 0.48 },
  { symbol: "DOGE", name: "Dogecoin", id: "dogecoin", coincap: "dogecoin", binance: "DOGEUSDT", seed: 0.16 },
  { symbol: "AVAX", name: "Avalanche", id: "avalanche-2", coincap: "avalanche", binance: "AVAXUSDT", seed: 28 },
  { symbol: "LINK", name: "Chainlink", id: "chainlink", coincap: "chainlink", binance: "LINKUSDT", seed: 14.2 },
  { symbol: "DOT", name: "Polkadot", id: "polkadot", coincap: "polkadot", binance: "DOTUSDT", seed: 5.4 },
  { symbol: "LTC", name: "Litecoin", id: "litecoin", coincap: "litecoin", binance: "LTCUSDT", seed: 86 },
  { symbol: "UNI", name: "Uniswap", id: "uniswap", coincap: "uniswap", binance: "UNIUSDT", seed: 8.1 },
  { symbol: "BCH", name: "Bitcoin Cash", id: "bitcoin-cash", coincap: "bitcoin-cash", binance: "BCHUSDT", seed: 420 },
];

export const FX_PAIRS = [
  { symbol: "EURUSD", base: "EUR", quote: "USD", mid: 1.086, name: "Euro" },
  { symbol: "GBPUSD", base: "GBP", quote: "USD", mid: 1.312, name: "Sterling" },
  { symbol: "USDJPY", base: "USD", quote: "JPY", mid: 151.4, name: "Yen" },
  { symbol: "USDCHF", base: "USD", quote: "CHF", mid: 0.872, name: "Swiss franc" },
  { symbol: "AUDUSD", base: "AUD", quote: "USD", mid: 0.658, name: "Australian dollar" },
  { symbol: "USDCAD", base: "USD", quote: "CAD", mid: 1.382, name: "Canadian dollar" },
];

export const YIELD_SNAPSHOT = [
  { tenor: "1M", years: 1 / 12, series: "DGS1MO", yield: 0.0431 },
  { tenor: "3M", years: 0.25, series: "DGS3MO", yield: 0.0418 },
  { tenor: "6M", years: 0.5, series: "DGS6MO", yield: 0.0406 },
  { tenor: "1Y", years: 1, series: "DGS1", yield: 0.0388 },
  { tenor: "2Y", years: 2, series: "DGS2", yield: 0.0364 },
  { tenor: "5Y", years: 5, series: "DGS5", yield: 0.0372 },
  { tenor: "10Y", years: 10, series: "DGS10", yield: 0.0411 },
  { tenor: "30Y", years: 30, series: "DGS30", yield: 0.0452 },
];

export const BASKETS = [
  { id: "dividend", name: "Dividend growers", weights: [{ symbol: "SCHD", weight: 0.5 }, { symbol: "VTI", weight: 0.3 }, { symbol: "JNJ", weight: 0.2 }] },
  { id: "tbill", name: "Cash-like T-bill ladder", weights: [{ symbol: "BIL", weight: 0.6 }, { symbol: "SHY", weight: 0.4 }] },
  { id: "energy", name: "Energy", weights: [{ symbol: "XOM", weight: 0.7 }, { symbol: "USO", weight: 0.3 }] },
];

export function findInstrument(symbol: string): Instrument | undefined {
  return INSTRUMENTS.find((item) => item.symbol.toUpperCase() === symbol.toUpperCase());
}

export function findCrypto(symbol: string) {
  return CRYPTO.find((item) => item.symbol.toUpperCase() === symbol.toUpperCase());
}
