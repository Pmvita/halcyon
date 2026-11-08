export type BudgetConfig = {
  id: string;
  perMinute: number;
  perDay: number;
  concurrency: number;
};

export type QuoteStatus = "Live" | "Cached" | "Delayed" | "Stale" | "Unavailable";

export class RateBudget {
  private minute: number[] = [];
  private day: number[] = [];
  private inFlight = 0;

  constructor(
    readonly config: BudgetConfig,
    private now: () => number = () => Date.now(),
  ) {}

  tryEnter(): boolean {
    const t = this.now();
    this.minute = this.minute.filter((stamp) => t - stamp < 60_000);
    this.day = this.day.filter((stamp) => t - stamp < 86_400_000);
    if (this.minute.length >= this.config.perMinute) return false;
    if (this.day.length >= this.config.perDay) return false;
    if (this.inFlight >= this.config.concurrency) return false;
    this.minute.push(t);
    this.day.push(t);
    this.inFlight += 1;
    return true;
  }

  leave(): void {
    this.inFlight = Math.max(0, this.inFlight - 1);
  }

  retryAfterMs(): number {
    const t = this.now();
    const oldest = this.minute[0];
    if (oldest === undefined) return 1_000;
    return Math.max(250, 60_000 - (t - oldest));
  }

  snapshot() {
    const t = this.now();
    const usedMinute = this.minute.filter((stamp) => t - stamp < 60_000).length;
    const usedDay = this.day.filter((stamp) => t - stamp < 86_400_000).length;
    return {
      id: this.config.id,
      usedMinute,
      usedDay,
      perMinute: this.config.perMinute,
      perDay: this.config.perDay,
      inFlight: this.inFlight,
      concurrency: this.config.concurrency,
    };
  }
}

export class TtlCache<T> {
  private readonly map = new Map<string, { value: T; at: number }>();
  hits = 0;
  misses = 0;

  constructor(private now: () => number = () => Date.now()) {}

  get(key: string): { value: T; ageMs: number } | null {
    const hit = this.map.get(key);
    if (!hit) {
      this.misses += 1;
      return null;
    }
    this.hits += 1;
    return { value: hit.value, ageMs: this.now() - hit.at };
  }

  peek(key: string): { value: T; ageMs: number } | null {
    const hit = this.map.get(key);
    if (!hit) return null;
    return { value: hit.value, ageMs: this.now() - hit.at };
  }

  set(key: string, value: T): void {
    this.map.set(key, { value, at: this.now() });
  }

  get size(): number {
    return this.map.size;
  }
}

export class Coalescer {
  private readonly inflight = new Map<string, Promise<unknown>>();

  run<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const existing = this.inflight.get(key) as Promise<T> | undefined;
    if (existing) return existing;
    const pending = fn().finally(() => this.inflight.delete(key));
    this.inflight.set(key, pending);
    return pending;
  }
}

export class CircuitBreaker {
  private failures = 0;
  private openUntil = 0;

  constructor(
    private readonly threshold = 3,
    private readonly cooldownMs = 30_000,
    private readonly now: () => number = () => Date.now(),
  ) {}

  canRequest(): boolean {
    return this.now() >= this.openUntil;
  }

  success(): void {
    this.failures = 0;
  }

  failure(): void {
    this.failures += 1;
    if (this.failures >= this.threshold) this.openUntil = this.now() + this.cooldownMs;
  }

  get open(): boolean {
    return !this.canRequest();
  }
}

export async function retryIdempotent<T>(
  fn: () => Promise<T>,
  opts: { retries?: number; isRetryable?: (error: unknown) => boolean; retryAfterMs?: (error: unknown) => number | null } = {},
): Promise<T> {
  const retries = opts.retries ?? 2;
  let last: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      last = error;
      const retryable = opts.isRetryable ? opts.isRetryable(error) : true;
      if (!retryable || attempt === retries) break;
      const wait = opts.retryAfterMs?.(error) ?? 40 * 2 ** attempt;
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
  }
  throw last;
}

export type CachedLoad<T> = {
  value: T | null;
  status: QuoteStatus;
  ageMs: number | null;
  detail?: string;
};

export async function loadThroughBudget<T>(opts: {
  key: string;
  budget: RateBudget;
  cache: TtlCache<T>;
  coalescer: Coalescer;
  freshMs: number;
  staleMs: number;
  loader: () => Promise<T>;
  classify?: (value: T, ageMs: number) => QuoteStatus;
}): Promise<CachedLoad<T>> {
  return opts.coalescer.run(opts.key, async () => {
    const cached = opts.cache.peek(opts.key);
    if (cached && cached.ageMs <= opts.freshMs) {
      return {
        value: cached.value,
        status: opts.classify?.(cached.value, cached.ageMs) ?? "Live",
        ageMs: cached.ageMs,
      };
    }
    const allowed = opts.budget.tryEnter();
    if (!allowed) {
      if (cached && cached.ageMs <= opts.staleMs) {
        const seconds = Math.max(1, Math.ceil(opts.budget.retryAfterMs() / 1000));
        return {
          value: cached.value,
          status: "Cached",
          ageMs: cached.ageMs,
          detail: `Cached · refreshes in ${seconds}s`,
        };
      }
      if (cached) {
        return { value: cached.value, status: "Stale", ageMs: cached.ageMs, detail: "Budget spent · showing the last stored value" };
      }
      return { value: null, status: "Unavailable", ageMs: null, detail: "Budget spent and nothing is cached" };
    }
    try {
      const value = await opts.loader();
      opts.cache.set(opts.key, value);
      return { value, status: opts.classify?.(value, 0) ?? "Live", ageMs: 0 };
    } finally {
      opts.budget.leave();
    }
  });
}
