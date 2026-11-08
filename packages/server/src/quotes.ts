import {
  CircuitBreaker,
  Coalescer,
  RateBudget,
  TtlCache,
  equitySession,
  equitySpreadBps,
  loadThroughBudget,
  replayPrice,
  synthesizeBook,
  type BudgetConfig,
  type LiveQuote,
  type Bar,
} from "@halcyon/domain";
import { CRYPTO, FX_PAIRS, INSTRUMENTS, SNAPSHOT_DATE, SNAPSHOT_SOURCE, YIELD_SNAPSHOT, findCrypto, findInstrument } from "./universe";

export const PROVIDER_BUDGETS: BudgetConfig[] = [
  { id: "coingecko", perMinute: 8, perDay: 400, concurrency: 2 },
  { id: "coincap", perMinute: 20, perDay: 2000, concurrency: 2 },
  { id: "binance", perMinute: 30, perDay: 8000, concurrency: 2 },
  { id: "frankfurter", perMinute: 20, perDay: 1500, concurrency: 2 },
  { id: "fred", perMinute: 6, perDay: 120, concurrency: 1 },
  { id: "finnhub", perMinute: 50, perDay: 4000, concurrency: 2 },
  { id: "alphavantage", perMinute: 5, perDay: 25, concurrency: 1 },
  { id: "mempool", perMinute: 12, perDay: 1500, concurrency: 2 },
  { id: "explorer", perMinute: 8, perDay: 600, concurrency: 1 },
];

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export class QuoteHub {
  readonly budgets = new Map<string, RateBudget>();
  readonly breakers = new Map<string, CircuitBreaker>();
  readonly cache = new TtlCache<LiveQuote>();
  readonly barCache = new TtlCache<Bar[]>();
  readonly coalescer = new Coalescer();
  readonly errors = new Map<string, string>();
  readonly upstreamCalls = new Map<string, number>();
  yields: Array<(typeof YIELD_SNAPSHOT)[number] & { source: string; status: "Delayed" | "Stale" }> =
    YIELD_SNAPSHOT.map((row) => ({ ...row, source: "Shipped yield snapshot", status: "Delayed" as const }));
  yieldFetchedAt: string | null = null;

  constructor(
    private readonly opts: { fetch?: FetchLike; now?: () => Date; env?: NodeJS.ProcessEnv } = {},
  ) {
    for (const config of PROVIDER_BUDGETS) {
      this.budgets.set(config.id, new RateBudget(config, () => (this.opts.now ?? (() => new Date()))().getTime()));
      this.breakers.set(config.id, new CircuitBreaker(3, 30_000, () => (this.opts.now ?? (() => new Date()))().getTime()));
    }
  }

  private get now(): Date {
    return (this.opts.now ?? (() => new Date()))();
  }

  private get fetchImpl(): FetchLike {
    return this.opts.fetch ?? fetch;
  }

  private env(name: string): string {
    return this.opts.env?.[name] ?? process.env[name] ?? "";
  }

  async quote(symbol: string, priority: "page" | "alert" | "screener" | "warm" = "page", replay = true): Promise<LiveQuote> {
    const upper = symbol.toUpperCase();
    if (findCrypto(upper)) return this.cryptoQuote(upper, priority);
    if (FX_PAIRS.some((pair) => pair.symbol === upper)) return this.fxQuote(upper);
    return this.equityQuote(upper, replay);
  }

  async quotes(symbols: string[], priority: "page" | "alert" | "screener" | "warm" = "screener"): Promise<LiveQuote[]> {
    const out: LiveQuote[] = [];
    for (const symbol of symbols) out.push(await this.quote(symbol, priority));
    return out;
  }

  equityQuote(symbol: string, replay = true): LiveQuote {
    const inst = findInstrument(symbol);
    const close = inst?.close ?? 100;
    const session = equitySession(this.now, replay);
    const last = session.mode === "open" ? close : replayPrice(close, this.now);
    const spread = equitySpreadBps(last);
    const book = synthesizeBook(last, spread);
    const liveKey = this.env("FINNHUB_API_KEY");
    const status = session.mode === "replay" ? "Delayed" : liveKey && session.mode === "open" ? "Cached" : "Delayed";
    return {
      symbol,
      ...book,
      prev: close,
      changePct: close ? (last - close) / close : 0,
      asOf: this.now.toISOString(),
      source: inst ? SNAPSHOT_SOURCE : "Halcyon model",
      status,
      currency: "USD",
      session: session.label,
      detail:
        session.mode === "replay"
          ? "Session replay · synthetic path around the shipped close. Not a live print."
          : inst
            ? "Shipped end-of-day snapshot. A live US quote needs FINNHUB_API_KEY on the server."
            : "Unknown symbol. Showing a placeholder mark labeled as a model.",
    };
  }

  async cryptoQuote(symbol: string, priority: "page" | "alert" | "screener" | "warm"): Promise<LiveQuote> {
    const meta = findCrypto(symbol);
    if (!meta) return this.unavailable(symbol, "That coin is outside the curated universe.");
    const freshMs = priority === "page" ? 15_000 : 60_000;
    const providers = ["coingecko", "coincap", "binance"] as const;
    for (const provider of providers) {
      const breaker = this.breakers.get(provider)!;
      if (!breaker.canRequest()) continue;
      try {
        const loaded = await loadThroughBudget({
          key: `${provider}|${symbol}|spot|last`,
          budget: this.budgets.get(provider)!,
          cache: this.cache,
          coalescer: this.coalescer,
          freshMs,
          staleMs: 10 * 60_000,
          loader: async () => {
            this.upstreamCalls.set(provider, (this.upstreamCalls.get(provider) ?? 0) + 1);
            const last = await this.pullCrypto(provider, meta);
            const book = synthesizeBook(last, 4);
            const quote: LiveQuote = {
              symbol,
              ...book,
              prev: meta.seed,
              changePct: (last - meta.seed) / meta.seed,
              asOf: new Date().toISOString(),
              source: provider,
              status: "Live",
              currency: "USD",
              session: "24/7",
            };
            return quote;
          },
        });
        if (loaded.value) {
          breaker.success();
          return { ...loaded.value, status: loaded.status, detail: loaded.detail ?? loaded.value.detail };
        }
      } catch (error) {
        this.errors.set(provider, error instanceof Error ? error.message : "quote failed");
      }
    }
    const book = synthesizeBook(meta.seed, 8);
    return {
      symbol,
      ...book,
      prev: meta.seed,
      changePct: 0,
      asOf: `${SNAPSHOT_DATE}T21:00:00.000Z`,
      source: "Halcyon crypto seed",
      status: "Stale",
      currency: "USD",
      session: "24/7",
      detail: "Live crypto feeds were unavailable or over budget. Showing the shipped seed.",
    };
  }

  private async pullCrypto(provider: "coingecko" | "coincap" | "binance", meta: (typeof CRYPTO)[number]): Promise<number> {
    const ctrl = AbortSignal.timeout(4000);
    try {
      if (provider === "coingecko") {
        const key = this.env("COINGECKO_API_KEY");
        const headers: Record<string, string> = key ? { "x-cg-demo-api-key": key } : {};
        const response = await this.fetchImpl(
          `https://api.coingecko.com/api/v3/simple/price?ids=${meta.id}&vs_currencies=usd`,
          { headers, signal: ctrl },
        );
        if (!response.ok) throw new Error(`CoinGecko ${response.status}`);
        const body = (await response.json()) as Record<string, { usd?: number }>;
        const usd = body[meta.id]?.usd;
        if (!usd) throw new Error("CoinGecko empty");
        return usd;
      }
      if (provider === "coincap") {
        const response = await this.fetchImpl(`https://api.coincap.io/v2/assets/${meta.coincap}`, { signal: ctrl });
        if (!response.ok) throw new Error(`CoinCap ${response.status}`);
        const body = (await response.json()) as { data?: { priceUsd?: string } };
        const usd = Number(body.data?.priceUsd);
        if (!usd) throw new Error("CoinCap empty");
        return usd;
      }
      const response = await this.fetchImpl(`https://api.binance.com/api/v3/ticker/price?symbol=${meta.binance}`, { signal: ctrl });
      if (!response.ok) throw new Error(`Binance ${response.status}`);
      const body = (await response.json()) as { price?: string };
      const usd = Number(body.price);
      if (!usd) throw new Error("Binance empty");
      return usd;
    } catch (error) {
      this.breakers.get(provider)?.failure();
      this.errors.set(provider, error instanceof Error ? error.message : "fetch failed");
      throw error;
    }
  }

  async fxQuote(symbol: string): Promise<LiveQuote> {
    const pair = FX_PAIRS.find((item) => item.symbol === symbol)!;
    const loaded = await loadThroughBudget({
      key: `frankfurter|${symbol}|1d|latest`,
      budget: this.budgets.get("frankfurter")!,
      cache: this.cache,
      coalescer: this.coalescer,
      freshMs: 6 * 60 * 60_000,
      staleMs: 7 * 24 * 60 * 60_000,
      loader: async () => {
        this.upstreamCalls.set("frankfurter", (this.upstreamCalls.get("frankfurter") ?? 0) + 1);
        let mid = pair.mid;
        let source = "Shipped FX snapshot";
        let asOf = `${SNAPSHOT_DATE}T00:00:00.000Z`;
        try {
          const response = await this.fetchImpl("https://api.frankfurter.app/latest?from=USD", { signal: AbortSignal.timeout(4000) });
          if (response.ok) {
            const body = (await response.json()) as { rates?: Record<string, number>; date?: string };
            mid = fxMidFromUsd(pair, body.rates ?? {});
            source = "Frankfurter · ECB reference";
            asOf = `${body.date ?? SNAPSHOT_DATE}T16:00:00.000Z`;
          }
        } catch (error) {
          this.errors.set("frankfurter", error instanceof Error ? error.message : "fx failed");
        }
        const pip = pair.symbol.includes("JPY") ? 0.01 : 0.0001;
        return {
          symbol,
          bid: mid - pip,
          ask: mid + pip,
          last: mid,
          prev: pair.mid,
          changePct: (mid - pair.mid) / pair.mid,
          asOf,
          source,
          status: "Delayed" as const,
          currency: pair.quote,
          session: "Reference rate",
          detail: "Indicative spread of 1 pip around the mid. Reference rates are not a dealing price.",
        };
      },
    });
    return loaded.value ?? this.unavailable(symbol, "FX reference rate unavailable");
  }

  async refreshYields(): Promise<void> {
    const budget = this.budgets.get("fred")!;
    if (!budget.tryEnter()) return;
    try {
      const next: typeof this.yields = [];
      for (const row of YIELD_SNAPSHOT) {
        try {
          const response = await this.fetchImpl(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${row.series}`, {
            signal: AbortSignal.timeout(5000),
          });
          if (!response.ok) throw new Error(String(response.status));
          const text = await response.text();
          const lines = text.trim().split(/\r?\n/).slice(1).reverse();
          const latest = lines.find((line) => !line.endsWith(".") && !line.endsWith(","));
          const value = Number(latest?.split(",")[1]);
          next.push({ ...row, yield: Number.isFinite(value) ? value / 100 : row.yield, source: "FRED", status: "Delayed" as const });
        } catch {
          next.push({ ...row, source: "Shipped yield snapshot", status: "Stale" as const });
        }
      }
      this.yields = next;
      this.yieldFetchedAt = new Date().toISOString();
    } finally {
      budget.leave();
    }
  }

  bars(symbol: string, range: string): Bar[] {
    const inst = findInstrument(symbol) ?? null;
    const crypto = findCrypto(symbol);
    const close = inst?.close ?? crypto?.seed ?? 100;
    const points = range === "1D" ? 78 : range === "5D" ? 5 * 24 : range === "1M" ? 30 : range === "1Y" ? 252 : 120;
    const bars: Bar[] = [];
    let price = close * 0.94;
    for (let i = 0; i < points; i += 1) {
      const drift = Math.sin(i / 7) * 0.004 + (close - price) * 0.02;
      const open = price;
      const closeBar = Math.max(0.0001, price * (1 + drift));
      const high = Math.max(open, closeBar) * 1.002;
      const low = Math.min(open, closeBar) * 0.998;
      bars.push({
        t: new Date(this.now.getTime() - (points - i) * 3_600_000).toISOString(),
        o: open,
        h: high,
        l: low,
        c: closeBar,
        v: 1000 + (i % 9) * 400,
      });
      price = closeBar;
    }
    if (bars.length) bars[bars.length - 1]!.c = close;
    return bars;
  }

  health() {
    return PROVIDER_BUDGETS.map((config) => {
      const budget = this.budgets.get(config.id)!.snapshot();
      const hits = this.cache.hits;
      const misses = this.cache.misses;
      return {
        ...budget,
        lastError: this.errors.get(config.id) ?? "",
        upstreamCalls: this.upstreamCalls.get(config.id) ?? 0,
        cacheHits: hits,
        cacheMisses: misses,
        breakerOpen: this.breakers.get(config.id)?.open ?? false,
      };
    });
  }

  private unavailable(symbol: string, detail: string): LiveQuote {
    return {
      symbol,
      bid: 0,
      ask: 0,
      last: 0,
      prev: 0,
      changePct: 0,
      asOf: this.now.toISOString(),
      source: "Halcyon",
      status: "Unavailable",
      currency: "USD",
      session: "—",
      detail,
    };
  }
}

function fxMidFromUsd(pair: (typeof FX_PAIRS)[number], rates: Record<string, number>): number {
  if (pair.base === "USD") return rates[pair.quote] ?? pair.mid;
  const perUsd = rates[pair.base];
  if (!perUsd) return pair.mid;
  return 1 / perUsd;
}

export { INSTRUMENTS };
