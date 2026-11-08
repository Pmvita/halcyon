"use client";

import { useEffect, useState } from "react";
import { DeskEmpty } from "@/components/marks";

type Goal = { id: string; name: string; target_minor: number; saved_minor: number };
type Budget = { id: string; category: string; limit_minor: number };
type Spend = { category: string; amountMinor: number };
type Account = { id: string; displayName?: string; name: string; type: string };

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [spend, setSpend] = useState<Spend[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [goalId, setGoalId] = useState("");
  const [fromAccountId, setFromAccountId] = useState("");
  const [amount, setAmount] = useState("50.00");
  const [confirm, setConfirm] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    const body = await fetch("/api/v1/banking", { headers: { "x-halcyon-request": "1" } }).then((response) => response.json());
    setGoals(body.goals ?? []);
    setBudgets(body.budgets ?? []);
    setSpend(body.spend ?? []);
    const cash = (body.accounts ?? []).filter((account: Account) => ["checking", "hysa", "joint"].includes(account.type));
    setAccounts(cash);
    setGoalId((current) => current || body.goals?.[0]?.id || "");
    setFromAccountId((current) => current || cash[0]?.id || "");
  }

  useEffect(() => { void load(); }, []);

  async function fund() {
    const response = await fetch("/api/v1/goals/fund", {
      method: "POST",
      headers: { "content-type": "application/json", "x-halcyon-request": "1" },
      body: JSON.stringify({ goalId, fromAccountId, amount, confirmed: true, idempotencyKey: crypto.randomUUID() }),
    });
    const body = await response.json();
    setMessage(body.message ?? body.error?.message ?? "");
    setConfirm(false);
    await load();
  }

  return (
    <>
      <p className="kicker">Goals &amp; budgets</p>
      <h1 className="serif" style={{ fontSize: 52 }}>Envelopes</h1>
      <p className="lede">Fund a savings goal from checking or HYSA. Budgets show the last 30 days of categorized spend against Maya’s seeded envelopes.</p>
      <div className="grid-2">
        <section>
          <h2 className="serif">Savings goals</h2>
          {goals.length === 0 ? (
            <div className="empty-state"><DeskEmpty /><p>No goals on this persona yet.</p></div>
          ) : goals.map((goal) => {
            const pct = Math.min(100, Math.round((Number(goal.saved_minor) / Math.max(1, Number(goal.target_minor))) * 100));
            return (
              <article key={goal.id} className="panel">
                <div className="row">
                  <span>{goal.name}</span>
                  <span className="num">${(Number(goal.saved_minor) / 100).toFixed(2)} / ${(Number(goal.target_minor) / 100).toFixed(2)}</span>
                </div>
                <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${goal.name} ${pct} percent funded`}>
                  <span style={{ width: `${pct}%` }} />
                </div>
                <p className="meta">{pct}% funded</p>
              </article>
            );
          })}
          <div className="panel">
            <h2 className="serif">Fund a goal</h2>
            <label className="field">Goal
              <select aria-label="Goal to fund" value={goalId} onChange={(event) => setGoalId(event.target.value)}>
                {goals.map((goal) => <option key={goal.id} value={goal.id}>{goal.name}</option>)}
              </select>
            </label>
            <label className="field">From
              <select aria-label="Fund from account" value={fromAccountId} onChange={(event) => setFromAccountId(event.target.value)}>
                {accounts.map((account) => <option key={account.id} value={account.id}>{account.displayName ?? account.name}</option>)}
              </select>
            </label>
            <label className="field">Amount
              <input aria-label="Goal funding amount" value={amount} onChange={(event) => setAmount(event.target.value)} />
            </label>
            {confirm ? (
              <div role="group" aria-label="Confirm goal funding">
                <p>Move ${amount} toward the selected goal?</p>
                <button className="btn-solid" type="button" onClick={() => void fund()}>Confirm fund goal ${amount}</button>
                <button className="btn-line" type="button" onClick={() => setConfirm(false)}>Cancel</button>
              </div>
            ) : (
              <button className="btn-solid" type="button" onClick={() => setConfirm(true)}>Review funding</button>
            )}
            {message ? <p role="status">{message}</p> : null}
          </div>
        </section>
        <aside>
          <h2 className="serif">Budgets</h2>
          {budgets.length === 0 ? <p className="meta">No budgets seeded for this persona.</p> : budgets.map((budget) => {
            const used = spend.find((item) => item.category === budget.category)?.amountMinor ?? 0;
            const pct = Math.min(100, Math.round((used / Math.max(1, Number(budget.limit_minor))) * 100));
            return (
              <article key={budget.id} className="panel">
                <div className="row">
                  <span>{budget.category}</span>
                  <span className="num">${(used / 100).toFixed(2)} of ${(Number(budget.limit_minor) / 100).toFixed(2)}</span>
                </div>
                <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${budget.category} budget ${pct} percent used`}>
                  <span style={{ width: `${pct}%` }} />
                </div>
              </article>
            );
          })}
        </aside>
      </div>
    </>
  );
}
