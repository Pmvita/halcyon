import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  FEE,
  HalcyonError,
  LEGAL_VERSION,
  Ledger,
  allocateLots,
  answerHelp,
  blackScholes,
  cancelOrder,
  convertWithSpread,
  demoPan,
  displayedDepth,
  dollarsToMinor,
  equitySession,
  formatMoney,
  matchOnce,
  modifiedDuration,
  nextBusinessMorning,
  optionExpiry,
  payoffSeries,
  planTransfer,
  reviewSend,
  roundMinor,
  sanitizeName,
  treasuryModelPrice,
  wireSameDay,
  type AssetClass,
  type JournalDraft,
  type LiveQuote,
  type WorkingOrder,
} from "@halcyon/domain";
import { argon2id } from "hash-wasm";
import { Database } from "./db";
import { journalEntries, journalLines } from "./schema";
import { seedIfEmpty, wipePersona } from "./seed";
import { QuoteHub } from "./quotes";
import { BASKETS, CRYPTO, FX_PAIRS, INSTRUMENTS, findCrypto, findInstrument } from "./universe";

export type PublicUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  persona: string;
  householdId: string | null;
  theme: string;
  density: string;
  displayCurrency: string;
  introSeen: boolean;
  termsVersion: string | null;
  kycStatus: string;
  replayEnabled: boolean;
  handle: string | null;
};

const CASH_TYPES = new Set(["checking", "hysa", "joint", "cd", "escrow", "cash_management"]);
const SKIP_ACTIVITY = new Set(["acct_maya_sec", "acct_maya_cinv", "acct_maya_home", "acct_house"]);

function nid(prefix: string): string {
  return `${prefix}_${randomBytes(8).toString("hex")}`;
}

function sha(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function workspaceDataDir(): string {
  if (process.env.HALCYON_DATA) return process.env.HALCYON_DATA;
  let dir = process.cwd();
  for (let i = 0; i < 6; i += 1) {
    if (fs.existsSync(path.join(dir, "pnpm-workspace.yaml"))) return path.join(dir, ".data", "pglite");
    dir = path.dirname(dir);
  }
  return path.join(process.cwd(), ".data", "pglite");
}

export class Halcyon {
  readonly quotes: QuoteHub;
  private readonly failures = new Map<string, { n: number; until: number }>();

  private constructor(private readonly db: Database, quotes?: QuoteHub) {
    this.quotes = quotes ?? new QuoteHub();
  }

  static async open(dataDir: string, quotes?: QuoteHub): Promise<Halcyon> {
    fs.mkdirSync(dataDir, { recursive: true });
    const db = await Database.open(dataDir);
    const app = new Halcyon(db, quotes);
    await seedIfEmpty(db);
    return app;
  }

  async login(email: string, password: string, device: string): Promise<{ token: string; user: PublicUser }> {
    const key = email.toLowerCase();
    const lock = this.failures.get(key);
    if (lock && lock.until > Date.now()) {
      const seconds = Math.ceil((lock.until - Date.now()) / 1000);
      throw new HalcyonError("locked", `Too many attempts. Try again in ${seconds}s.`);
    }
    const row = await this.db.one<{ id: string; password_hash: string }>("select id, password_hash from users where email = $1", [key]);
    const ok = row ? await verifyPassword(password, row.password_hash) : false;
    if (!row || !ok) {
      const next = { n: (lock?.n ?? 0) + 1, until: 0 };
      if (next.n >= 5) next.until = Date.now() + 60_000;
      this.failures.set(key, next);
      throw new HalcyonError("auth", "That email and password do not match a demo profile.");
    }
    this.failures.delete(key);
    const token = randomBytes(32).toString("hex");
    await this.db.run(
      "insert into sessions (id, user_id, token_hash, device, created_at, expires_at) values ($1,$2,$3,$4,now(), now() + interval '14 days')",
      [nid("ses"), row.id, sha(token), device.slice(0, 160)],
    );
    await this.audit(row.id, "login", { device: device.slice(0, 160) });
    const user = await this.user(row.id);
    if (!user) throw new HalcyonError("auth", "Profile missing after login.");
    return { token, user };
  }

  async userByToken(token: string | undefined): Promise<PublicUser | null> {
    if (!token) return null;
    const row = await this.db.one<{ user_id: string }>(
      "select user_id from sessions where token_hash = $1 and expires_at > now()",
      [sha(token)],
    );
    if (!row) return null;
    return this.user(row.user_id);
  }

  async logout(token: string | undefined): Promise<void> {
    if (!token) return;
    await this.db.run("delete from sessions where token_hash = $1", [sha(token)]);
  }

  async logoutAll(userId: string): Promise<void> {
    await this.db.run("delete from sessions where user_id = $1", [userId]);
    await this.audit(userId, "logout_all", {});
  }

  async home(userId: string) {
    await this.settleDue();
    await this.accrue(userId);
    const user = await this.must(userId);
    const accounts = await this.visibleAccounts(user);
    const balances = await this.balances(accounts.map((account) => account.id));
    const lots = await this.lotsFor(accounts.map((account) => account.id));
    const marks = await this.markLots(lots, user.replayEnabled);
    const cash = sumKinds(accounts, balances, (account) => CASH_TYPES.has(account.type));
    const investCash = sumKinds(accounts, balances, (account) => account.type === "brokerage");
    const cryptoCash = sumKinds(accounts, balances, (account) => account.type === "crypto_cash");
    const card = sumKinds(accounts, balances, (account) => account.type === "credit");
    const homeEquity = sumKinds(accounts, balances, (account) => account.type === "home" || account.type === "mortgage");
    const session = equitySession(new Date(), user.replayEnabled);
    const [btc, spy] = await Promise.all([
      Promise.race([this.quotes.quote("BTC", "page", user.replayEnabled), sleep<LiveQuote>(1800)]),
      Promise.resolve(this.quotes.equityQuote("SPY", user.replayEnabled)),
    ]);
    const activity = await this.activity(accounts.map((account) => account.id), 12);
    const bills = await this.db.all("select id, memo, amount_minor, status, scheduled_for, kind from payments where actor_id = $1 order by created_at desc limit 8", [userId]);
    const alerts = await this.db.all("select id, kind, title, body, href, read, created_at from inbox where user_id = $1 order by created_at desc limit 6", [userId]);
    return {
      user,
      session,
      netWorthMinor: cash + investCash + marks.equityMarket + cryptoCash + marks.cryptoMarket + homeEquity + card,
      cashMinor: cash,
      investmentsMinor: investCash + marks.equityMarket,
      cryptoMinor: cryptoCash + marks.cryptoMarket,
      cardMinor: card,
      homeEquityMinor: homeEquity,
      quotes: [btc ?? this.seedCrypto("BTC"), spy, this.quotes.equityQuote("AAPL", user.replayEnabled)],
      activity,
      bills,
      alerts,
      unread: alerts.filter((item) => item.read === false).length,
    };
  }

  async banking(userId: string) {
    await this.settleDue();
    const user = await this.must(userId);
    const accounts = await this.visibleAccounts(user);
    const balances = await this.balances(accounts.map((account) => account.id));
    const holds = await this.db.all<{ account_id: string; sum: number }>(
      "select account_id, coalesce(sum(amount_minor),0)::int as sum from holds where status = 'pending' group by account_id",
    );
    const payees = await this.db.all("select * from payees where owner_id = $1", [userId]);
    const payments = await this.db.all("select * from payments where actor_id = $1 order by created_at desc limit 20", [userId]);
    const cards = await this.db.all("select id, account_id, last4, status, frozen, limits from cards where owner_id = $1", [userId]);
    const holdRows = await this.db.all("select id, account_id, amount_minor, merchant, status, city from holds where status = 'pending'");
    return {
      accounts: accounts.map((account) => ({
        ...account,
        balanceMinor: balances.get(account.id) ?? 0,
        heldMinor: Number(holds.find((hold) => hold.account_id === account.id)?.sum ?? 0),
      })),
      payees,
      payments,
      cards,
      holds: holdRows.filter((hold) => accounts.some((account) => account.id === String(hold.account_id))),
      activity: await this.activity(accounts.map((account) => account.id), 40),
      routing: "021000021",
      accountNumber: "999001184",
    };
  }

  async transfer(userId: string, input: {
    fromAccountId: string;
    toAccountId?: string;
    payeeHandle?: string;
    amount: string;
    kind: string;
    memo?: string;
    idempotencyKey: string;
    confirmed: true;
    useOverdraft?: boolean;
  }) {
    const user = await this.must(userId);
    const amountMinor = dollarsToMinor(input.amount);
    const accounts = await this.visibleAccounts(user);
    const from = accounts.find((account) => account.id === input.fromAccountId);
    if (!from) throw new HalcyonError("account", "That account is not on this profile.");
    const sent = await this.sentToday(userId);
    const gate = reviewSend({ amountMinor, sentTodayMinor: sent });
    if (gate.hold) throw new HalcyonError("limit", gate.reason ?? "Payment held.");
    if (gate.stepUp && !(await this.steppedUp(userId))) {
      throw new HalcyonError("step_up", "Re-enter your password to send $5,000 or more.");
    }
    const available = (await this.balance(from.id)) - (await this.held(from.id));
    const memo = sanitizeName(input.memo || defaultMemo(input.kind));
    if (input.kind === "international") {
      return { status: "corridor", message: "Demo corridor coming. No SWIFT transfer was created.", quote: { amount: formatMoney(amountMinor), fee: "$0 shown because nothing is sent." } };
    }
    if (input.kind === "person") {
      const handle = sanitizeName(input.payeeHandle ?? "").toLowerCase();
      const person = await this.db.one<{ id: string; name: string }>("select id, name from users where handle = $1 and role = 'client'", [handle]);
      if (!person) throw new HalcyonError("payee", "That handle is not a Halcyon demo user. Person-to-person pay stays inside the demo.");
      const dest = await this.db.one<{ id: string }>("select id from accounts where owner_id = $1 and type = 'checking' limit 1", [person.id]);
      if (!dest) throw new HalcyonError("payee", `${person.name} has no checking account in the demo yet.`);
      await this.postCash(userId, from.id, dest.id, amountMinor, available, memo, input.idempotencyKey, input.useOverdraft);
      await this.notify(person.id, "money", "Payment received", `${user.name} sent ${formatMoney(amountMinor)}.`, "/banking");
      return { status: "posted", message: `Sent ${formatMoney(amountMinor)} to ${person.name}.` };
    }
    if (input.kind === "ach" || input.kind === "bill") {
      if (available < amountMinor) throw new HalcyonError("funds", "Insufficient funds for this payment.");
      const when = input.kind === "ach" ? nextBusinessMorning(new Date()) : new Date(Date.now() + 2 * 86_400_000);
      await this.db.run(
        `insert into payments (id, actor_id, from_account_id, to_account_id, amount_minor, currency, kind, status, memo, idempotency_key, timeline, scheduled_for, created_at)
         values ($1,$2,$3,$4,$5,'USD',$6,'pending',$7,$8,$9::jsonb,$10,now())`,
        [nid("pay"), userId, from.id, input.toAccountId ?? null, amountMinor, input.kind, memo, input.idempotencyKey, JSON.stringify([{ at: new Date().toISOString(), state: "Accepted", note: "Waiting for the next business morning." }]), when.toISOString()],
      );
      await this.db.run("insert into holds (id, account_id, amount_minor, currency, status, merchant, city, category, created_at) values ($1,$2,$3,'USD','pending',$4,'', $5, now())", [nid("hold"), from.id, amountMinor, memo, input.kind]);
      return { status: "pending", message: `${input.kind === "ach" ? "Bank transfer" : "Bill"} accepted. Available on the next business morning. Nothing left the demo.` };
    }
    if (input.kind === "wire") {
      const sameDay = wireSameDay(new Date());
      const fee = FEE.wireDomesticMinor;
      if (available < amountMinor + fee) throw new HalcyonError("funds", `Insufficient funds for the wire and the ${formatMoney(fee)} fee.`);
      await this.post(userId, {
        kind: "wire",
        memo: `Wire · ${memo}`,
        idempotencyKey: input.idempotencyKey,
        actorId: userId,
        meta: { category: "Wire", merchant: memo },
        lines: [
          { accountId: from.id, amountMinor: -(amountMinor + fee), currency: "USD" },
          { accountId: "acct_house", amountMinor: amountMinor + fee, currency: "USD" },
        ],
      });
      return { status: sameDay ? "posted" : "scheduled", message: sameDay ? `Wire posted with a ${formatMoney(fee)} fee.` : `Cutoff passed (3:00pm ET). Quoted fee ${formatMoney(fee)}. Posted now in the demo because the corridor is internal.` };
    }
    const to = accounts.find((account) => account.id === input.toAccountId);
    if (!to) throw new HalcyonError("account", "Choose a destination account.");
    if (from.currency !== to.currency) {
      const mid = 1.08;
      const converted = convertWithSpread(amountMinor, to.currency === "EUR" ? mid : 1 / mid, "buy");
      await this.post(userId, {
        kind: "fx",
        memo: `FX ${from.currency} to ${to.currency}`,
        idempotencyKey: input.idempotencyKey,
        actorId: userId,
        meta: { category: "FX", merchant: "Halcyon FX", spreadMinor: converted.spreadMinor },
        lines: [
          { accountId: from.id, amountMinor: -amountMinor, currency: from.currency },
          { accountId: "acct_house", amountMinor: amountMinor, currency: from.currency },
          { accountId: to.id, amountMinor: converted.quoteMinor, currency: to.currency },
          { accountId: "acct_house", amountMinor: -converted.quoteMinor, currency: to.currency },
        ],
      });
      return { status: "posted", message: `Converted at mid ${converted.appliedRate.toFixed(4)} including the 0.40% demo spread (${formatMoney(converted.spreadMinor, to.currency)}).` };
    }
    await this.postCash(userId, from.id, to.id, amountMinor, available, memo, input.idempotencyKey, input.useOverdraft);
    return { status: "posted", message: `Moved ${formatMoney(amountMinor)} to ${to.name}.` };
  }

  async paycheck(userId: string) {
    const user = await this.must(userId);
    const checking = (await this.visibleAccounts(user)).find((account) => account.type === "checking");
    const hysa = (await this.visibleAccounts(user)).find((account) => account.type === "hysa");
    const broker = (await this.visibleAccounts(user)).find((account) => account.type === "brokerage");
    if (!checking) throw new HalcyonError("account", "Open a checking account with demo funds first.");
    const lines = [
      { accountId: checking.id, amountMinor: 682_000, currency: "USD" },
      { accountId: "acct_house", amountMinor: -682_000 - (hysa ? 372_000 : 0) - (broker ? 186_000 : 0), currency: "USD" },
    ];
    if (hysa) lines.push({ accountId: hysa.id, amountMinor: 372_000, currency: "USD" });
    if (broker) lines.push({ accountId: broker.id, amountMinor: 186_000, currency: "USD" });
    await this.post(userId, { kind: "paycheck", memo: "ACME PAYROLL · simulated", actorId: userId, idempotencyKey: nid("payck"), meta: { category: "Income", merchant: "ACME PAYROLL" }, lines });
    await this.notify(userId, "money", "Paycheck posted", "A simulated paycheck was split across your accounts.", "/banking");
    return { message: "Paycheck posted. The split is checking, savings, and brokerage when those accounts exist." };
  }

  async addFunds(userId: string, acceptedRisk: boolean) {
    if (!acceptedRisk) throw new HalcyonError("risk", "Confirm the risk disclosure before adding demo funds.");
    const user = await this.must(userId);
    if (user.termsVersion !== LEGAL_VERSION) throw new HalcyonError("terms", "Accept the current terms before funding.");
    let checking = (await this.visibleAccounts(user)).find((account) => account.type === "checking");
    if (!checking) {
      const id = nid("acct");
      await this.db.run(
        `insert into accounts (id, owner_id, household_id, visibility, kind, type, name, currency, overdraft_enabled, status) values ($1,$2,$3,'private','asset','checking','Everyday checking','USD',false,'open')`,
        [id, userId, user.householdId],
      );
      checking = { id, name: "Everyday checking", type: "checking", currency: "USD" } as Awaited<ReturnType<Halcyon["visibleAccounts"]>>[number];
    }
    await this.post(userId, {
      kind: "funding",
      memo: "Demo funds",
      actorId: userId,
      idempotencyKey: `funds_${userId}_${Date.now()}`,
      meta: { category: "Transfer", merchant: "Demo funds" },
      lines: [
        { accountId: checking.id, amountMinor: 2_500_000, currency: "USD" },
        { accountId: "acct_house", amountMinor: -2_500_000, currency: "USD" },
      ],
    });
    return { message: "Added $25,000 of demo funds. Halcyon is not holding a deposit." };
  }

  async stopPayment(userId: string, paymentId: string) {
    const row = await this.db.one<{ status: string }>("select status from payments where id = $1 and actor_id = $2", [paymentId, userId]);
    if (!row) throw new HalcyonError("missing", "Payment not found.");
    if (row.status === "posted") throw new HalcyonError("state", "That payment already posted and needs a reversal, not a stop.");
    await this.db.run("update payments set status = 'stopped' where id = $1", [paymentId]);
    await this.db.run("update holds set status = 'released' where merchant in (select memo from payments where id = $1) and status = 'pending'", [paymentId]);
    return { message: "Stop payment recorded. The item will not post." };
  }

  async revealCard(userId: string, cardId: string) {
    if (!(await this.steppedUp(userId))) throw new HalcyonError("step_up", "Re-enter your password to show the card number.");
    const card = await this.db.one<{ account_id: string; last4: string }>("select account_id, last4 from cards where id = $1 and owner_id = $2", [cardId, userId]);
    if (!card) throw new HalcyonError("missing", "Card not found.");
    const pan = demoPan(card.account_id);
    await this.audit(userId, "reveal_card", { cardId });
    return { pan, last4: card.last4, note: "Demo number. Prefix 9999 is not a real BIN." };
  }

  async freezeCard(userId: string, cardId: string, frozen: boolean) {
    await this.db.run("update cards set frozen = $3, status = $4 where id = $1 and owner_id = $2", [cardId, userId, frozen, frozen ? "frozen" : "open"]);
    await this.notify(userId, "security", frozen ? "Card frozen" : "Card unfrozen", "The virtual debit card status changed.", "/banking/cards");
    return { frozen };
  }

  async spend(userId: string, input: { merchant: string; amount: string; city: string; category: string }) {
    const card = await this.db.one<{ id: string; account_id: string; frozen: boolean }>("select id, account_id, frozen from cards where owner_id = $1 limit 1", [userId]);
    if (!card) throw new HalcyonError("missing", "No virtual card on this profile.");
    if (card.frozen) throw new HalcyonError("frozen", "The card is frozen. Unfreeze it before the spend simulator can authorize.");
    const amountMinor = dollarsToMinor(input.amount);
    const merchant = sanitizeName(input.merchant);
    await this.db.run(
      "insert into holds (id, account_id, amount_minor, currency, status, merchant, city, category, created_at) values ($1,$2,$3,'USD','pending',$4,$5,$6,now())",
      [nid("hold"), card.account_id, amountMinor, merchant, sanitizeName(input.city), sanitizeName(input.category)],
    );
    return { message: `${merchant} authorized ${formatMoney(amountMinor)} in ${sanitizeName(input.city)}. The hold is pending until you settle or it expires.` };
  }

  async settleHold(userId: string, holdId: string, action: "settle" | "expire") {
    const hold = await this.db.one<{ id: string; account_id: string; amount_minor: number; merchant: string; status: string; category: string }>(
      "select * from holds where id = $1",
      [holdId],
    );
    if (!hold || hold.status !== "pending") throw new HalcyonError("state", "That hold is not pending.");
    const owned = await this.db.one("select id from accounts where id = $1 and owner_id = $2", [hold.account_id, userId]);
    if (!owned) throw new HalcyonError("account", "That hold is not yours.");
    if (action === "expire") {
      await this.db.run("update holds set status = 'expired' where id = $1", [holdId]);
      return { message: "Authorization expired. No ledger entry was posted." };
    }
    const reward = Math.round((hold.amount_minor * FEE.cashbackBps) / 10_000);
    const net = hold.amount_minor - reward;
    await this.post(userId, {
      kind: "card",
      memo: hold.merchant,
      actorId: userId,
      idempotencyKey: `settle_${holdId}`,
      meta: { category: hold.category || "Shopping", merchant: hold.merchant },
      lines: [
        { accountId: hold.account_id, amountMinor: -net, currency: "USD" },
        { accountId: "acct_house", amountMinor: net, currency: "USD" },
      ],
    });
    await this.db.run("update holds set status = 'settled' where id = $1", [holdId]);
    return { message: `Settled ${formatMoney(hold.amount_minor)}. Rewards of ${formatMoney(reward)} posted at 1%.` };
  }

  async placeOrder(userId: string, input: {
    accountId: string;
    symbol: string;
    side: "buy" | "sell";
    type: WorkingOrder["type"];
    qty: number;
    limitPrice?: number;
    stopPrice?: number;
    tif: WorkingOrder["tif"];
    idempotencyKey: string;
    confirmed: true;
  }) {
    const user = await this.must(userId);
    const symbol = input.symbol.toUpperCase();
    const crypto = findCrypto(symbol);
    const inst = findInstrument(symbol);
    const assetClass: AssetClass = crypto ? "crypto" : inst?.assetClass ?? "equity";
    const quote = await this.quotes.quote(symbol, "page", user.replayEnabled);
    if (quote.status === "Unavailable" || quote.ask <= 0) {
      throw new HalcyonError("quote", quote.detail || "No eligible price, so the order was not sent.");
    }
    const prior = await this.db.one("select id, status, filled_qty, reject_reason from orders where idempotency_key = $1", [input.idempotencyKey]);
    if (prior) return { order: prior, quote, replay: true };
    const session = equitySession(new Date(), user.replayEnabled);
    const tradable = assetClass === "crypto" || assetClass === "fx" ? true : session.tradable;
    const working: WorkingOrder = {
      id: nid("ord"),
      symbol,
      side: input.side,
      type: input.type,
      qty: input.qty,
      filledQty: 0,
      limitPrice: input.limitPrice,
      stopPrice: input.stopPrice,
      tif: input.tif,
      status: "open",
      assetClass,
    };
    const matched = matchOnce({
      order: working,
      book: { bid: quote.bid, ask: quote.ask, last: quote.last },
      displayedQty: displayedDepth(assetClass),
      sessionTradable: tradable,
      now: new Date().toISOString(),
      atClose: session.mode !== "open",
    });
    const fill = matched.fills[0];
    if (input.side === "buy" && fill) {
      const needed = roundMinor(fill.price * fill.qty + fill.fee);
      const power = await this.buyingPower(input.accountId);
      if (power < needed) {
        matched.order.status = "rejected";
        matched.order.rejectReason = `Insufficient buying power. This fill needs about ${formatMoney(needed)} and settled buying power is ${formatMoney(power)}.`;
        matched.fills.splice(0, matched.fills.length);
      }
    }
    await this.db.run(
      `insert into orders (id, user_id, account_id, symbol, side, order_type, qty, filled_qty, limit_price, stop_price, tif, status, asset_class, avg_price, reject_reason, idempotency_key, created_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,now())`,
      [working.id, userId, input.accountId, symbol, input.side, input.type, input.qty, matched.order.filledQty, input.limitPrice ?? null, input.stopPrice ?? null, input.tif, matched.order.status, assetClass, fill?.price ?? null, matched.order.rejectReason ?? null, input.idempotencyKey],
    );
    if (fill && matched.order.rejectReason == null) {
      await this.applyFill(userId, input.accountId, symbol, input.side, fill.qty, fill.price, fill.fee, assetClass);
      await this.db.run("insert into executions (id, order_id, qty, price, liquidity, fee, created_at) values ($1,$2,$3,$4,$5,$6,now())", [nid("exe"), working.id, fill.qty, fill.price, fill.liquidity, fill.fee]);
      await this.notify(userId, "trade", `${symbol} ${matched.order.status}`, `${input.side} ${fill.qty} @ ${fill.price.toFixed(2)} on HALCYON-SIM.`, `/markets/${symbol}`);
    }
    return { order: { ...matched.order, id: working.id }, quote, venue: "HALCYON-SIM" };
  }

  async cancel(userId: string, orderId: string) {
    const row = await this.db.one<{ id: string; status: string; filled_qty: number; qty: number; symbol: string; side: "buy" | "sell"; order_type: WorkingOrder["type"]; tif: WorkingOrder["tif"]; asset_class: AssetClass }>(
      "select * from orders where id = $1 and user_id = $2",
      [orderId, userId],
    );
    if (!row) throw new HalcyonError("missing", "Order not found.");
    const next = cancelOrder({
      id: row.id,
      symbol: row.symbol,
      side: row.side,
      type: row.order_type,
      qty: Number(row.qty),
      filledQty: Number(row.filled_qty),
      tif: row.tif,
      status: row.status as WorkingOrder["status"],
      assetClass: row.asset_class,
    });
    await this.db.run("update orders set status = 'cancelled' where id = $1", [orderId]);
    return { status: next.status };
  }

  async orders(userId: string) {
    return this.db.all("select * from orders where user_id = $1 order by created_at desc limit 40", [userId]);
  }

  async markets(userId: string) {
    const user = await this.must(userId);
    const accounts = await this.visibleAccounts(user);
    const lots = await this.lotsFor(accounts.map((account) => account.id));
    const positions = await this.positionRows(lots, user.replayEnabled);
    const watch = await this.db.all<{ symbol: string }>("select symbol from watch_items where user_id = $1", [userId]);
    const symbols = watch.map((item) => item.symbol);
    const quotes = symbols.map((symbol) => (findCrypto(symbol) ? null : this.quotes.equityQuote(symbol, user.replayEnabled)));
    const live: LiveQuote[] = [];
    for (const symbol of symbols) {
      if (findCrypto(symbol)) live.push(await Promise.race([this.quotes.quote(symbol, "screener", user.replayEnabled), sleep<LiveQuote>(1200)]).then((quote) => quote ?? this.seedCrypto(symbol)));
      else live.push(this.quotes.equityQuote(symbol, user.replayEnabled));
    }
    return { positions, watch: live, universe: INSTRUMENTS, baskets: BASKETS, session: equitySession(new Date(), user.replayEnabled), quotesIgnored: quotes.length };
  }

  async symbol(userId: string, symbol: string) {
    const user = await this.must(userId);
    const upper = symbol.toUpperCase();
    const quote = findCrypto(upper)
      ? (await Promise.race([this.quotes.quote(upper, "page", user.replayEnabled), sleep<LiveQuote>(2000)])) ?? this.seedCrypto(upper)
      : await this.quotes.quote(upper, "page", user.replayEnabled);
    const inst = findInstrument(upper);
    const crypto = findCrypto(upper);
    return {
      quote,
      instrument: inst ?? (crypto ? { symbol: upper, name: crypto.name, assetClass: "crypto", about: `${crypto.name} in the curated paper universe.`, currency: "USD", sector: "Crypto", proxy: undefined } : null),
      bars: this.quotes.bars(upper, "3M"),
      news: [
        { title: `${upper} desk brief`, source: "Halcyon seed", time: "Shipped with the demo", href: "https://www.sec.gov/edgar/search/", detail: "Sample headline so the reader is never empty. Follow the source link for a public filing search." },
      ],
      filings: `https://www.sec.gov/edgar/search/#/q=${encodeURIComponent(upper)}`,
    };
  }

  async bonds() {
    await Promise.race([this.quotes.refreshYields(), sleep(2500)]);
    const curve = this.quotes.yields.map((row) => ({
      ...row,
      price: treasuryModelPrice(row.yield, row.years),
      duration: modifiedDuration(row.yield, row.years),
    }));
    return { curve, note: "Model price, not a dealer quote. Yields are FRED when the fetch succeeded, otherwise the shipped snapshot." };
  }

  async options(userId: string, symbol: string, iv = 0.28) {
    const page = await this.symbol(userId, symbol);
    const spot = page.quote.last || 100;
    const rate = this.quotes.yields.find((row) => row.tenor === "3M")?.yield ?? 0.04;
    const expiry = "2026-12-18";
    const years = Math.max(0, (new Date(`${expiry}T21:00:00.000Z`).getTime() - Date.now()) / (365 * 86_400_000));
    const strikes = [0.9, 0.95, 1, 1.05, 1.1].map((mult) => Math.round(spot * mult));
    const chain = strikes.flatMap((strike) =>
      (["call", "put"] as const).map((type) => ({
        type,
        strike,
        ...blackScholes({ type, spot, strike, rate, iv, years }),
      })),
    );
    const sample = chain.find((row) => row.type === "call" && row.strike === strikes[2]) ?? chain[0]!;
    return {
      quote: page.quote,
      chain,
      rate,
      iv,
      expiry,
      payoff: payoffSeries({ type: "call", strike: sample.strike, premium: sample.price, from: spot * 0.7, to: spot * 1.3 }),
      delay: "Delayed · model chain, not OPRA",
      paper: await this.db.all("select * from option_papers where user_id = $1", [userId]),
    };
  }

  async expirePaper(userId: string, paperId: string) {
    const row = await this.db.one<{ id: string; underlying: string; contract_type: "call" | "put"; strike: number; contracts: number; status: string }>(
      "select * from option_papers where id = $1 and user_id = $2",
      [paperId, userId],
    );
    if (!row) throw new HalcyonError("missing", "Option paper not found.");
    if (row.status !== "open") throw new HalcyonError("state", "That contract is already closed.");
    const quote = await this.quotes.quote(row.underlying, "page", true);
    const result = optionExpiry({ type: row.contract_type, position: "long", strike: Number(row.strike), spot: quote.last, contracts: Number(row.contracts) });
    const user = await this.must(userId);
    const broker = (await this.visibleAccounts(user)).find((account) => account.type === "brokerage");
    if (result.exercise && broker) {
      const cost = Math.abs(result.cashMinor);
      await this.post(userId, {
        kind: "exercise",
        memo: `Exercise ${row.underlying} ${row.strike}`,
        actorId: userId,
        idempotencyKey: `ex_${paperId}`,
        lines: [
          { accountId: broker.id, amountMinor: -cost, currency: "USD" },
          { accountId: "acct_maya_sec", amountMinor: cost, currency: "USD" },
        ],
      });
      await this.db.run("insert into lots (id, account_id, symbol, qty, cost_per_unit, opened_at) values ($1,$2,$3,$4,$5,$6)", [nid("lot"), broker.id, row.underlying, result.shareDelta, Number(row.strike), new Date().toISOString()]);
    }
    await this.db.run("update option_papers set status = $2 where id = $1", [paperId, result.exercise ? "exercised" : "expired"]);
    return result;
  }

  async crypto(userId: string) {
    const quotes: LiveQuote[] = [];
    for (const coin of CRYPTO.slice(0, 6)) {
      const quote = await Promise.race([this.quotes.quote(coin.symbol, "screener"), sleep<LiveQuote>(1500)]);
      quotes.push(quote ?? this.seedCrypto(coin.symbol));
    }
    const earns = await this.db.all("select * from earns where user_id = $1", [userId]);
    const watches = await this.db.all("select * from watches where user_id = $1", [userId]);
    const perps = await this.db.all("select * from perps where user_id = $1 and status = 'open'", [userId]);
    const btc = quotes.find((quote) => quote.symbol === "BTC");
    const digest = btc ? `${btc.symbol} last ${btc.last.toFixed(2)} (${btc.status}, ${btc.source}). This sentence is a mechanical summary, not advice.` : "Crypto marks are unavailable.";
    return { quotes, universe: CRYPTO, earns, watches, perps, digest, fees: await this.networkFees() };
  }

  async watch(userId: string, address: string, chain: "btc" | "eth") {
    const trimmed = address.trim();
    if (chain === "btc" && !/^(bc1|[13])[a-zA-HJ-NP-Z0-9]{20,90}$/.test(trimmed)) throw new HalcyonError("address", "That does not look like a Bitcoin address. Halcyon will not ask for a seed phrase.");
    if (chain === "eth" && !/^0x[a-fA-F0-9]{40}$/.test(trimmed)) throw new HalcyonError("address", "That does not look like an Ethereum address.");
    const id = nid("watch");
    await this.db.run("insert into watches (id, user_id, chain, address, label) values ($1,$2,$3,$4,$5)", [id, userId, chain, trimmed, "Watch-only"]);
    const reading = await this.readChain(chain, trimmed);
    return { id, ...reading, notice: "Watch-only. Halcyon cannot move these coins." };
  }

  async networkFees() {
    const budget = this.quotes.budgets.get("mempool");
    if (budget?.tryEnter()) {
      try {
        const response = await fetch("https://mempool.space/api/v1/fees/recommended", { signal: AbortSignal.timeout(2500) });
        if (response.ok) {
          const body = (await response.json()) as { fastestFee?: number; hourFee?: number };
          budget.leave();
          return { btc: body, ethGwei: 15, source: "mempool.space", ethSource: "Documented default · 15 gwei", status: "Live" as const };
        }
      } catch {
        this.quotes.errors.set("mempool", "fee fetch failed");
      }
      budget.leave();
    }
    return { btc: { fastestFee: 20, hourFee: 12, economyFee: 8 }, ethGwei: 15, source: "Documented default", ethSource: "Documented default · 15 gwei", status: "Stale" as const };
  }

  async openPerp(userId: string, input: { symbol: string; side: "buy" | "sell"; leverage: number; margin: string }) {
    if (input.leverage > 5 || input.leverage < 1) throw new HalcyonError("leverage", "Demo leverage is capped at 5x.");
    const quote = await this.quotes.quote(input.symbol, "page");
    const margin = dollarsToMinor(input.margin);
    const notional = (margin / 100) * input.leverage;
    const qty = notional / quote.last;
    const liq = input.side === "buy" ? quote.last * (1 - 1 / input.leverage + 0.02) : quote.last * (1 + 1 / input.leverage - 0.02);
    const user = await this.must(userId);
    const cash = (await this.visibleAccounts(user)).find((account) => account.type === "crypto_cash" || account.type === "checking");
    if (!cash) throw new HalcyonError("account", "No cash account to margin.");
    await this.post(userId, {
      kind: "perp_margin",
      memo: `Perp margin ${input.symbol}`,
      actorId: userId,
      idempotencyKey: nid("perp"),
      lines: [
        { accountId: cash.id, amountMinor: -margin, currency: "USD" },
        { accountId: "acct_house", amountMinor: margin, currency: "USD" },
      ],
    });
    await this.db.run(
      "insert into perps (id, user_id, symbol, side, qty, entry, leverage, margin_minor, status, liq) values ($1,$2,$3,$4,$5,$6,$7,$8,'open',$9)",
      [nid("perp"), userId, input.symbol.toUpperCase(), input.side, qty, quote.last, input.leverage, margin, liq],
    );
    return { message: `Education simulator opened. Liquidation near ${liq.toFixed(2)}. Funding runs on an 8-hour demo clock. No exchange is connected.`, liq };
  }

  async plan(userId: string) {
    const user = await this.must(userId);
    const accounts = await this.visibleAccounts(user);
    const lots = await this.lotsFor(accounts.map((account) => account.id));
    const positions = await this.positionRows(lots, user.replayEnabled);
    const cost = positions.reduce((sum, position) => sum + position.cost, 0);
    const market = positions.reduce((sum, position) => sum + position.market, 0);
    const budgets = await this.db.all("select * from budgets where user_id = $1", [userId]);
    const goals = await this.db.all("select * from goals where user_id = $1", [userId]);
    const spend = await this.categorySpend(userId);
    return {
      positions,
      cost,
      market,
      simpleReturn: cost ? (market - cost) / cost : 0,
      budgets,
      goals,
      spend,
      note: "This is a description of the demo portfolio, not a recommendation. Simple return is market over cost, not a GIPS report.",
    };
  }

  async inbox(userId: string) {
    return this.db.all("select * from inbox where user_id = $1 order by created_at desc limit 50", [userId]);
  }

  async readInbox(userId: string, id: string) {
    await this.db.run("update inbox set read = true where id = $1 and user_id = $2", [id, userId]);
  }

  async search(userId: string, q: string) {
    const term = `%${q.slice(0, 40)}%`;
    const tx = await this.db.all("select id, memo, created_at from journal_entries where actor_id = $1 and memo ilike $2 order by created_at desc limit 8", [userId, term]);
    const symbols = INSTRUMENTS.filter((item) => `${item.symbol} ${item.name}`.toLowerCase().includes(q.toLowerCase())).slice(0, 6);
    const coins = CRYPTO.filter((item) => `${item.symbol} ${item.name}`.toLowerCase().includes(q.toLowerCase())).slice(0, 4);
    const help = answerHelp(q);
    return { transactions: tx, symbols, coins, help };
  }

  async profile(userId: string) {
    const user = await this.must(userId);
    const sessions = await this.db.all("select id, device, created_at, expires_at from sessions where user_id = $1 order by created_at desc", [userId]);
    const outbox = await this.db.all("select * from outbox where user_id = $1 order by created_at desc limit 10", [userId]);
    const beneficiaries = await this.db.all("select * from beneficiaries where user_id = $1", [userId]);
    return { user, sessions, outbox, beneficiaries, legalVersion: LEGAL_VERSION };
  }

  async updateProfile(userId: string, patch: Partial<Pick<PublicUser, "theme" | "density" | "displayCurrency" | "introSeen" | "replayEnabled">> & { terms?: boolean; quiet?: boolean }) {
    if (patch.terms) {
      await this.db.run("update users set terms_version = $2, terms_accepted_at = now() where id = $1", [userId, LEGAL_VERSION]);
    }
    if (patch.theme) await this.db.run("update users set theme = $2 where id = $1", [userId, patch.theme]);
    if (patch.density) await this.db.run("update users set density = $2 where id = $1", [userId, patch.density]);
    if (patch.displayCurrency) await this.db.run("update users set display_currency = $2 where id = $1", [userId, patch.displayCurrency]);
    if (patch.introSeen !== undefined) await this.db.run("update users set intro_seen = $2 where id = $1", [userId, patch.introSeen]);
    if (patch.replayEnabled !== undefined) await this.db.run("update users set replay_enabled = $2 where id = $1", [userId, patch.replayEnabled]);
    await this.audit(userId, "profile", patch as Record<string, unknown>);
    return this.user(userId);
  }

  async stepUp(userId: string, password: string) {
    const row = await this.db.one<{ password_hash: string }>("select password_hash from users where id = $1", [userId]);
    if (!row || !(await verifyPassword(password, row.password_hash))) throw new HalcyonError("auth", "Password did not match. The step-up was not granted.");
    await this.db.run("insert into stepups (user_id, until) values ($1, now() + interval '5 minutes') on conflict (user_id) do update set until = now() + interval '5 minutes'", [userId]);
    return { untilMinutes: 5 };
  }

  async kyc(userId: string, name: string) {
    const clean = sanitizeName(name);
    if (clean.length < 2) throw new HalcyonError("kyc", "Enter the name on the simulated document.");
    await this.db.run("update users set kyc_status = 'verified', name = $2 where id = $1", [userId, clean]);
    return { status: "Verified for demo", note: "A real institution would use a regulated process. This image never leaves the demo, and no credit file was pulled." };
  }

  async reset(persona: "maya" | "andre" | "elena") {
    await wipePersona(this.db, persona);
    if (persona === "maya" || persona === "elena") await seedIfEmpty(this.db);
    return { message: `${persona} was reset. The other personas were left alone.` };
  }

  async health() {
    const flags = await this.db.all("select key, enabled from flags");
    return { providers: this.quotes.health(), flags };
  }

  async setFlag(key: string, enabled: boolean) {
    await this.db.run("insert into flags (key, enabled) values ($1,$2) on conflict (key) do update set enabled = $2", [key, enabled]);
  }

  async statement(userId: string, format: "pdf" | "csv") {
    const banking = await this.banking(userId);
    if (format === "csv") {
      const lines = ["date,memo,account,amount"];
      for (const item of banking.activity) {
        lines.push(`${item.at},"${String(item.memo).replace(/"/g, "")}",${item.account},${(Number(item.amountMinor) / 100).toFixed(2)}`);
      }
      return { mime: "text/csv", filename: "halcyon-specimen.csv", body: lines.join("\n") };
    }
    const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([612, 792]);
    const font = await pdf.embedFont(StandardFonts.TimesRoman);
    const ink = rgb(0.11, 0.1, 0.08);
    page.drawText("HALCYON  ·  SPECIMEN STATEMENT", { x: 48, y: 740, size: 16, font, color: ink });
    page.drawText("Simulated balances. Not a bank statement. No FDIC or SIPC coverage.", { x: 48, y: 718, size: 10, font, color: rgb(0.45, 0.3, 0.15) });
    let y = 680;
    for (const account of banking.accounts.filter((account) => account.kind !== "equity").slice(0, 10)) {
      page.drawText(`${account.name}  ${formatMoney(account.balanceMinor, account.currency)}`, { x: 48, y, size: 11, font, color: ink });
      y -= 18;
    }
    y -= 10;
    for (const item of banking.activity.slice(0, 18)) {
      page.drawText(`${String(item.memo).slice(0, 42)}  ${formatMoney(Number(item.amountMinor))}`, { x: 48, y, size: 9, font, color: ink });
      y -= 14;
      if (y < 72) break;
    }
    const bytes = await pdf.save();
    return { mime: "application/pdf", filename: "halcyon-specimen.pdf", body: Buffer.from(bytes).toString("base64"), encoding: "base64" };
  }

  private async applyFill(userId: string, accountId: string, symbol: string, side: "buy" | "sell", qty: number, price: number, fee: number, assetClass: AssetClass) {
    const cost = roundMinor(price * qty);
    const feeMinor = roundMinor(fee);
    const inventory = assetClass === "crypto" ? "acct_maya_cinv" : "acct_maya_sec";
    if (side === "buy") {
      await this.post(userId, {
        kind: "trade",
        memo: `Buy ${qty} ${symbol}`,
        actorId: userId,
        idempotencyKey: nid("fill"),
        meta: { category: "Trade", merchant: symbol, symbol, qty },
        lines: [
          { accountId, amountMinor: -(cost + feeMinor), currency: "USD" },
          { accountId: inventory, amountMinor: cost, currency: "USD" },
          { accountId: "acct_house", amountMinor: feeMinor, currency: "USD" },
        ],
      });
      await this.db.run("insert into lots (id, account_id, symbol, qty, cost_per_unit, opened_at) values ($1,$2,$3,$4,$5,$6)", [nid("lot"), accountId, symbol, qty, price, new Date().toISOString()]);
      return;
    }
    const lotRows = await this.db.all<{ id: string; qty: number; cost_per_unit: number; opened_at: string; symbol: string; account_id: string }>(
      "select * from lots where account_id = $1 and symbol = $2 and qty > 0 order by opened_at",
      [accountId, symbol],
    );
    const allocation = allocateLots(lotRows.map((lot) => ({ id: lot.id, symbol: lot.symbol, accountId: lot.account_id, qty: Number(lot.qty), costPerUnit: Number(lot.cost_per_unit), openedAt: lot.opened_at })), qty, "fifo");
    const basis = roundMinor(allocation.basis);
    const proceeds = cost;
    await this.post(userId, {
      kind: "trade",
      memo: `Sell ${qty} ${symbol}`,
      actorId: userId,
      idempotencyKey: nid("fill"),
      meta: { category: "Trade", merchant: symbol },
      lines: [
        { accountId, amountMinor: proceeds - feeMinor, currency: "USD" },
        { accountId: inventory, amountMinor: -basis, currency: "USD" },
        { accountId: "acct_house", amountMinor: feeMinor - (proceeds - basis), currency: "USD" },
      ],
    });
    for (const part of allocation.allocations) {
      await this.db.run("update lots set qty = qty - $2 where id = $1", [part.lot.id, part.qty]);
    }
  }

  private async postCash(userId: string, fromId: string, toId: string, amountMinor: number, available: number, memo: string, key: string, useOverdraft?: boolean) {
    const from = await this.db.one<{ overdraft_enabled: boolean; overdraft_link_id: string | null }>("select overdraft_enabled, overdraft_link_id from accounts where id = $1", [fromId]);
    const overdraft = useOverdraft && from?.overdraft_enabled && from.overdraft_link_id
      ? { linkAccountId: from.overdraft_link_id, linkAvailableMinor: await this.balance(from.overdraft_link_id), feeMinor: FEE.overdraftMinor, houseFeeAccountId: "acct_house" }
      : undefined;
    const drafts = planTransfer({ fromAccountId: fromId, toAccountId: toId, amountMinor, currency: "USD", availableMinor: available, memo, idempotencyKey: key, actorId: userId, overdraft });
    for (const draft of drafts) await this.post(userId, { ...draft, meta: { category: "Transfer", merchant: memo } });
  }

  private async post(userId: string, draft: JournalDraft): Promise<string> {
    if (draft.idempotencyKey) {
      const prior = await this.db.one<{ id: string }>("select id from journal_entries where idempotency_key = $1", [draft.idempotencyKey]);
      if (prior) return prior.id;
    }
    const entry = new Ledger().post(draft);
    await this.db.orm.insert(journalEntries).values({
      id: entry.id,
      createdAt: new Date(entry.at),
      idempotencyKey: entry.idempotencyKey,
      kind: entry.kind,
      memo: entry.memo,
      actorId: entry.actorId ?? userId,
      reversesId: entry.reversesId,
      meta: entry.meta ?? {},
    });
    await this.db.orm.insert(journalLines).values(entry.lines.map((line) => ({ id: nid("jl"), entryId: entry.id, accountId: line.accountId, amountMinor: line.amountMinor, currency: line.currency })));
    return entry.id;
  }

  private async user(id: string): Promise<PublicUser | null> {
    return this.db.one<PublicUser>(
      `select id, email, name, role, persona, household_id as "householdId", theme, density, display_currency as "displayCurrency", intro_seen as "introSeen", terms_version as "termsVersion", kyc_status as "kycStatus", replay_enabled as "replayEnabled", handle from users where id = $1`,
      [id],
    );
  }

  private async must(id: string): Promise<PublicUser> {
    const user = await this.user(id);
    if (!user) throw new HalcyonError("auth", "Sign in again.");
    return user;
  }

  private async visibleAccounts(user: PublicUser) {
    return this.db.all<{ id: string; name: string; type: string; kind: string; currency: string; visibility: string; owner_id: string; apy_bps: number | null }>(
      "select id, name, type, kind, currency, visibility, owner_id, apy_bps from accounts where owner_id = $1 or (visibility = 'shared' and household_id = $2)",
      [user.id, user.householdId],
    );
  }

  private async balance(accountId: string): Promise<number> {
    const row = await this.db.one<{ sum: number }>("select coalesce(sum(amount_minor),0)::int as sum from journal_lines where account_id = $1", [accountId]);
    return Number(row?.sum ?? 0);
  }

  private async held(accountId: string): Promise<number> {
    const row = await this.db.one<{ sum: number }>("select coalesce(sum(amount_minor),0)::int as sum from holds where account_id = $1 and status = 'pending'", [accountId]);
    return Number(row?.sum ?? 0);
  }

  private async balances(ids: string[]) {
    const map = new Map<string, number>();
    if (!ids.length) return map;
    const rows = await this.db.all<{ account_id: string; sum: number }>("select account_id, coalesce(sum(amount_minor),0)::int as sum from journal_lines group by account_id");
    for (const row of rows) if (ids.includes(row.account_id)) map.set(row.account_id, Number(row.sum));
    return map;
  }

  private async lotsFor(accountIds: string[]) {
    if (!accountIds.length) return [];
    const rows = await this.db.all<{ id: string; account_id: string; symbol: string; qty: number; cost_per_unit: number; opened_at: string }>("select * from lots where qty > 0.0000001");
    return rows.filter((row) => accountIds.includes(row.account_id));
  }

  private async markLots(lots: { symbol: string; qty: number; cost_per_unit: number }[], replay: boolean) {
    let equityMarket = 0;
    let equityCost = 0;
    let cryptoMarket = 0;
    let cryptoCost = 0;
    for (const lot of lots) {
      const qty = Number(lot.qty);
      const cost = qty * Number(lot.cost_per_unit) * 100;
      const quote = findCrypto(lot.symbol) ? this.seedCrypto(lot.symbol) : this.quotes.equityQuote(lot.symbol, replay);
      const market = qty * quote.last * 100;
      if (findCrypto(lot.symbol)) {
        cryptoMarket += market;
        cryptoCost += cost;
      } else {
        equityMarket += market;
        equityCost += cost;
      }
    }
    return { equityMarket: Math.round(equityMarket), equityCost: Math.round(equityCost), cryptoMarket: Math.round(cryptoMarket), cryptoCost: Math.round(cryptoCost) };
  }

  private async positionRows(lots: { symbol: string; qty: number; cost_per_unit: number }[], replay: boolean) {
    const grouped = new Map<string, { qty: number; cost: number }>();
    for (const lot of lots) {
      const current = grouped.get(lot.symbol) ?? { qty: 0, cost: 0 };
      current.qty += Number(lot.qty);
      current.cost += Number(lot.qty) * Number(lot.cost_per_unit);
      grouped.set(lot.symbol, current);
    }
    const rows = [];
    for (const [symbol, position] of grouped) {
      const quote = findCrypto(symbol) ? this.seedCrypto(symbol) : this.quotes.equityQuote(symbol, replay);
      const market = position.qty * quote.last;
      rows.push({ symbol, qty: position.qty, cost: position.cost, market, pnl: market - position.cost, quote });
    }
    return rows;
  }

  private seedCrypto(symbol: string): LiveQuote {
    const meta = findCrypto(symbol);
    const last = meta?.seed ?? 0;
    return { symbol, bid: last * 0.999, ask: last * 1.001, last, prev: last, changePct: 0, asOf: new Date().toISOString(), source: "Halcyon crypto seed", status: "Stale", currency: "USD", session: "24/7", detail: "Showing the shipped seed while the live feed catches up." };
  }

  private async activity(accountIds: string[], limit: number) {
    const rows = await this.db.all<{ id: string; memo: string; created_at: string; meta: { category?: string; merchant?: string }; account_id: string; amount_minor: number }>(
      `select e.id, e.memo, e.created_at, e.meta, l.account_id, l.amount_minor
       from journal_lines l join journal_entries e on e.id = l.entry_id
       where l.account_id = any($1::text[])
       order by e.created_at desc limit 400`,
      [accountIds],
    );
    const seen = new Set<string>();
    const items: { id: string; memo: string; at: string; amountMinor: number; account: string; category: string }[] = [];
    for (const row of rows) {
      if (seen.has(row.id) || SKIP_ACTIVITY.has(row.account_id)) continue;
      seen.add(row.id);
      items.push({ id: row.id, memo: row.memo, at: row.created_at, amountMinor: Number(row.amount_minor), account: row.account_id, category: row.meta?.category ?? "General" });
      if (items.length >= limit) break;
    }
    return items;
  }

  private async buyingPower(accountId: string) {
    return (await this.balance(accountId)) - (await this.held(accountId));
  }

  private async sentToday(userId: string) {
    const row = await this.db.one<{ sum: number }>("select coalesce(sum(amount_minor),0)::int as sum from payments where actor_id = $1 and created_at > now() - interval '1 day' and status <> 'stopped'", [userId]);
    return Number(row?.sum ?? 0);
  }

  private async steppedUp(userId: string) {
    const row = await this.db.one("select user_id from stepups where user_id = $1 and until > now()", [userId]);
    return Boolean(row);
  }

  private async settleDue() {
    const due = await this.db.all<{ id: string; actor_id: string; from_account_id: string; amount_minor: number; memo: string; kind: string }>(
      "select id, actor_id, from_account_id, amount_minor, memo, kind from payments where status = 'pending' and scheduled_for <= now()",
    );
    for (const payment of due) {
      await this.post(payment.actor_id, {
        kind: payment.kind,
        memo: payment.memo,
        actorId: payment.actor_id,
        idempotencyKey: `settle_pay_${payment.id}`,
        meta: { category: "Payment", merchant: payment.memo },
        lines: [
          { accountId: payment.from_account_id, amountMinor: -Number(payment.amount_minor), currency: "USD" },
          { accountId: "acct_house", amountMinor: Number(payment.amount_minor), currency: "USD" },
        ],
      });
      await this.db.run("update holds set status = 'settled' where account_id = $1 and amount_minor = $2 and status = 'pending'", [payment.from_account_id, payment.amount_minor]);
      await this.db.run("update payments set status = 'posted' where id = $1", [payment.id]);
    }
  }

  private async accrue(userId: string) {
    const user = await this.must(userId);
    const accounts = await this.visibleAccounts(user);
    const day = new Date().toISOString().slice(0, 10);
    for (const account of accounts) {
      if (!account.apy_bps) continue;
      const balance = await this.balance(account.id);
      const daily = Math.round((balance * account.apy_bps) / 10_000 / 365);
      if (daily <= 0) continue;
      await this.post(userId, {
        kind: "interest",
        memo: `Posted demo interest · ${account.name}`,
        actorId: userId,
        idempotencyKey: `int_${account.id}_${day}`,
        meta: { category: "Interest", merchant: account.name },
        lines: [
          { accountId: account.id, amountMinor: daily, currency: "USD" },
          { accountId: "acct_house", amountMinor: -daily, currency: "USD" },
        ],
      });
    }
  }

  private async categorySpend(userId: string) {
    const rows = await this.db.all<{ meta: { category?: string }; amount_minor: number }>(
      `select e.meta, l.amount_minor from journal_lines l join journal_entries e on e.id = l.entry_id
       where e.actor_id = $1 and l.amount_minor < 0 and e.created_at > now() - interval '30 days'`,
      [userId],
    );
    const map = new Map<string, number>();
    for (const row of rows) {
      const category = row.meta?.category ?? "General";
      map.set(category, (map.get(category) ?? 0) + Math.abs(Number(row.amount_minor)));
    }
    return [...map.entries()].map(([category, amountMinor]) => ({ category, amountMinor }));
  }

  private async readChain(chain: "btc" | "eth", address: string) {
    const budget = this.quotes.budgets.get(chain === "btc" ? "mempool" : "explorer");
    if (!budget?.tryEnter()) return { balance: null, status: "Cached" as const, detail: "Explorer budget spent. Nothing new was fetched." };
    try {
      if (chain === "btc") {
        const response = await fetch(`https://mempool.space/api/address/${address}`, { signal: AbortSignal.timeout(4000) });
        if (!response.ok) throw new Error(`mempool ${response.status}`);
        const body = (await response.json()) as { chain_stats?: { funded_txo_sum?: number; spent_txo_sum?: number } };
        const sats = (body.chain_stats?.funded_txo_sum ?? 0) - (body.chain_stats?.spent_txo_sum ?? 0);
        return { balance: sats / 1e8, unit: "BTC", status: "Live" as const, source: "mempool.space", href: `https://mempool.space/address/${address}` };
      }
      const response = await fetch(`https://eth.blockscout.com/api/v2/addresses/${address}`, { signal: AbortSignal.timeout(4000) });
      if (!response.ok) throw new Error(`blockscout ${response.status}`);
      const body = (await response.json()) as { coin_balance?: string };
      const eth = Number(body.coin_balance ?? 0) / 1e18;
      return { balance: eth, unit: "ETH", status: "Live" as const, source: "Blockscout", href: `https://eth.blockscout.com/address/${address}` };
    } catch (error) {
      return { balance: null, status: "Unavailable" as const, detail: error instanceof Error ? error.message : "Explorer failed" };
    } finally {
      budget.leave();
    }
  }

  private async notify(userId: string, kind: string, title: string, body: string, href: string) {
    await this.db.run("insert into inbox (id, user_id, kind, title, body, href, read, created_at) values ($1,$2,$3,$4,$5,$6,false,now())", [nid("in"), userId, kind, title, body, href]);
  }

  private async audit(actorId: string, action: string, detail: Record<string, unknown>) {
    await this.db.run("insert into audit_log (id, actor_id, action, detail, created_at) values ($1,$2,$3,$4::jsonb,now())", [nid("aud"), actorId, action, JSON.stringify(detail)]);
  }
}

function sumKinds(accounts: { id: string; type: string }[], balances: Map<string, number>, pred: (account: { type: string }) => boolean) {
  return accounts.filter(pred).reduce((sum, account) => sum + (balances.get(account.id) ?? 0), 0);
}

function defaultMemo(kind: string): string {
  if (kind === "wire") return "Domestic wire";
  if (kind === "ach") return "Bank transfer";
  if (kind === "bill") return "Bill payment";
  return "Transfer";
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [kind, saltHex, hash] = stored.split("$");
  if (kind !== "argon2id" || !saltHex || !hash) return false;
  const next = await argon2id({ password, salt: Buffer.from(saltHex, "hex"), parallelism: 1, iterations: 2, memorySize: 19456, hashLength: 32, outputType: "hex" });
  return next === hash;
}

function sleep<T>(ms: number): Promise<T | undefined> {
  return new Promise((resolve) => setTimeout(() => resolve(undefined), ms));
}

const globalHalcyon = globalThis as unknown as { __halcyon?: Promise<Halcyon> };

export function getHalcyon(): Promise<Halcyon> {
  if (!globalHalcyon.__halcyon) globalHalcyon.__halcyon = Halcyon.open(workspaceDataDir());
  return globalHalcyon.__halcyon;
}
