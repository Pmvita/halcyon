import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { Coalescer, RateBudget, TtlCache, loadThroughBudget } from "./budget";
import { demoPan, luhnValid } from "./cards";
import { tradeFee } from "./fees";
import { Ledger, planTransfer } from "./ledger";
import { allocateLots, applySplit } from "./lots";
import { optionExpiry } from "./options";
import { equitySession, replayPrice } from "./session";
import { cancelOrder, matchOnce, type WorkingOrder } from "./trading";

const book = { bid: 100, ask: 100.05, last: 100.02 };

function order(partial: Partial<WorkingOrder> & Pick<WorkingOrder, "type" | "qty">): WorkingOrder {
  return {
    id: "ord_test",
    symbol: "AAPL",
    side: "buy",
    filledQty: 0,
    tif: "day",
    status: "open",
    assetClass: "equity",
    ...partial,
  };
}

describe("ledger", () => {
  it("posts a balanced transfer and rejects a repeat idempotency key as the same entry", () => {
    const ledger = new Ledger();
    const [draft] = planTransfer({
      fromAccountId: "checking",
      toAccountId: "savings",
      amountMinor: 25_000,
      currency: "USD",
      availableMinor: 40_000,
      memo: "Rent set-aside",
      idempotencyKey: "idem_1",
    });
    const first = ledger.post(draft!);
    const second = ledger.post(draft!);
    expect(second.id).toBe(first.id);
    expect(ledger.balance("checking")).toBe(-25_000);
    expect(ledger.balance("savings")).toBe(25_000);
  });

  it("refuses a transfer when funds are short and overdraft is off", () => {
    expect(() =>
      planTransfer({
        fromAccountId: "checking",
        toAccountId: "savings",
        amountMinor: 80_000,
        currency: "USD",
        availableMinor: 10_000,
        memo: "Too much",
        idempotencyKey: "idem_2",
      }),
    ).toThrow(/Insufficient funds/);
  });

  it("reverses an entry without erasing it", () => {
    const ledger = new Ledger();
    const posted = ledger.post({
      kind: "adjustment",
      memo: "Opening",
      idempotencyKey: "open",
      lines: [
        { accountId: "checking", amountMinor: 5_000, currency: "USD" },
        { accountId: "house", amountMinor: -5_000, currency: "USD" },
      ],
    });
    ledger.reverse(posted.id, "Undo opening", { idempotencyKey: "undo" });
    expect(ledger.balance("checking")).toBe(0);
    expect(ledger.all()).toHaveLength(2);
    expect(ledger.all()[0]?.id).toBe(posted.id);
  });

  it("posts a dividend as cash against the house", () => {
    const ledger = new Ledger();
    ledger.post({
      kind: "dividend",
      memo: "SCHD dividend",
      lines: [
        { accountId: "brokerage", amountMinor: 4_200, currency: "USD" },
        { accountId: "house", amountMinor: -4_200, currency: "USD" },
      ],
    });
    expect(ledger.balance("brokerage")).toBe(4_200);
  });
});

describe("orders", () => {
  it("partially fills a market buy at book depth and cancels the rest", () => {
    const result = matchOnce({
      order: order({ type: "market", qty: 100 }),
      book,
      displayedQty: 40,
      sessionTradable: true,
      now: "2026-11-07T16:00:00.000Z",
    });
    expect(result.fills).toHaveLength(1);
    expect(result.fills[0]?.qty).toBe(40);
    expect(result.order.filledQty).toBe(40);
    expect(result.order.status).toBe("cancelled");
    expect(result.fills[0]?.price).toBeGreaterThan(book.ask);
  });

  it("cancels a resting limit", () => {
    const resting = matchOnce({
      order: order({ type: "limit", qty: 10, limitPrice: 90 }),
      book,
      displayedQty: 40,
      sessionTradable: true,
      now: "2026-11-07T16:00:00.000Z",
    });
    expect(resting.fills).toHaveLength(0);
    expect(resting.order.status).toBe("open");
    expect(cancelOrder(resting.order).status).toBe("cancelled");
  });

  it("charges the crypto taker and maker schedule", () => {
    expect(tradeFee("crypto", "taker", 1, 10_000)).toBeCloseTo(10);
    expect(tradeFee("crypto", "maker", 1, 10_000)).toBeCloseTo(4);
  });

  it("rejects an expired option", () => {
    const result = matchOnce({
      order: order({ type: "market", qty: 1, assetClass: "option", symbol: "AAPL 180C" }),
      book,
      displayedQty: 10,
      sessionTradable: true,
      now: "2026-11-07T16:00:00.000Z",
      expired: true,
    });
    expect(result.order.status).toBe("rejected");
    expect(result.order.rejectReason).toMatch(/expired/i);
  });
});

describe("lots and corporate actions", () => {
  const lots = [
    { id: "a", symbol: "AAPL", accountId: "brk", qty: 10, costPerUnit: 50, openedAt: "2025-01-01" },
    { id: "b", symbol: "AAPL", accountId: "brk", qty: 10, costPerUnit: 80, openedAt: "2026-01-01" },
  ];

  it("uses FIFO by default and LIFO when asked", () => {
    expect(allocateLots(lots, 10, "fifo").basis).toBe(500);
    expect(allocateLots(lots, 10, "lifo").basis).toBe(800);
  });

  it("splits shares without changing total cost", () => {
    const next = applySplit(lots, "AAPL", 2, 1);
    const totalQty = next.reduce((sum, lot) => sum + lot.qty, 0);
    const totalCost = next.reduce((sum, lot) => sum + lot.qty * lot.costPerUnit, 0);
    expect(totalQty).toBe(40);
    expect(totalCost).toBe(1300);
  });

  it("exercises an in-the-money call and expires an out-of-the-money call", () => {
    const itm = optionExpiry({ type: "call", position: "long", strike: 100, spot: 110, contracts: 1 });
    expect(itm.exercise).toBe(true);
    expect(itm.shareDelta).toBe(100);
    expect(itm.cashMinor).toBe(-1_000_000);
    const otm = optionExpiry({ type: "call", position: "long", strike: 100, spot: 90, contracts: 1 });
    expect(otm.exercise).toBe(false);
    expect(otm.cashMinor).toBe(0);
  });
});

describe("sessions", () => {
  it("replays Saturday and is open on a Wednesday afternoon in New York", () => {
    expect(equitySession(new Date("2026-11-07T16:00:00.000Z"), true).mode).toBe("replay");
    expect(equitySession(new Date("2026-11-04T19:00:00.000Z"), true).mode).toBe("open");
  });

  it("keeps the replay path near the official close", () => {
    const price = replayPrice(100, new Date("2026-11-07T16:00:00.000Z"));
    expect(Math.abs(price - 100)).toBeLessThan(0.6);
  });
});

describe("quote budget", () => {
  it("sends at most the configured upstream calls for a burst of 100", async () => {
    const budget = new RateBudget({ id: "test", perMinute: 8, perDay: 100, concurrency: 100 });
    const cache = new TtlCache<number>();
    const coalescer = new Coalescer();
    let upstream = 0;
    await Promise.all(
      Array.from({ length: 100 }, (_, index) =>
        loadThroughBudget({
          key: `SYM${index}`,
          budget,
          cache,
          coalescer,
          freshMs: 15_000,
          staleMs: 60_000,
          loader: async () => {
            upstream += 1;
            return index;
          },
        }),
      ),
    );
    expect(upstream).toBe(8);
  });

  it("coalesces identical in-flight requests into one upstream call", async () => {
    const budget = new RateBudget({ id: "test", perMinute: 30, perDay: 100, concurrency: 10 });
    const cache = new TtlCache<number>();
    const coalescer = new Coalescer();
    let upstream = 0;
    await Promise.all(
      Array.from({ length: 100 }, () =>
        loadThroughBudget({
          key: "BTC",
          budget,
          cache,
          coalescer,
          freshMs: 15_000,
          staleMs: 60_000,
          loader: async () => {
            upstream += 1;
            await new Promise((resolve) => setTimeout(resolve, 20));
            return 1;
          },
        }),
      ),
    );
    expect(upstream).toBe(1);
  });
});

describe("cards and tokens", () => {
  it("issues a Luhn-valid 9999 demo PAN", () => {
    const pan = demoPan("maya-checking");
    expect(pan.startsWith("9999")).toBe(true);
    expect(luhnValid(pan)).toBe(true);
  });

  it("ships the paper, ink, and gold tokens", () => {
    const css = readFileSync(new URL("./tokens.css", import.meta.url), "utf8");
    expect(css).toContain("#f4f0e6");
    expect(css).toContain("#0c1014");
    expect(css).toContain("#b08948");
  });
});
