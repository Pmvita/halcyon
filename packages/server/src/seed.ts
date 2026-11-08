import { randomBytes } from "node:crypto";
import { Ledger, demoPan, type JournalEntry } from "@halcyon/domain";
import { argon2id } from "hash-wasm";
import type { Database } from "./db";
import { journalEntries, journalLines } from "./schema";

const HOUSE = "acct_house";
const CHECKING = "acct_maya_checking";
const HYSA = "acct_maya_hysa";
const BROKER = "acct_maya_broker";
const SEC = "acct_maya_sec";
const CCASH = "acct_maya_ccy";
const CINV = "acct_maya_cinv";
const CARD = "acct_maya_card";
const MORT = "acct_maya_mort";
const HOME = "acct_maya_home";
const ESCROW = "acct_maya_escrow";
const CD = "acct_maya_cd";
const JOINT = "acct_joint";
const ELENA = "acct_elena_checking";

function nid(prefix: string): string {
  return `${prefix}_${randomBytes(8).toString("hex")}`;
}

function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await argon2id({
    password,
    salt,
    parallelism: 1,
    iterations: 2,
    memorySize: 19456,
    hashLength: 32,
    outputType: "hex",
  });
  return `argon2id$${salt.toString("hex")}$${hash}`;
}

async function persist(db: Database, entries: JournalEntry[]): Promise<void> {
  for (const entry of entries) {
    try {
      await db.orm.insert(journalEntries).values({
        id: entry.id,
        createdAt: new Date(entry.at),
        idempotencyKey: entry.idempotencyKey,
        kind: entry.kind,
        memo: entry.memo,
        actorId: entry.actorId,
        reversesId: entry.reversesId,
        meta: entry.meta ?? {},
      });
      if (entry.lines.length) {
        await db.orm.insert(journalLines).values(
          entry.lines.map((line) => ({
            id: nid("jl"),
            entryId: entry.id,
            accountId: line.accountId,
            amountMinor: line.amountMinor,
            currency: line.currency,
          })),
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!/duplicate|unique/i.test(message)) throw error;
    }
  }
}

function book(ledger: Ledger, input: {
  at: string;
  memo: string;
  kind: string;
  actorId: string;
  key: string;
  lines: { accountId: string; amountMinor: number; currency?: string }[];
  meta?: Record<string, unknown>;
}) {
  ledger.post({
    at: input.at,
    memo: input.memo,
    kind: input.kind,
    actorId: input.actorId,
    idempotencyKey: input.key,
    meta: { seedPersona: input.actorId === "usr_elena" ? "elena" : input.actorId === "usr_andre" ? "andre" : "maya", ...input.meta },
    lines: input.lines.map((line) => ({ ...line, currency: line.currency ?? "USD" })),
  });
}

export async function seedIfEmpty(db: Database): Promise<void> {
  const users = await db.one<{ n: number }>("select count(*)::int as n from users");
  if ((users?.n ?? 0) === 0) {
    await createSkeleton(db);
  }
  const maya = await db.one<{ n: number }>("select count(*)::int as n from journal_entries where actor_id = 'usr_maya'");
  if ((maya?.n ?? 0) > 0) return;
  await writeMayaHistory(db);
}

async function createSkeleton(db: Database): Promise<void> {
  const password = await hashPassword("meridian-desk");
  await db.run(
    `insert into households (id, name) values ('hh_chen', 'Chen household')`,
  );
  const people = [
    ["usr_maya", "maya@halcyon.demo", "Maya Chen", "client", "maya", "hh_chen", "maya.chen", true, "verified"],
    ["usr_elena", "elena@halcyon.demo", "Elena Marlowe", "client", "elena", "hh_chen", "elena.m", true, "verified"],
    ["usr_andre", "andre@halcyon.demo", "Andre Walsh", "client", "andre", null, "andre.walsh", false, "unverified"],
    ["usr_admin", "admin@halcyon.demo", "Desk admin", "admin", "admin", null, "desk", true, "verified"],
    ["usr_house", "house@halcyon.demo", "House", "system", "house", null, "house", true, "verified"],
  ] as const;
  for (const [id, email, name, role, persona, household, handle, intro, kyc] of people) {
    await db.run(
      `insert into users (id, email, password_hash, name, role, persona, household_id, handle, intro_seen, terms_version, terms_accepted_at, kyc_status)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [id, email, password, name, role, persona, household, handle, intro, intro ? "2026-11-07" : null, intro ? "2026-05-01T15:00:00.000Z" : null, kyc],
    );
  }
  const accounts: unknown[][] = [
    [HOUSE, "usr_house", null, "private", "equity", "house", "House cash", "USD", null, null, null, false, null, "open"],
    [CHECKING, "usr_maya", "hh_chen", "private", "asset", "checking", "Everyday checking", "USD", null, null, null, false, HYSA, "open"],
    [HYSA, "usr_maya", "hh_chen", "private", "asset", "hysa", "Reserve savings", "USD", 415, null, null, false, null, "open"],
    [BROKER, "usr_maya", "hh_chen", "private", "asset", "brokerage", "Brokerage cash", "USD", null, null, null, false, null, "open"],
    [SEC, "usr_maya", "hh_chen", "private", "asset", "securities", "Securities at cost", "USD", null, null, null, false, null, "open"],
    [CCASH, "usr_maya", "hh_chen", "private", "asset", "crypto_cash", "Crypto cash", "USD", null, null, null, false, null, "open"],
    [CINV, "usr_maya", "hh_chen", "private", "asset", "crypto_inventory", "Crypto at cost", "USD", null, null, null, false, null, "open"],
    [CARD, "usr_maya", "hh_chen", "private", "liability", "credit", "Halcyon Card", "USD", null, 2199, 1_200_000, false, null, "open"],
    [MORT, "usr_maya", "hh_chen", "private", "liability", "mortgage", "Residence mortgage", "USD", null, 612, null, false, null, "open"],
    [HOME, "usr_maya", "hh_chen", "private", "asset", "home", "Residence · self-reported", "USD", null, null, null, false, null, "open"],
    [ESCROW, "usr_maya", "hh_chen", "private", "asset", "escrow", "Mortgage escrow", "USD", null, null, null, false, null, "open"],
    [CD, "usr_maya", "hh_chen", "private", "asset", "cd", "12-month CD", "USD", 450, null, null, false, null, "open"],
    [JOINT, "usr_maya", "hh_chen", "shared", "asset", "joint", "Joint household", "USD", null, null, null, false, null, "open"],
    [ELENA, "usr_elena", "hh_chen", "private", "asset", "checking", "Elena checking", "USD", null, null, null, false, null, "open"],
  ];
  for (const row of accounts) {
    await db.run(
      `insert into accounts (id, owner_id, household_id, visibility, kind, type, name, currency, apy_bps, apr_bps, credit_limit_minor, overdraft_enabled, overdraft_link_id, status, maturity_date)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
      [...row, row[5] === "cd" ? "2027-08-01" : null],
    );
  }
  }

async function writeMayaHistory(db: Database): Promise<void> {
  const ledger = new Ledger();
  const openAt = "2025-05-02T15:00:00.000Z";
  book(ledger, { at: openAt, memo: "Opening checking", kind: "funding", actorId: "usr_maya", key: "seed_maya_checking", lines: [{ accountId: CHECKING, amountMinor: 9_500_000 }, { accountId: HOUSE, amountMinor: -9_500_000 }], meta: { category: "Transfer", merchant: "Opening balance" } });
  book(ledger, { at: openAt, memo: "Opening reserve", kind: "funding", actorId: "usr_maya", key: "seed_maya_hysa", lines: [{ accountId: HYSA, amountMinor: 3_000_000 }, { accountId: HOUSE, amountMinor: -3_000_000 }], meta: { category: "Transfer", merchant: "Opening balance" } });
  book(ledger, { at: openAt, memo: "Brokerage funding", kind: "funding", actorId: "usr_maya", key: "seed_maya_broker", lines: [{ accountId: BROKER, amountMinor: 20_477_500 }, { accountId: HOUSE, amountMinor: -20_477_500 }], meta: { category: "Transfer", merchant: "Brokerage funding" } });
  book(ledger, { at: openAt, memo: "Crypto cash funding", kind: "funding", actorId: "usr_maya", key: "seed_maya_ccy", lines: [{ accountId: CCASH, amountMinor: 5_400_000 }, { accountId: HOUSE, amountMinor: -5_400_000 }], meta: { category: "Transfer", merchant: "Crypto funding" } });
  book(ledger, { at: openAt, memo: "CD opening", kind: "funding", actorId: "usr_maya", key: "seed_maya_cd", lines: [{ accountId: CD, amountMinor: 2_500_000 }, { accountId: HOUSE, amountMinor: -2_500_000 }], meta: { category: "Transfer", merchant: "CD" } });
  book(ledger, { at: openAt, memo: "Joint opening", kind: "funding", actorId: "usr_maya", key: "seed_maya_joint", lines: [{ accountId: JOINT, amountMinor: 642_077 }, { accountId: HOUSE, amountMinor: -642_077 }], meta: { category: "Transfer", merchant: "Joint" } });
  book(ledger, { at: openAt, memo: "Residence and mortgage", kind: "funding", actorId: "usr_maya", key: "seed_maya_home", lines: [{ accountId: HOME, amountMinor: 89_000_000 }, { accountId: MORT, amountMinor: -64_000_000 }, { accountId: HOUSE, amountMinor: -25_000_000 }], meta: { category: "Housing", merchant: "Residence" } });
  book(ledger, { at: openAt, memo: "Elena opening", kind: "funding", actorId: "usr_elena", key: "seed_elena_open", lines: [{ accountId: ELENA, amountMinor: 410_000 }, { accountId: HOUSE, amountMinor: -410_000 }], meta: { category: "Transfer", merchant: "Opening balance" } });

  const buys: [string, string, number, number, string][] = [
    ["VTI", "2025-06-02T15:00:00.000Z", 200, 270, "seed_buy_vti"],
    ["AAPL", "2025-08-15T15:00:00.000Z", 80, 190, "seed_buy_aapl"],
    ["NVDA", "2025-11-03T15:00:00.000Z", 15, 125, "seed_buy_nvda"],
    ["MSFT", "2026-02-10T15:00:00.000Z", 40, 415, "seed_buy_msft"],
    ["SCHD", "2026-05-01T15:00:00.000Z", 200, 27, "seed_buy_schd"],
    ["VTI", "2026-07-20T15:00:00.000Z", 140, 294.2857, "seed_buy_vti2"],
    ["TLT", "2026-03-12T15:00:00.000Z", 150, 90, "seed_buy_tlt"],
    ["GLD", "2026-01-08T15:00:00.000Z", 30, 230, "seed_buy_gld"],
    ["HALX", "2025-09-01T15:00:00.000Z", 20, 30, "seed_buy_halx"],
    ["OLDCO", "2025-10-01T15:00:00.000Z", 10, 10, "seed_buy_oldco"],
  ];
  for (const [symbol, at, qty, px, key] of buys) {
    const cost = Math.round(qty * px * 100);
    book(ledger, {
      at, memo: `Buy ${qty} ${symbol}`, kind: "trade", actorId: "usr_maya", key,
      lines: [{ accountId: BROKER, amountMinor: -cost }, { accountId: SEC, amountMinor: cost }],
      meta: { category: "Trade", merchant: symbol, symbol, qty },
    });
    if (symbol !== "OLDCO") {
      await db.run(`insert into lots (id, account_id, symbol, qty, cost_per_unit, opened_at) values ($1,$2,$3,$4,$5,$6)`, [
        nid("lot"), BROKER, symbol, symbol === "HALX" ? qty * 2 : qty, symbol === "HALX" ? px / 2 : px, at,
      ]);
    }
  }
  const btcCost = Math.round(0.42 * 64_000 * 100);
  const ethCost = Math.round(3.1 * 2_800 * 100);
  const solCost = Math.round(40 * 150 * 100);
  book(ledger, { at: "2026-01-15T15:00:00.000Z", memo: "Buy 0.42 BTC", kind: "trade", actorId: "usr_maya", key: "seed_buy_btc", lines: [{ accountId: CCASH, amountMinor: -btcCost }, { accountId: CINV, amountMinor: btcCost }], meta: { category: "Trade", merchant: "BTC" } });
  book(ledger, { at: "2026-03-02T15:00:00.000Z", memo: "Buy 3.1 ETH", kind: "trade", actorId: "usr_maya", key: "seed_buy_eth", lines: [{ accountId: CCASH, amountMinor: -ethCost }, { accountId: CINV, amountMinor: ethCost }], meta: { category: "Trade", merchant: "ETH" } });
  book(ledger, { at: "2026-04-11T15:00:00.000Z", memo: "Buy 40 SOL", kind: "trade", actorId: "usr_maya", key: "seed_buy_sol", lines: [{ accountId: CCASH, amountMinor: -solCost }, { accountId: CINV, amountMinor: solCost }], meta: { category: "Trade", merchant: "SOL" } });
  await db.run(`insert into lots (id, account_id, symbol, qty, cost_per_unit, opened_at) values ($1,$2,'BTC',0.42,64000,'2026-01-15T15:00:00.000Z')`, [nid("lot"), CCASH]);
  await db.run(`insert into lots (id, account_id, symbol, qty, cost_per_unit, opened_at) values ($1,$2,'ETH',3.1,2800,'2026-03-02T15:00:00.000Z')`, [nid("lot"), CCASH]);
  await db.run(`insert into lots (id, account_id, symbol, qty, cost_per_unit, opened_at) values ($1,$2,'SOL',40,150,'2026-04-11T15:00:00.000Z')`, [nid("lot"), CCASH]);
  await db.run(`insert into earns (id, user_id, symbol, qty, rate, status) values ('earn_eth','usr_maya','ETH',1,0.032,'bonded')`);

  book(ledger, {
    at: "2025-12-01T15:00:00.000Z", memo: "OLDCO renamed NEWCO, then delisted. Cash in lieu.", kind: "corporate", actorId: "usr_maya", key: "seed_delist",
    lines: [{ accountId: BROKER, amountMinor: 4_000 }, { accountId: SEC, amountMinor: -10_000 }, { accountId: HOUSE, amountMinor: 6_000 }],
    meta: { category: "Corporate action", merchant: "NEWCO" },
  });
  book(ledger, {
    at: "2026-09-15T15:00:00.000Z", memo: "SCHD cash dividend", kind: "dividend", actorId: "usr_maya", key: "seed_div_schd",
    lines: [{ accountId: BROKER, amountMinor: 4_800 }, { accountId: HOUSE, amountMinor: -4_800 }],
    meta: { category: "Dividend", merchant: "SCHD" },
  });

  const roll = rng(20251107);
  const merchants = [
    ["WHOLEFDS MKT #10221", "Groceries", 6400, 14200],
    ["BLUE BOTTLE COFFEE", "Dining", 480, 980],
    ["AMZN MKTP US*2K91", "Shopping", 1600, 9400],
    ["CAFÉ UMBRIA — late", "Dining", 2200, 5100],
    ["MTA*NYCT PAYGO", "Transport", 290, 290],
    ["EQUINOX 12TH", "Health", 24000, 24000],
  ] as const;
  for (let month = 0; month < 18; month += 1) {
    const at = new Date(Date.UTC(2025, 4 + month, 14, 15, 0, 0)).toISOString();
    book(ledger, {
      at, memo: `ACME PAYROLL · PP${month + 1}`, kind: "paycheck", actorId: "usr_maya", key: `seed_maya_pay_${month}`,
      lines: [
        { accountId: CHECKING, amountMinor: 682_000 },
        { accountId: HYSA, amountMinor: 372_000 },
        { accountId: BROKER, amountMinor: 186_000 },
        { accountId: HOUSE, amountMinor: -1_240_000 },
      ],
      meta: { category: "Income", merchant: "ACME PAYROLL" },
    });
    book(ledger, {
      at, memo: "RENT · 14 MERIDIAN", kind: "bill", actorId: "usr_maya", key: `seed_maya_rent_${month}`,
      lines: [{ accountId: CHECKING, amountMinor: -320_000 }, { accountId: HOUSE, amountMinor: 320_000 }],
      meta: { category: "Housing", merchant: "14 MERIDIAN" },
    });
    book(ledger, {
      at, memo: "MORTGAGE · DEMO SERVICER", kind: "bill", actorId: "usr_maya", key: `seed_maya_mort_${month}`,
      lines: [
        { accountId: CHECKING, amountMinor: -280_000 },
        { accountId: MORT, amountMinor: 90_000 },
        { accountId: ESCROW, amountMinor: 40_000 },
        { accountId: HOUSE, amountMinor: 150_000 },
      ],
      meta: { category: "Housing", merchant: "DEMO SERVICER" },
    });
    let cardSpend = 0;
    merchants.forEach((merchant, index) => {
      if (roll() > 0.82 && index !== 0) return;
      const amount = Math.round(merchant[2] + (merchant[3] - merchant[2]) * roll());
      cardSpend += amount;
      book(ledger, {
        at: new Date(Date.UTC(2025, 4 + month, 3 + index, 16, 0, 0)).toISOString(),
        memo: merchant[0], kind: "card", actorId: "usr_maya", key: `seed_maya_card_${month}_${index}`,
        lines: [{ accountId: CARD, amountMinor: -amount }, { accountId: HOUSE, amountMinor: amount }],
        meta: { category: merchant[1], merchant: merchant[0] },
      });
    });
    book(ledger, {
      at: new Date(Date.UTC(2025, 4 + month, 28, 15, 0, 0)).toISOString(),
      memo: "Card payment — thank you", kind: "payment", actorId: "usr_maya", key: `seed_maya_cardpay_${month}`,
      lines: [{ accountId: CHECKING, amountMinor: -cardSpend }, { accountId: CARD, amountMinor: cardSpend }],
      meta: { category: "Payment", merchant: "Halcyon Card" },
    });
  }
  book(ledger, {
    at: "2026-10-02T15:00:00.000Z", memo: "VENMO *J.PARK dinner split", kind: "card", actorId: "usr_maya", key: "seed_maya_venmo",
    lines: [{ accountId: CARD, amountMinor: -8_640 }, { accountId: HOUSE, amountMinor: 8_640 }],
    meta: { category: "Dining", merchant: "VENMO *J.PARK" },
  });
  book(ledger, {
    at: "2026-09-20T15:00:00.000Z", memo: "Household groceries", kind: "bill", actorId: "usr_elena", key: "seed_elena_joint",
    lines: [{ accountId: JOINT, amountMinor: -12_400 }, { accountId: HOUSE, amountMinor: 12_400 }],
    meta: { category: "Groceries", merchant: "HOUSEHOLD" },
  });

  await persist(db, ledger.all());
  const pan = demoPan(CHECKING);
  await db.run(`insert into cards (id, account_id, owner_id, last4, status, frozen, limits) values ('card_maya',$1,'usr_maya',$2,'open',false,'{"inPerson":200000,"online":150000,"atm":80000,"international":0}'::jsonb)`, [CHECKING, pan.slice(-4)]);
  const payees = [
    ["pay_rent", "14 Meridian", "Landlord", null, "Housing", 320000, 320000],
    ["pay_water", "City water", "Water", null, "Bills", 7200, 7400],
    ["pay_power", "Northline Power", "Power", null, "Bills", 11000, 10800],
    ["pay_elena", "Elena Marlowe", "Elena", "elena.m", "People", 0, 0],
  ];
  for (const payee of payees) {
    await db.run(`insert into payees (id, owner_id, name, nickname, handle, category, last_paid_minor, average_minor) values ($1,'usr_maya',$2,$3,$4,$5,$6,$7)`, payee);
  }
  const due = new Date(Date.now() + 5 * 86_400_000).toISOString();
  await db.run(
    `insert into payments (id, actor_id, from_account_id, amount_minor, currency, kind, status, memo, idempotency_key, timeline, fee_minor, scheduled_for, created_at)
     values ('pay_water_due','usr_maya',$1,7400,'USD','bill','scheduled','City water', 'seed_bill_water', $2::jsonb, 0, $3, now())`,
    [CHECKING, JSON.stringify([{ at: new Date().toISOString(), state: "Scheduled", note: "e-bill amount on file" }]), due],
  );
  await db.run(`insert into inbox (id, user_id, kind, title, body, href, read, created_at) values
    ('in_stmt','usr_maya','statement','October statement is ready','The specimen PDF is in Documents.','/banking/statements',false, now()),
    ('in_alert','usr_maya','price','AAPL crossed the replay band','This alert was generated from the session-replay tape, not a live print.','/markets/AAPL',false, now())`);
  await db.run(`insert into budgets (id, user_id, category, limit_minor) values ('b1','usr_maya','Groceries',90000), ('b2','usr_maya','Dining',45000), ('b3','usr_maya','Housing',600000)`);
  await db.run(`insert into goals (id, user_id, name, target_minor, saved_minor) values ('g1','usr_maya','Winter travel',400000,125000), ('g2','usr_maya','CD ladder','2500000',2500000)`);
  await db.run(`insert into goals (id, user_id, name, target_minor, saved_minor) values ('g2b','usr_maya','Cash reserve',10000000,3000000)`);
  await db.run(`insert into beneficiaries (id, user_id, account_id, name, relation, share_pct) values ('ben1','usr_maya',$1,'Jonah Chen','POD label',100)`, [CHECKING]);
  await db.run(`insert into watch_items (user_id, symbol) values ('usr_maya','AAPL'),('usr_maya','SPY'),('usr_maya','BTC'),('usr_maya','TLT')`);
  await db.run(`insert into option_papers (id, user_id, underlying, contract_type, strike, expiry, premium, contracts, iv, status) values ('opt1','usr_maya','AAPL','call',230,'2026-12-18',8.4,1,0.28,'open')`);
  await db.run(`insert into flags (key, enabled) values ('options', true), ('perps', true), ('household', true) on conflict (key) do nothing`);
  await db.run(`insert into disputes (id, user_id, account_id, status, reason, timeline, created_at) values ('case_demo','usr_maya',$1,'open','Duplicate café charge on the October tape',$2::jsonb, now())`, [
    CARD,
    JSON.stringify([
      { at: "2026-10-30T15:00:00.000Z", state: "Opened", note: "You described a duplicate café charge." },
      { at: "2026-11-02T15:00:00.000Z", state: "Provisional credit", note: "A simulated provisional credit can be posted from this case. No card network is involved." },
    ]),
  ]);
}

export async function wipePersona(db: Database, persona: "maya" | "andre" | "elena"): Promise<void> {
  const userId = persona === "maya" ? "usr_maya" : persona === "andre" ? "usr_andre" : "usr_elena";
  await db.run(`delete from journal_lines where entry_id in (select id from journal_entries where actor_id = $1 or idempotency_key like $2)`, [userId, `seed_${persona}%`]);
  await db.run(`delete from journal_entries where actor_id = $1 or idempotency_key like $2`, [userId, `seed_${persona}%`]);
  await db.run(`delete from orders where user_id = $1`, [userId]);
  await db.run(`delete from lots where account_id in (select id from accounts where owner_id = $1)`, [userId]);
  await db.run(`delete from payments where actor_id = $1`, [userId]);
  await db.run(`delete from holds where account_id in (select id from accounts where owner_id = $1)`, [userId]);
  await db.run(`delete from inbox where user_id = $1`, [userId]);
  await db.run(`delete from payees where owner_id = $1`, [userId]);
  await db.run(`delete from cards where owner_id = $1`, [userId]);
  await db.run(`delete from budgets where user_id = $1`, [userId]);
  await db.run(`delete from goals where user_id = $1`, [userId]);
  await db.run(`delete from beneficiaries where user_id = $1`, [userId]);
  await db.run(`delete from watch_items where user_id = $1`, [userId]);
  await db.run(`delete from option_papers where user_id = $1`, [userId]);
  await db.run(`delete from earns where user_id = $1`, [userId]);
  await db.run(`delete from disputes where user_id = $1`, [userId]);
  if (persona === "andre") {
    await db.run(`delete from accounts where owner_id = 'usr_andre'`);
    await db.run(`update users set intro_seen = false, kyc_status = 'unverified', terms_version = null where id = 'usr_andre'`);
  }
}
