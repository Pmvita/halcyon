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
  type ChartMarker,
  type ChartSeries,
  type LiveQuote,
  type Bar,
  type NewsItem,
  type QuoteStatus,
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
  { id: "yahoo", perMinute: 20, perDay: 1500, concurrency: 2 },
  { id: "mempool", perMinute: 12, perDay: 1500, concurrency: 2 },
  { id: "explorer", perMinute: 8, perDay: 600, concurrency: 1 },
];

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

type HistoryBundle = {
  bars: Bar[];
  markers: ChartMarker[];
  source: string;
  status: QuoteStatus;
  asOf: string;
  detail?: string;
  interval: string;
};

type NewsBundle = {
  items: NewsItem[];
  source: string;
  status: QuoteStatus;
  asOf: string;
  detail?: string;
};

export class QuoteHub {
  readonly budgets = new Map<string, RateBudget>();
  readonly breakers = new Map<string, CircuitBreaker>();
  readonly cache = new TtlCache<LiveQuote>();
  readonly barCache = new TtlCache<HistoryBundle>();
  readonly newsCache = new TtlCache<NewsBundle>();
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

  /** Synchronous synthetic path — kept for callers that cannot await. Prefer `history`. */
  bars(symbol: string, range: string): Bar[] {
    return this.syntheticHistory(symbol, range).bars;
  }

  async history(symbol: string, range = "3M", extraMarkers: ChartMarker[] = []): Promise<ChartSeries> {
    const upper = symbol.toUpperCase();
    const normalized = normalizeRange(range);
    const cacheKey = `history|${upper}|${normalized}`;
    const finnhubKey = this.env("FINNHUB_API_KEY");

    if (finnhubKey && !findCrypto(upper) && !FX_PAIRS.some((pair) => pair.symbol === upper)) {
      const loaded = await this.loadHistory(cacheKey, "finnhub", async () => {
        const bars = await this.pullFinnhubCandles(upper, normalized, finnhubKey);
        return this.bundleHistory(bars, "Finnhub candles", "Delayed", `Daily OHLC via Finnhub. Range ${normalized}.`, normalized);
      });
      if (loaded) return withExtraMarkers(loaded, extraMarkers);
    }

    const yahoo = await this.loadHistory(cacheKey, "yahoo", async () => {
      const yahooSymbol = toYahooSymbol(upper);
      const bars = await this.pullYahooChart(yahooSymbol, normalized);
      return this.bundleHistory(bars, "Yahoo Finance chart", "Delayed", `Public chart endpoint · ${yahooSymbol}. Not a broker feed.`, normalized);
    });
    if (yahoo) return withExtraMarkers(yahoo, extraMarkers);

    const synthetic = this.syntheticHistory(upper, normalized);
    return withExtraMarkers(
      {
        bars: synthetic.bars,
        markers: synthetic.markers,
        range: normalized,
        interval: synthetic.interval,
        source: synthetic.source,
        status: "Stale",
        asOf: synthetic.asOf,
        detail: synthetic.detail ?? "Synthetic walk around the shipped close. Add FINNHUB_API_KEY for vendor candles, or allow Yahoo from this host.",
      },
      extraMarkers,
    );
  }

  async news(symbol: string): Promise<{ items: NewsItem[]; source: string; status: QuoteStatus; asOf: string; detail?: string }> {
    const upper = symbol.toUpperCase();
    const cacheKey = `news|${upper}`;
    const finnhubKey = this.env("FINNHUB_API_KEY");
    const asOf = this.now.toISOString();

    if (finnhubKey && !findCrypto(upper) && !FX_PAIRS.some((pair) => pair.symbol === upper)) {
      const breaker = this.breakers.get("finnhub")!;
      if (breaker.canRequest()) {
        try {
          const loaded = await loadThroughBudget({
            key: cacheKey,
            budget: this.budgets.get("finnhub")!,
            cache: this.newsCache,
            coalescer: this.coalescer,
            freshMs: 15 * 60_000,
            staleMs: 6 * 60 * 60_000,
            loader: async () => {
              this.upstreamCalls.set("finnhub", (this.upstreamCalls.get("finnhub") ?? 0) + 1);
              const items = await this.pullFinnhubNews(upper, finnhubKey);
              return {
                items,
                source: "Finnhub company-news",
                status: "Delayed" as const,
                asOf: new Date().toISOString(),
                detail: items.length ? undefined : "Finnhub returned no headlines for this window.",
              };
            },
          });
          if (loaded.value?.items.length) {
            breaker.success();
            return { ...loaded.value, status: loaded.status, detail: loaded.detail ?? loaded.value.detail };
          }
          if (loaded.value) {
            breaker.success();
            return { ...loaded.value, status: loaded.status === "Live" ? "Delayed" : loaded.status, detail: loaded.detail ?? loaded.value.detail };
          }
        } catch (error) {
          breaker.failure();
          this.errors.set("finnhub", error instanceof Error ? error.message : "news failed");
        }
      }
    }

    const cached = this.newsCache.peek(cacheKey);
    if (cached && cached.ageMs < 6 * 60 * 60_000) {
      return { ...cached.value, status: "Cached", detail: cached.value.detail ?? "Cached headlines." };
    }

    const seed = seedNews(upper);
    return {
      items: seed,
      source: "Halcyon seed headlines",
      status: "Unavailable",
      asOf,
      detail: finnhubKey
        ? "Live company-news unavailable or empty. Showing labeled seed headlines."
        : "No FINNHUB_API_KEY on the server. Seed headlines only — not a live wire.",
    };
  }

  private async loadHistory(cacheKey: string, provider: "finnhub" | "yahoo", loader: () => Promise<HistoryBundle>): Promise<ChartSeries | null> {
    const breaker = this.breakers.get(provider)!;
    if (!breaker.canRequest()) return null;
    try {
      const loaded = await loadThroughBudget({
        key: `${provider}|${cacheKey}`,
        budget: this.budgets.get(provider)!,
        cache: this.barCache,
        coalescer: this.coalescer,
        freshMs: 10 * 60_000,
        staleMs: 24 * 60 * 60_000,
        loader: async () => {
          this.upstreamCalls.set(provider, (this.upstreamCalls.get(provider) ?? 0) + 1);
          return loader();
        },
      });
      if (!loaded.value?.bars.length) return null;
      breaker.success();
      return {
        bars: loaded.value.bars,
        markers: loaded.value.markers,
        range: normalizeRangeFromKey(cacheKey),
        interval: loaded.value.interval,
        source: loaded.value.source,
        status: loaded.status === "Live" ? "Delayed" : loaded.status,
        asOf: loaded.value.asOf,
        detail: loaded.detail ?? loaded.value.detail,
      };
    } catch (error) {
      breaker.failure();
      this.errors.set(provider, error instanceof Error ? error.message : "history failed");
      return null;
    }
  }

  private bundleHistory(bars: Bar[], source: string, status: QuoteStatus, detail: string, range: string): HistoryBundle {
    if (!bars.length) throw new Error("empty bars");
    const markers = sessionMarkers(bars, range);
    return {
      bars,
      markers,
      source,
      status,
      asOf: this.now.toISOString(),
      detail,
      interval: range === "1D" ? "5m" : "1d",
    };
  }

  private async pullFinnhubCandles(symbol: string, range: string, token: string): Promise<Bar[]> {
    const { from, to, resolution } = finnhubWindow(range, this.now);
    const url = `https://finnhub.io/api/v1/stock/candle?symbol=${encodeURIComponent(symbol)}&resolution=${resolution}&from=${from}&to=${to}&token=${encodeURIComponent(token)}`;
    const response = await this.fetchImpl(url, { signal: AbortSignal.timeout(6000) });
    if (!response.ok) throw new Error(`Finnhub candles ${response.status}`);
    const body = (await response.json()) as {
      s?: string;
      t?: number[];
      o?: number[];
      h?: number[];
      l?: number[];
      c?: number[];
      v?: number[];
    };
    if (body.s !== "ok" || !body.t?.length) throw new Error("Finnhub candles empty");
    const bars: Bar[] = [];
    for (let i = 0; i < body.t.length; i += 1) {
      bars.push({
        t: new Date(body.t[i]! * 1000).toISOString(),
        o: body.o?.[i] ?? 0,
        h: body.h?.[i] ?? 0,
        l: body.l?.[i] ?? 0,
        c: body.c?.[i] ?? 0,
        v: body.v?.[i] ?? 0,
      });
    }
    return bars;
  }

  private async pullYahooChart(yahooSymbol: string, range: string): Promise<Bar[]> {
    const { range: yahooRange, interval } = yahooWindow(range);
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?range=${yahooRange}&interval=${interval}&includePrePost=false`;
    const response = await this.fetchImpl(url, {
      signal: AbortSignal.timeout(6000),
      headers: {
        "user-agent": "HalcyonDemo/1.0 (+https://halcyon-financial.vercel.app)",
        accept: "application/json",
      },
    });
    if (!response.ok) throw new Error(`Yahoo chart ${response.status}`);
    const body = (await response.json()) as {
      chart?: {
        result?: Array<{
          timestamp?: number[];
          indicators?: { quote?: Array<{ open?: Array<number | null>; high?: Array<number | null>; low?: Array<number | null>; close?: Array<number | null>; volume?: Array<number | null> }> };
        }>;
      };
    };
    const result = body.chart?.result?.[0];
    const quote = result?.indicators?.quote?.[0];
    const stamps = result?.timestamp ?? [];
    if (!stamps.length || !quote) throw new Error("Yahoo chart empty");
    const bars: Bar[] = [];
    for (let i = 0; i < stamps.length; i += 1) {
      const o = quote.open?.[i];
      const h = quote.high?.[i];
      const l = quote.low?.[i];
      const c = quote.close?.[i];
      if (o == null || h == null || l == null || c == null) continue;
      bars.push({
        t: new Date(stamps[i]! * 1000).toISOString(),
        o,
        h,
        l,
        c,
        v: quote.volume?.[i] ?? 0,
      });
    }
    if (!bars.length) throw new Error("Yahoo chart no usable bars");
    return bars;
  }

  private async pullFinnhubNews(symbol: string, token: string): Promise<NewsItem[]> {
    const to = this.now.toISOString().slice(0, 10);
    const fromDate = new Date(this.now.getTime() - 14 * 86_400_000).toISOString().slice(0, 10);
    const url = `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(symbol)}&from=${fromDate}&to=${to}&token=${encodeURIComponent(token)}`;
    const response = await this.fetchImpl(url, { signal: AbortSignal.timeout(6000) });
    if (!response.ok) throw new Error(`Finnhub news ${response.status}`);
    const body = (await response.json()) as Array<{ headline?: string; source?: string; datetime?: number; url?: string; summary?: string }>;
    if (!Array.isArray(body)) throw new Error("Finnhub news malformed");
    return body.slice(0, 12).map((item) => ({
      title: item.headline?.trim() || "Untitled headline",
      source: item.source?.trim() || "Finnhub",
      time: item.datetime ? new Date(item.datetime * 1000).toISOString() : this.now.toISOString(),
      href: item.url || "https://www.sec.gov/edgar/search/",
      detail: item.summary?.slice(0, 180),
      status: "Delayed" as const,
    }));
  }

  private syntheticHistory(symbol: string, range: string): HistoryBundle {
    const inst = findInstrument(symbol) ?? null;
    const crypto = findCrypto(symbol);
    const fx = FX_PAIRS.find((pair) => pair.symbol === symbol);
    const close = inst?.close ?? crypto?.seed ?? fx?.mid ?? 100;
    const points = range === "1D" ? 78 : range === "5D" ? 5 * 24 : range === "1M" ? 30 : range === "1Y" ? 252 : range === "5Y" ? 260 : 90;
    const stepMs = range === "1D" ? 5 * 60_000 : range === "5D" ? 60 * 60_000 : 86_400_000;
    const bars: Bar[] = [];
    let price = close * 0.94;
    for (let i = 0; i < points; i += 1) {
      const drift = Math.sin(i / 7) * 0.004 + (close - price) * 0.02;
      const open = price;
      const closeBar = Math.max(0.0001, price * (1 + drift));
      const high = Math.max(open, closeBar) * 1.002;
      const low = Math.min(open, closeBar) * 0.998;
      bars.push({
        t: new Date(this.now.getTime() - (points - i) * stepMs).toISOString(),
        o: open,
        h: high,
        l: low,
        c: closeBar,
        v: 1000 + (i % 9) * 400,
      });
      price = closeBar;
    }
    if (bars.length) bars[bars.length - 1]!.c = close;
    const markers = sessionMarkers(bars, range);
    return {
      bars,
      markers,
      source: "Halcyon synthetic path",
      status: "Stale",
      asOf: this.now.toISOString(),
      detail: "Synthetic walk around the shipped close. Not exchange prints.",
      interval: range === "1D" ? "5m" : "1d",
    };
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

function normalizeRange(range: string): string {
  const upper = range.toUpperCase();
  if (["1D", "5D", "1M", "3M", "1Y", "5Y"].includes(upper)) return upper;
  return "3M";
}

function normalizeRangeFromKey(cacheKey: string): string {
  const parts = cacheKey.split("|");
  return parts[parts.length - 1] ?? "3M";
}

function yahooWindow(range: string): { range: string; interval: string } {
  switch (range) {
    case "1D":
      return { range: "1d", interval: "5m" };
    case "5D":
      return { range: "5d", interval: "30m" };
    case "1M":
      return { range: "1mo", interval: "1d" };
    case "1Y":
      return { range: "1y", interval: "1d" };
    case "5Y":
      return { range: "5y", interval: "1wk" };
    default:
      return { range: "3mo", interval: "1d" };
  }
}

function finnhubWindow(range: string, now: Date): { from: number; to: number; resolution: string } {
  const to = Math.floor(now.getTime() / 1000);
  const day = 86_400;
  switch (range) {
    case "1D":
      return { from: to - day, to, resolution: "5" };
    case "5D":
      return { from: to - 5 * day, to, resolution: "60" };
    case "1M":
      return { from: to - 30 * day, to, resolution: "D" };
    case "1Y":
      return { from: to - 365 * day, to, resolution: "D" };
    case "5Y":
      return { from: to - 5 * 365 * day, to, resolution: "W" };
    default:
      return { from: to - 90 * day, to, resolution: "D" };
  }
}

function toYahooSymbol(symbol: string): string {
  const crypto = findCrypto(symbol);
  if (crypto) return `${crypto.symbol}-USD`;
  const fx = FX_PAIRS.find((pair) => pair.symbol === symbol);
  if (fx) return `${fx.symbol}=X`;
  return symbol;
}

function sessionMarkers(bars: Bar[], range: string): ChartMarker[] {
  if (!bars.length) return [];
  const markers: ChartMarker[] = [];
  if (range === "1D") {
    markers.push({
      time: bars[0]!.t,
      position: "belowBar",
      shape: "circle",
      text: "Open",
      color: "#b08948",
    });
    markers.push({
      time: bars[bars.length - 1]!.t,
      position: "aboveBar",
      shape: "circle",
      text: "Last",
      color: "#b08948",
    });
    return markers;
  }
  const first = bars[0]!;
  const last = bars[bars.length - 1]!;
  markers.push({
    time: first.t,
    position: "belowBar",
    shape: "square",
    text: "Range start",
    color: "#b08948",
  });
  markers.push({
    time: last.t,
    position: "aboveBar",
    shape: "square",
    text: "Range end",
    color: "#b08948",
  });
  if (bars.length > 4) {
    const mid = bars[Math.floor(bars.length / 2)]!;
    markers.push({
      time: mid.t,
      position: "inBar",
      shape: "circle",
      text: "Mid",
      color: "#8c6a2f",
    });
  }
  return markers;
}

function withExtraMarkers(series: ChartSeries, extra: ChartMarker[]): ChartSeries {
  if (!extra.length) return series;
  return { ...series, markers: [...series.markers, ...extra] };
}

function seedNews(symbol: string): NewsItem[] {
  const filings = `https://www.sec.gov/edgar/search/#/q=${encodeURIComponent(symbol)}`;
  return [
    {
      title: `${symbol} desk brief · demo seed`,
      source: "Halcyon seed",
      time: new Date().toISOString(),
      href: filings,
      detail: "Labeled seed headline. Not a live wire. Open the link for a public SEC EDGAR search.",
      status: "Seed",
    },
    {
      title: `Public filings search for ${symbol}`,
      source: "SEC EDGAR",
      time: new Date(Date.now() - 86_400_000).toISOString(),
      href: filings,
      detail: "External public search — Halcyon does not host filings.",
      status: "Unavailable",
    },
  ];
}

export { INSTRUMENTS };
