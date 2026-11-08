import { HalcyonError } from "./errors";

export type JournalLine = {
  accountId: string;
  amountMinor: number;
  currency: string;
};

export type JournalEntry = {
  id: string;
  at: string;
  kind: string;
  memo: string;
  idempotencyKey?: string;
  reversesId?: string;
  actorId?: string;
  lines: JournalLine[];
  meta?: Record<string, unknown>;
};

export type JournalDraft = {
  id?: string;
  at?: string;
  kind: string;
  memo: string;
  idempotencyKey?: string;
  reversesId?: string;
  actorId?: string;
  lines: JournalLine[];
  meta?: Record<string, unknown>;
};

function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

export class Ledger {
  private readonly entries: JournalEntry[] = [];
  private readonly byKey = new Map<string, JournalEntry>();

  constructor(existing: JournalEntry[] = []) {
    for (const entry of existing) this.remember(entry);
  }

  all(): JournalEntry[] {
    return [...this.entries];
  }

  get(id: string): JournalEntry | undefined {
    return this.entries.find((entry) => entry.id === id);
  }

  post(draft: JournalDraft): JournalEntry {
    if (draft.idempotencyKey) {
      const prior = this.byKey.get(draft.idempotencyKey);
      if (prior) return prior;
    }
    if (draft.lines.length < 2) {
      throw new HalcyonError("lines", "A journal entry needs at least two lines.");
    }
    const sums = new Map<string, number>();
    for (const line of draft.lines) {
      if (!Number.isInteger(line.amountMinor)) {
        throw new HalcyonError("amount", "Ledger amounts must be integer minor units.");
      }
      if (!line.accountId || !line.currency) {
        throw new HalcyonError("lines", "Each line needs an account and a currency.");
      }
      sums.set(line.currency, (sums.get(line.currency) ?? 0) + line.amountMinor);
    }
    for (const [currency, sum] of sums) {
      if (sum !== 0) {
        throw new HalcyonError("unbalanced", `This entry does not balance in ${currency}.`);
      }
    }
    const entry: JournalEntry = {
      id: draft.id ?? newId("je"),
      at: draft.at ?? new Date().toISOString(),
      kind: draft.kind,
      memo: draft.memo,
      idempotencyKey: draft.idempotencyKey,
      reversesId: draft.reversesId,
      actorId: draft.actorId,
      lines: draft.lines.map((line) => ({ ...line })),
      meta: draft.meta,
    };
    this.remember(entry);
    return entry;
  }

  reverse(id: string, memo: string, opts: { idempotencyKey?: string; at?: string; actorId?: string } = {}): JournalEntry {
    const original = this.get(id);
    if (!original) throw new HalcyonError("missing", "The entry to reverse is not on the ledger.");
    if (original.kind === "reversal") {
      throw new HalcyonError("reversal", "Reverse the original entry, not a reversal.");
    }
    return this.post({
      kind: "reversal",
      memo,
      at: opts.at,
      actorId: opts.actorId,
      idempotencyKey: opts.idempotencyKey,
      reversesId: original.id,
      lines: original.lines.map((line) => ({ ...line, amountMinor: -line.amountMinor })),
      meta: { reverses: original.id },
    });
  }

  balance(accountId: string, currency?: string): number {
    let total = 0;
    for (const entry of this.entries) {
      for (const line of entry.lines) {
        if (line.accountId === accountId && (!currency || line.currency === currency)) {
          total += line.amountMinor;
        }
      }
    }
    return total;
  }

  private remember(entry: JournalEntry): void {
    this.entries.push(entry);
    if (entry.idempotencyKey) this.byKey.set(entry.idempotencyKey, entry);
  }
}

export function planTransfer(input: {
  fromAccountId: string;
  toAccountId: string;
  amountMinor: number;
  currency: string;
  availableMinor: number;
  memo: string;
  idempotencyKey: string;
  actorId?: string;
  at?: string;
  overdraft?: { linkAccountId: string; linkAvailableMinor: number; feeMinor: number; houseFeeAccountId: string };
}): JournalDraft[] {
  if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0) {
    throw new HalcyonError("amount", "Enter an amount greater than zero.");
  }
  if (input.fromAccountId === input.toAccountId) {
    throw new HalcyonError("account", "Choose two different accounts.");
  }
  if (input.availableMinor >= input.amountMinor) {
    return [
      {
        kind: "transfer",
        memo: input.memo,
        idempotencyKey: input.idempotencyKey,
        actorId: input.actorId,
        at: input.at,
        lines: [
          { accountId: input.fromAccountId, amountMinor: -input.amountMinor, currency: input.currency },
          { accountId: input.toAccountId, amountMinor: input.amountMinor, currency: input.currency },
        ],
      },
    ];
  }
  const overdraft = input.overdraft;
  if (!overdraft) {
    throw new HalcyonError(
      "funds",
      "Insufficient funds. Overdraft is off, so the linked savings account was not used.",
    );
  }
  const fromSpend = Math.max(0, Math.min(input.availableMinor, input.amountMinor));
  const shortfall = input.amountMinor - fromSpend;
  const needed = shortfall + overdraft.feeMinor;
  if (overdraft.linkAvailableMinor < needed) {
    throw new HalcyonError(
      "funds",
      "Insufficient funds. The linked savings account cannot cover the shortfall and the overdraft fee.",
    );
  }
  return [
    {
      kind: "transfer",
      memo: input.memo,
      idempotencyKey: input.idempotencyKey,
      actorId: input.actorId,
      at: input.at,
      meta: { overdraftFeeMinor: overdraft.feeMinor, shortfallMinor: shortfall },
      lines: [
        { accountId: input.fromAccountId, amountMinor: -fromSpend, currency: input.currency },
        { accountId: overdraft.linkAccountId, amountMinor: -(shortfall + overdraft.feeMinor), currency: input.currency },
        { accountId: input.toAccountId, amountMinor: input.amountMinor, currency: input.currency },
        { accountId: overdraft.houseFeeAccountId, amountMinor: overdraft.feeMinor, currency: input.currency },
      ].filter((line) => line.amountMinor !== 0),
    },
  ];
}
