import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { Halcyon } from "./halcyon";
import { PROVIDER_BUDGETS, QuoteHub } from "./quotes";

const dir = await mkdtemp(path.join(os.tmpdir(), "halcyon-"));

describe("halcyon service", () => {
  const appPromise = Halcyon.open(dir, new QuoteHub({ fetch: async () => new Response("no", { status: 500 }) }));

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("seeds Maya with cash and posts an internal transfer", async () => {
    const app = await appPromise;
    const { user } = await app.login("maya@halcyon.demo", "meridian-desk", "vitest");
    const home = await app.home(user.id);
    expect(home.cashMinor).toBeGreaterThan(0);
    const banking = await app.banking(user.id);
    const checking = banking.accounts.find((account) => account.type === "checking");
    const savings = banking.accounts.find((account) => account.type === "hysa");
    expect(checking && savings).toBeTruthy();
    const before = checking!.balanceMinor;
    const moved = await app.transfer(user.id, {
      fromAccountId: checking!.id,
      toAccountId: savings!.id,
      amount: "25.00",
      kind: "internal",
      memo: "Test sweep",
      idempotencyKey: "test_transfer_25",
      confirmed: true,
    });
    expect(moved.status).toBe("posted");
    const again = await app.banking(user.id);
    const next = again.accounts.find((account) => account.id === checking!.id);
    expect(next!.balanceMinor).toBe(before - 2500);
  });

  it("partial-fills a market buy against the replay tape", async () => {
    const app = await appPromise;
    const { user } = await app.login("maya@halcyon.demo", "meridian-desk", "vitest");
    const banking = await app.banking(user.id);
    const broker = banking.accounts.find((account) => account.type === "brokerage");
    const result = await app.placeOrder(user.id, {
      accountId: broker!.id,
      symbol: "AAPL",
      side: "buy",
      type: "market",
      qty: 100,
      tif: "day",
      idempotencyKey: "test_partial_aapl",
      confirmed: true,
    });
    expect(result.order.filledQty).toBe(40);
    expect(result.order.status).toBe("cancelled");
    expect(result.venue).toBe("HALCYON-SIM");
  });

  it("returns labeled bars and news with zero keys when upstream fails", async () => {
    const app = await appPromise;
    const { user } = await app.login("maya@halcyon.demo", "meridian-desk", "vitest");
    const page = await app.symbol(user.id, "AAPL", "3M");
    expect(page.chart.bars.length).toBeGreaterThan(10);
    expect(page.chart.source.length).toBeGreaterThan(0);
    expect(page.news.length).toBeGreaterThan(0);
    expect(page.newsMeta.status).toBeTruthy();
    expect(page.buyingPowerMinor).toBeGreaterThan(0);
    expect(page.accountId).toBeTruthy();
  });
});

describe("provider budgets", () => {
  it("keeps the coingecko cap in config rather than at a call site", () => {
    expect(PROVIDER_BUDGETS.find((item) => item.id === "coingecko")?.perMinute).toBe(8);
  });

  it("includes a yahoo budget for public chart history", () => {
    expect(PROVIDER_BUDGETS.find((item) => item.id === "yahoo")?.perMinute).toBe(20);
  });
});

describe("signed session cookies", () => {
  it("authenticates across isolated PGlite instances without a shared sessions row", async () => {
    const aDir = await mkdtemp(path.join(os.tmpdir(), "halcyon-a-"));
    const bDir = await mkdtemp(path.join(os.tmpdir(), "halcyon-b-"));
    try {
      process.env.SESSION_SECRET = "vitest-session-secret";
      const a = await Halcyon.open(aDir, new QuoteHub({ fetch: async () => new Response("no", { status: 500 }) }));
      const { token, user } = await a.login("maya@halcyon.demo", "meridian-desk", "vitest-a");
      expect(token.startsWith("v1.")).toBe(true);

      const b = await Halcyon.open(bDir, new QuoteHub({ fetch: async () => new Response("no", { status: 500 }) }));
      const resolved = await b.userByToken(token);
      expect(resolved?.id).toBe(user.id);
      const home = await b.home(user.id);
      expect(home.cashMinor).toBeGreaterThan(0);
    } finally {
      await rm(aDir, { recursive: true, force: true });
      await rm(bDir, { recursive: true, force: true });
    }
  });
});
