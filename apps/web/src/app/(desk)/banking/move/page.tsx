"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { transferSchema } from "@halcyon/domain";

type Account = { id: string; name: string; type: string; balanceMinor: number };

export default function MovePage() {
  const router = useRouter();
  const openedAt = useRef(Date.now());
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [kind, setKind] = useState("internal");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("25.00");
  const [memo, setMemo] = useState("");
  const [handle, setHandle] = useState("elena.m");
  const [honeypot, setHoneypot] = useState("");
  const [review, setReview] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [risk, setRisk] = useState(false);

  useEffect(() => {
    openedAt.current = Date.now();
    void fetch("/api/v1/banking", { headers: { "x-halcyon-request": "1" } }).then((response) => response.json()).then((body) => {
      const list = (body.accounts ?? []).filter((account: Account) => account.type !== "home" && account.type !== "securities");
      setAccounts(list);
      setFrom(list[0]?.id ?? "");
      setTo(list[1]?.id ?? "");
    });
  }, []);

  function validate() {
    if (honeypot) {
      setError("Request blocked.");
      return null;
    }
    const parsed = transferSchema.safeParse({
      fromAccountId: from,
      toAccountId: kind === "person" || kind === "international" ? undefined : to,
      payeeHandle: kind === "person" ? handle : undefined,
      amount,
      kind,
      memo: memo || undefined,
      confirmed: true,
      idempotencyKey: crypto.randomUUID(),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the transfer fields.");
      return null;
    }
    const dollars = Number(amount);
    if (!Number.isFinite(dollars) || dollars <= 0) {
      setError("Enter an amount greater than zero.");
      return null;
    }
    setError("");
    return parsed.data;
  }

  function startReview(event?: { preventDefault?: () => void }) {
    event?.preventDefault?.();
    if (!validate()) return;
    setReview(true);
  }

  async function send() {
    const payload = validate();
    if (!payload) {
      setReview(false);
      return;
    }
    const response = await fetch("/api/v1/transfers", {
      method: "POST",
      headers: { "content-type": "application/json", "x-halcyon-request": "1" },
      body: JSON.stringify({ ...payload, openedAt: openedAt.current, company: honeypot }),
    });
    const body = await response.json();
    setMessage(body.message ?? body.error?.message ?? "Nothing posted.");
    setReview(false);
    router.refresh();
  }

  async function paycheck() {
    const response = await fetch("/api/v1/paycheck", { method: "POST", headers: { "content-type": "application/json", "x-halcyon-request": "1" }, body: "{}" });
    const body = await response.json();
    setMessage(body.message ?? body.error?.message);
    router.refresh();
  }

  async function funds() {
    const response = await fetch("/api/v1/funds", { method: "POST", headers: { "content-type": "application/json", "x-halcyon-request": "1" }, body: JSON.stringify({ acceptedRisk: risk }) });
    const body = await response.json();
    setMessage(body.message ?? body.error?.message);
    router.refresh();
  }

  return (
    <>
      <p className="kicker">Move money</p>
      <h1 className="serif" style={{ fontSize: 52 }}>Pay and transfer</h1>
      <p className="lede">Domestic only. International shows a quote and stops. Direct deposit numbers below are watermarked DEMO.</p>
      <div className="grid-2">
        <form onSubmit={startReview} noValidate>
          <label className="field">Kind
            <select aria-label="Payment kind" value={kind} onChange={(event) => setKind(event.target.value)}>
              <option value="internal">Internal transfer</option>
              <option value="ach">Bank transfer</option>
              <option value="wire">Wire</option>
              <option value="person">Pay a person</option>
              <option value="bill">Bill pay</option>
              <option value="international">International</option>
            </select>
          </label>
          <label className="field">From
            <select aria-label="From account" value={from} onChange={(event) => setFrom(event.target.value)} required>
              {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
            </select>
          </label>
          {kind === "person" ? (
            <label className="field">Halcyon handle
              <input aria-label="Payee handle" value={handle} onChange={(event) => setHandle(event.target.value)} required />
            </label>
          ) : kind !== "international" ? (
            <label className="field">To
              <select aria-label="To account" value={to} onChange={(event) => setTo(event.target.value)} required>
                {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
              </select>
            </label>
          ) : null}
          <label className="field">Amount
            <input aria-label="Amount in dollars" value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" required />
          </label>
          <label className="field">Memo
            <input aria-label="Memo" value={memo} onChange={(event) => setMemo(event.target.value)} maxLength={140} />
          </label>
          <label className="hp" aria-hidden="true">
            Company
            <input tabIndex={-1} autoComplete="off" value={honeypot} onChange={(event) => setHoneypot(event.target.value)} />
          </label>
          {error ? <p role="alert">{error}</p> : null}
          {review ? (
            <div className="panel">
              <p>Confirm {kind} of ${amount}. {kind === "wire" ? "A $15 fee is included in the quote." : kind === "ach" || kind === "bill" ? "It will pend until the next business morning." : kind === "international" ? "No payment will be created." : "It posts on the internal ledger."}</p>
              <button className="btn-solid" type="button" onClick={() => void send()}>Confirm {kind} of ${amount}</button>
              <button className="btn-line" type="button" onClick={() => setReview(false)}>Back</button>
            </div>
          ) : <button className="btn-solid" type="submit">Review</button>}
          {message ? <p role="status">{message}</p> : null}
        </form>
        <aside>
          <h2 className="serif">Direct deposit</h2>
          <p className="meta">Routing 021000021 · Account 999001184 · watermark DEMO. These numbers are not payable.</p>
          <button className="btn-line" type="button" onClick={() => void paycheck()}>Simulate paycheck</button>
          <div className="panel">
            <h2 className="serif">Andre’s funding</h2>
            <label><input type="checkbox" checked={risk} onChange={(event) => setRisk(event.target.checked)} /> I understand markets can lose money and this is not advice.</label>
            <button className="btn-solid" type="button" onClick={() => void funds()}>Add demo funds · $25,000</button>
          </div>
        </aside>
      </div>
    </>
  );
}
