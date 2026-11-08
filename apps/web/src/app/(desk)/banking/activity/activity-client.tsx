"use client";

import { useEffect, useMemo, useState } from "react";
import { DeskEmpty } from "@/components/marks";

type Account = { id: string; displayName?: string; name: string; type: string };
type Item = { id: string; memo: string; at: string; amountMinor: number; account: string; category: string };

function money(minor: number) {
  const value = Math.abs(minor) / 100;
  const sign = minor < 0 ? "−" : minor > 0 ? "+" : "";
  return `${sign}$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function ActivityClient({
  initialAccountId,
  initialCategory,
}: {
  initialAccountId: string;
  initialCategory: string;
}) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [q, setQ] = useState("");
  const [accountId, setAccountId] = useState(initialAccountId);
  const [category, setCategory] = useState(initialCategory);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [message, setMessage] = useState("");
  const [disputeId, setDisputeId] = useState<string | null>(null);
  const [reason, setReason] = useState("I do not recognize this charge.");

  async function load(filters?: { q?: string; accountId?: string; category?: string; from?: string; to?: string }) {
    const query = new URLSearchParams();
    if (filters?.q) query.set("q", filters.q);
    if (filters?.accountId) query.set("accountId", filters.accountId);
    if (filters?.category) query.set("category", filters.category);
    if (filters?.from) query.set("from", filters.from);
    if (filters?.to) query.set("to", filters.to);
    const [bank, activity] = await Promise.all([
      fetch("/api/v1/banking", { headers: { "x-halcyon-request": "1" } }).then((response) => response.json()),
      fetch(`/api/v1/banking/activity?${query.toString()}`, { headers: { "x-halcyon-request": "1" } }).then((response) => response.json()),
    ]);
    setAccounts(bank.accounts ?? []);
    setItems(activity.activity ?? []);
  }

  useEffect(() => {
    void load({
      accountId: initialAccountId || undefined,
      category: initialCategory || undefined,
    });
  }, [initialAccountId, initialCategory]);

  const categories = useMemo(() => [...new Set(items.map((item) => item.category))].sort(), [items]);

  async function openDispute(entryId: string) {
    const response = await fetch("/api/v1/disputes", {
      method: "POST",
      headers: { "content-type": "application/json", "x-halcyon-request": "1" },
      body: JSON.stringify({ entryId, reason, confirmed: true }),
    });
    const body = await response.json();
    setMessage(body.message ?? body.error?.message ?? "");
    setDisputeId(null);
  }

  return (
    <>
      <p className="kicker">Activity</p>
      <h1 className="serif" style={{ fontSize: 52 }}>Search the ledger</h1>
      <p className="lede">Filter by account, category, or date. Opening a dispute creates a demo case timeline — not a network chargeback.</p>
      <form
        className="filter-bar"
        onSubmit={(event) => {
          event.preventDefault();
          void load({ q, accountId, category, from, to });
        }}
      >
        <label className="field">Search
          <input aria-label="Search activity" value={q} onChange={(event) => setQ(event.target.value)} placeholder="memo or merchant" />
        </label>
        <label className="field">Account
          <select aria-label="Filter by account" value={accountId} onChange={(event) => setAccountId(event.target.value)}>
            <option value="">All accounts</option>
            {accounts.map((account) => <option key={account.id} value={account.id}>{account.displayName ?? account.name}</option>)}
          </select>
        </label>
        <label className="field">Category
          <select aria-label="Filter by category" value={category} onChange={(event) => setCategory(event.target.value)}>
            <option value="">All categories</option>
            {categories.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label className="field">From
          <input aria-label="From date" type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
        </label>
        <label className="field">To
          <input aria-label="To date" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        </label>
        <button className="btn-solid" type="submit">Apply filters</button>
      </form>
      {items.length === 0 ? (
        <div className="empty-state">
          <DeskEmpty />
          <p>No matching activity. Broaden the filters or fund an account first.</p>
        </div>
      ) : items.map((item) => (
        <div className="row" key={item.id}>
          <span>
            {item.memo}
            <br />
            <span className="meta">{item.category} · {new Date(item.at).toLocaleString("en-US", { timeZone: "America/New_York" })}</span>
          </span>
          <span>
            <span className="num">{money(item.amountMinor)}</span>
            {item.amountMinor < 0 ? (
              <button className="btn-line" type="button" onClick={() => setDisputeId(item.id)}>Dispute</button>
            ) : null}
          </span>
        </div>
      ))}
      {disputeId ? (
        <div className="panel" role="group" aria-label="Confirm dispute">
          <label className="field">Reason
            <textarea aria-label="Dispute reason" value={reason} onChange={(event) => setReason(event.target.value)} rows={3} />
          </label>
          <button className="btn-solid" type="button" onClick={() => void openDispute(disputeId)}>Confirm open dispute</button>
          <button className="btn-line" type="button" onClick={() => setDisputeId(null)}>Cancel</button>
        </div>
      ) : null}
      {message ? <p role="status">{message}</p> : null}
    </>
  );
}
