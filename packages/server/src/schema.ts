import { boolean, integer, jsonb, pgTable, real, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull(),
  persona: text("persona").notNull(),
  householdId: text("household_id"),
  handle: text("handle"),
  theme: text("theme").notNull().default("system"),
  density: text("density").notNull().default("comfortable"),
  displayCurrency: text("display_currency").notNull().default("USD"),
  introSeen: boolean("intro_seen").notNull().default(false),
  termsVersion: text("terms_version"),
  termsAcceptedAt: timestamp("terms_accepted_at", { withTimezone: true }),
  kycStatus: text("kyc_status").notNull().default("unverified"),
  replayEnabled: boolean("replay_enabled").notNull().default(true),
  totpSecret: text("totp_secret"),
  totpEnabled: boolean("totp_enabled").notNull().default(false),
});

export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id").notNull(),
  householdId: text("household_id"),
  visibility: text("visibility").notNull(),
  kind: text("kind").notNull(),
  type: text("type").notNull(),
  name: text("name").notNull(),
  currency: text("currency").notNull(),
  apyBps: integer("apy_bps"),
  aprBps: integer("apr_bps"),
  creditLimitMinor: integer("credit_limit_minor"),
  overdraftEnabled: boolean("overdraft_enabled").notNull().default(false),
  overdraftLinkId: text("overdraft_link_id"),
  status: text("status").notNull(),
});

export const journalEntries = pgTable(
  "journal_entries",
  {
    id: text("id").primaryKey(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    idempotencyKey: text("idempotency_key"),
    kind: text("kind").notNull(),
    memo: text("memo").notNull(),
    actorId: text("actor_id"),
    reversesId: text("reverses_id"),
    meta: jsonb("meta").$type<Record<string, unknown>>().notNull(),
  },
  (table) => [uniqueIndex("journal_entries_idem").on(table.idempotencyKey)],
);

export const journalLines = pgTable("journal_lines", {
  id: text("id").primaryKey(),
  entryId: text("entry_id").notNull(),
  accountId: text("account_id").notNull(),
  amountMinor: integer("amount_minor").notNull(),
  currency: text("currency").notNull(),
});

export const lots = pgTable("lots", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  symbol: text("symbol").notNull(),
  qty: real("qty").notNull(),
  costPerUnit: real("cost_per_unit").notNull(),
  openedAt: text("opened_at").notNull(),
});

export const orders = pgTable("orders", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  accountId: text("account_id").notNull(),
  symbol: text("symbol").notNull(),
  side: text("side").notNull(),
  orderType: text("order_type").notNull(),
  qty: real("qty").notNull(),
  filledQty: real("filled_qty").notNull(),
  limitPrice: real("limit_price"),
  stopPrice: real("stop_price"),
  tif: text("tif").notNull(),
  status: text("status").notNull(),
  assetClass: text("asset_class").notNull(),
  avgPrice: real("avg_price"),
  rejectReason: text("reject_reason"),
  idempotencyKey: text("idempotency_key"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});
