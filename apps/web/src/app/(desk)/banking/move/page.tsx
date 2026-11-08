"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { transferSchema } from "@halcyon/domain";

type Account = { id: string; name: string; displayName?: string; type: string; balanceMinor: number; availableMinor?: number };
type Payee = { id: string; name: string; nickname: string | null; handle: string | null; category: string | null };
type Payment = { id: string; memo: string; amount_minor: number; status: string; kind: string; scheduled_for: string | null };
type Recurring = { id: string; memo: string | null; amount_minor: number; cadence: string; next_run: string; kind: string };

export default function MovePage() {
  const router = useRouter();
  const openedAt = useRef(Date.now());
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [payees, setPayees] = useState<Payee[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [recurring, setRecurring] = useState<Recurring[]>([]);
  const [kind, setKind] = useState("internal");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [payeeId, setPayeeId] = useState("");
  const [amount, setAmount] = useState("25.00");
  const [memo, setMemo] = useState("");
  const [handle, setHandle] = useState("elena.m");
  const [scheduledFor, setScheduledFor] = useState("");
  const [recurringCadence, setRecurringCadence] = useState("");
  const [honeypot, setHoneypot] = useState("");
  const [review, setReview] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [risk, setRisk] = useState(false);
  const [password, setPassword] = useState("");
  const [employer, setEmployer] = useState("ACME PAYROLL");
  const [checkingPct, setCheckingPct] = useState(55);
  const [hysaPct, setHysaPct] = useState(30);
  const [brokerPct, setBrokerPct] = useState(15);
  const needsStepUp = Number(amount) >= 5000;

  async function load() {
    const response = await fetch("/api/v1/banking", { headers: { "x-halcyon-request": "1" } });
    const body = await response.json();
    const list = (body.accounts ?? []).filter((account: Account) => !["home", "securities", "crypto_inventory"].includes(account.type));
    setAccounts(list);
    setPayees(body.payees ?? []);
    setPayments(body.payments ?? []);
    setRecurring(body.recurring ?? []);
    setFrom((current) => current || list[0]?.id || "");
    setTo((current) => current || list[1]?.id || "");
  }

  useEffect(() => {
    openedAt.current = Date.now();
    void load();
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
      payeeId: payeeId || undefined,
      amount,
      kind,
      memo: memo || undefined,
      confirmed: true,
      idempotencyKey: crypto.randomUUID(),
      scheduledFor: scheduledFor || undefined,
      recurring: recurringCadence === "weekly" || recurringCadence === "biweekly" || recurringCadence === "monthly"
        ? recurringCadence
        : undefined,
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
    if (needsStepUp) {
      const step = await fetch("/api/v1/stepup", {
        method: "POST",
        headers: { "content-type": "application/json", "x-halcyon-request": "1" },
        body: JSON.stringify({ password }),
      });
      const stepBody = await step.json();
      if (!step.ok) {
        setError(stepBody.error?.message ?? "Step-up failed.");
        setReview(false);
        return;
      }
    }
    const response = await fetch("/api/v1/transfers", {
      method: "POST",
      headers: { "content-type": "application/json", "x-halcyon-request": "1" },
      body: JSON.stringify({ ...payload, openedAt: openedAt.current, company: honeypot }),
    });
    const body = await response.json();
    setMessage(body.message ?? body.error?.message ?? "Nothing posted.");
    setReview(false);
    await load();
    router.refresh();
  }

  async function paycheck() {
    const response = await fetch("/api/v1/paycheck", {
      method: "POST",
      headers: { "content-type": "application/json", "x-halcyon-request": "1" },
      body: JSON.stringify({ employer, checkingPct, hysaPct, brokerPct }),
    });
    const body = await response.json();
    setMessage(body.message ?? body.error?.message);
    await load();
    router.refresh();
  }

  async function funds() {
    const response = await fetch("/api/v1/funds", {
      method: "POST",
      headers: { "content-type": "application/json", "x-halcyon-request": "1" },
      body: JSON.stringify({ acceptedRisk: risk }),
    });
    const body = await response.json();
    setMessage(body.message ?? body.error?.message);
    await load();
    router.refresh();
  }

  async function stopPayment(paymentId: string) {
    const response = await fetch("/api/v1/payments/stop", {
      method: "POST",
      headers: { "content-type": "application/json", "x-halcyon-request": "1" },
      body: JSON.stringify({ paymentId }),
    });
    const body = await response.json();
    setMessage(body.message ?? body.error?.message);
    await load();
  }

  async function stopRecurring(recurringId: string) {
    const response = await fetch("/api/v1/recurring/stop", {
      method: "POST",
      headers: { "content-type": "application/json", "x-halcyon-request": "1" },
      body: JSON.stringify({ recurringId }),
    });
    const body = await response.json();
    setMessage(body.message ?? body.error?.message);
    await load();
  }

  const wireFee = kind === "wire" ? "$15.00" : null;

  return (
    <>
      <p className="kicker">Move money</p>
      <h1 className="serif" style={{ fontSize: 52 }}>Pay and transfer</h1>
      <p className="lede">Domestic corridors only. Wires quote a $15 fee before confirm. International shows a corridor message and stops. Direct-deposit numbers are watermarked DEMO.</p>
      <div className="grid-2">
        <form onSubmit={startReview} noValidate>
          <label className="field">Kind
            <select aria-label="Payment kind" value={kind} onChange={(event) => setKind(event.target.value)}>
              <option value="internal">Internal transfer</option>
              <option value="ach">Bank transfer (ACH)</option>
              <option value="wire">Domestic wire</option>
              <option value="person">Pay a person</option>
              <option value="bill">Bill pay</option>
              <option value="international">International</option>
            </select>
          </label>
          <label className="field">From
            <select aria-label="From account" value={from} onChange={(event) => setFrom(event.target.value)} required>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.displayName ?? account.name}
                </option>
              ))}
            </select>
          </label>
          {kind === "person" ? (
            <label className="field">Halcyon handle
              <input aria-label="Payee handle" value={handle} onChange={(event) => setHandle(event.target.value)} required />
            </label>
          ) : kind !== "international" ? (
            <label className="field">To
              <select aria-label="To account" value={to} onChange={(event) => setTo(event.target.value)} required>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>{account.displayName ?? account.name}</option>
                ))}
              </select>
            </label>
          ) : null}
          {(kind === "bill" || kind === "person") && payees.length ? (
            <label className="field">Payee directory
              <select
                aria-label="Payee directory"
                value={payeeId}
                onChange={(event) => {
                  const next = event.target.value;
                  setPayeeId(next);
                  const payee = payees.find((item) => item.id === next);
                  if (payee?.handle) setHandle(payee.handle);
                  if (payee) setMemo(payee.nickname || payee.name);
                }}
              >
                <option value="">Select a saved payee</option>
                {payees.map((payee) => (
                  <option key={payee.id} value={payee.id}>{payee.nickname || payee.name} · {payee.category}</option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="field">Amount
            <input aria-label="Amount in dollars" value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" required />
          </label>
          {wireFee ? <p className="meta" role="note">Wire quote includes a {wireFee} domestic fee before send. No real Fedwire leaves the demo.</p> : null}
          {kind === "international" ? <p className="meta" role="note">International corridor is closed in this demo. Review will show a quote and create nothing.</p> : null}
          <label className="field">Memo
            <input aria-label="Memo" value={memo} onChange={(event) => setMemo(event.target.value)} maxLength={140} />
          </label>
          <label className="field">Schedule (optional)
            <input aria-label="Scheduled date" type="date" value={scheduledFor} onChange={(event) => setScheduledFor(event.target.value)} />
          </label>
          <label className="field">Recurring (optional)
            <select aria-label="Recurring cadence" value={recurringCadence} onChange={(event) => setRecurringCadence(event.target.value)}>
              <option value="">One-time</option>
              <option value="weekly">Weekly</option>
              <option value="biweekly">Every two weeks</option>
              <option value="monthly">Monthly</option>
            </select>
          </label>
          {needsStepUp ? (
            <label className="field">Password for step-up (≥ $5,000)
              <input type="password" aria-label="Password for large payment step-up" value={password} onChange={(event) => setPassword(event.target.value)} />
            </label>
          ) : null}
          <label className="hp" aria-hidden="true">
            Company
            <input tabIndex={-1} autoComplete="off" value={honeypot} onChange={(event) => setHoneypot(event.target.value)} />
          </label>
          {error ? <p role="alert">{error}</p> : null}
          {review ? (
            <div className="panel" role="group" aria-label="Confirm transfer">
              <p>
                Confirm {kind} of ${amount}
                {wireFee ? ` plus ${wireFee} fee` : ""}.
                {kind === "ach" || kind === "bill" ? " It will pend until the next business morning." : ""}
                {kind === "international" ? " No payment will be created." : ""}
                {recurringCadence ? ` Recurring ${recurringCadence}.` : ""}
                {scheduledFor ? ` Scheduled for ${scheduledFor}.` : ""}
              </p>
              <button className="btn-solid" type="button" onClick={() => void send()}>Confirm {kind} of ${amount}</button>
              <button className="btn-line" type="button" onClick={() => setReview(false)}>Back</button>
            </div>
          ) : <button className="btn-solid" type="submit">Review</button>}
          {message ? <p role="status">{message}</p> : null}
        </form>
        <aside>
          <h2 className="serif">Direct deposit / paycheck</h2>
          <p className="meta">Routing 021000021 · Account 999001184 · watermark DEMO. These numbers are not payable.</p>
          <label className="field">Employer memo
            <input aria-label="Employer memo" value={employer} onChange={(event) => setEmployer(event.target.value)} />
          </label>
          <label className="field">Checking %
            <input aria-label="Checking percent" type="number" min={0} max={100} value={checkingPct} onChange={(event) => setCheckingPct(Number(event.target.value))} />
          </label>
          <label className="field">HYSA %
            <input aria-label="Savings percent" type="number" min={0} max={100} value={hysaPct} onChange={(event) => setHysaPct(Number(event.target.value))} />
          </label>
          <label className="field">Brokerage %
            <input aria-label="Brokerage percent" type="number" min={0} max={100} value={brokerPct} onChange={(event) => setBrokerPct(Number(event.target.value))} />
          </label>
          <button className="btn-line" type="button" onClick={() => void paycheck()}>Simulate paycheck</button>
          <div className="panel">
            <h2 className="serif">Andre’s funding</h2>
            <label>
              <input type="checkbox" checked={risk} onChange={(event) => setRisk(event.target.checked)} />
              {" "}I understand markets can lose money and this is not advice.
            </label>
            <button className="btn-solid" type="button" onClick={() => void funds()}>Add demo funds · $25,000</button>
          </div>
          <div className="panel">
            <h2 className="serif">Bill calendar</h2>
            {payments.length === 0 ? <p className="meta">No scheduled payments.</p> : payments.slice(0, 8).map((payment) => (
              <div className="row" key={payment.id}>
                <span>
                  {payment.memo}
                  <br />
                  <span className="meta">{payment.status} · {payment.kind}{payment.scheduled_for ? ` · ${new Date(payment.scheduled_for).toLocaleDateString("en-US", { timeZone: "America/New_York" })}` : ""}</span>
                </span>
                <span>
                  <span className="num">${(Number(payment.amount_minor) / 100).toFixed(2)}</span>
                  {payment.status === "pending" || payment.status === "scheduled" ? (
                    <button className="btn-line" type="button" onClick={() => void stopPayment(payment.id)}>Stop</button>
                  ) : null}
                </span>
              </div>
            ))}
          </div>
          <div className="panel">
            <h2 className="serif">Recurring</h2>
            {recurring.length === 0 ? <p className="meta">No active recurring transfers.</p> : recurring.map((item) => (
              <div className="row" key={item.id}>
                <span>
                  {item.memo || item.kind}
                  <br />
                  <span className="meta">{item.cadence} · next {new Date(item.next_run).toLocaleDateString("en-US", { timeZone: "America/New_York" })}</span>
                </span>
                <button className="btn-line" type="button" onClick={() => void stopRecurring(item.id)}>Stop recurring</button>
              </div>
            ))}
          </div>
          <p className="meta"><Link href="/banking/alerts">Manage payment alerts</Link></p>
        </aside>
      </div>
    </>
  );
}
