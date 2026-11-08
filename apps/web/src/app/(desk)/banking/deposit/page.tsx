"use client";

import { useEffect, useState } from "react";
import { DeskEmpty } from "@/components/marks";

type Account = { id: string; displayName?: string; name: string; type: string };
type Deposit = { id: string; filename: string; amount_minor: number; status: string; available_at: string | null; created_at: string };

export default function DepositPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [accountId, setAccountId] = useState("");
  const [amount, setAmount] = useState("120.00");
  const [filename, setFilename] = useState("front-check.jpg");
  const [confirm, setConfirm] = useState(false);
  const [message, setMessage] = useState("");

  async function load() {
    const body = await fetch("/api/v1/banking", { headers: { "x-halcyon-request": "1" } }).then((response) => response.json());
    const cash = (body.accounts ?? []).filter((account: Account) => account.type === "checking" || account.type === "joint");
    setAccounts(cash);
    setDeposits(body.checkDeposits ?? []);
    setAccountId((current) => current || cash[0]?.id || "");
  }

  useEffect(() => { void load(); }, []);

  async function submit() {
    const response = await fetch("/api/v1/checks/deposit", {
      method: "POST",
      headers: { "content-type": "application/json", "x-halcyon-request": "1" },
      body: JSON.stringify({ accountId, amount, filename, confirmed: true }),
    });
    const body = await response.json();
    setMessage(body.message ?? body.error?.message ?? "");
    setConfirm(false);
    await load();
  }

  return (
    <>
      <p className="kicker">Mobile deposit</p>
      <h1 className="serif" style={{ fontSize: 52 }}>Check deposit</h1>
      <p className="lede">Simulated only. Choose a file name to stand in for a camera capture — the image never leaves this browser. Names containing “blur” are rejected on purpose.</p>
      <div className="grid-2">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setConfirm(true);
          }}
        >
          <label className="field">Account
            <select aria-label="Deposit account" value={accountId} onChange={(event) => setAccountId(event.target.value)}>
              {accounts.map((account) => <option key={account.id} value={account.id}>{account.displayName ?? account.name}</option>)}
            </select>
          </label>
          <label className="field">Amount
            <input aria-label="Check amount" value={amount} onChange={(event) => setAmount(event.target.value)} />
          </label>
          <label className="field">Image stub
            <input aria-label="Check image file name" value={filename} onChange={(event) => setFilename(event.target.value)} />
          </label>
          <label className="field">Camera stub
            <input aria-label="Upload stub" type="file" accept="image/*" onChange={(event) => setFilename(event.target.files?.[0]?.name ?? filename)} />
          </label>
          {confirm ? (
            <div className="panel" role="group" aria-label="Confirm check deposit">
              <p>Deposit ${amount} using stub “{filename}”? Funds post with a simulated hold message.</p>
              <button className="btn-solid" type="button" onClick={() => void submit()}>Confirm deposit ${amount}</button>
              <button className="btn-line" type="button" onClick={() => setConfirm(false)}>Cancel</button>
            </div>
          ) : (
            <button className="btn-solid" type="submit">Review deposit</button>
          )}
          {message ? <p role="status">{message}</p> : null}
        </form>
        <aside>
          <h2 className="serif">Recent deposits</h2>
          {deposits.length === 0 ? (
            <div className="empty-state"><DeskEmpty /><p>No mobile deposits yet.</p></div>
          ) : deposits.map((deposit) => (
            <div className="row" key={deposit.id}>
              <span>
                {deposit.filename}
                <br />
                <span className="meta">{deposit.status}{deposit.available_at ? ` · avail ${new Date(deposit.available_at).toLocaleDateString("en-US", { timeZone: "America/New_York" })}` : ""}</span>
              </span>
              <span className="num">${(Number(deposit.amount_minor) / 100).toFixed(2)}</span>
            </div>
          ))}
        </aside>
      </div>
    </>
  );
}
