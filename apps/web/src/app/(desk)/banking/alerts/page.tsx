"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function AlertsPage() {
  const [lowBalance, setLowBalance] = useState(true);
  const [largePay, setLargePay] = useState(true);
  const [cardSpend, setCardSpend] = useState(true);
  const [threshold, setThreshold] = useState("500.00");
  const [message, setMessage] = useState("");
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    void fetch("/api/v1/banking", { headers: { "x-halcyon-request": "1" } })
      .then((response) => response.json())
      .then((body) => {
        const prefs = body.alertPrefs;
        if (!prefs) return;
        setLowBalance(Boolean(prefs.lowBalance));
        setLargePay(Boolean(prefs.largePay));
        setCardSpend(Boolean(prefs.cardSpend));
        setThreshold(((Number(prefs.lowBalanceMinor) || 50_000) / 100).toFixed(2));
      });
  }, []);

  async function save() {
    const response = await fetch("/api/v1/banking/alerts", {
      method: "POST",
      headers: { "content-type": "application/json", "x-halcyon-request": "1" },
      body: JSON.stringify({
        lowBalance,
        largePay,
        cardSpend,
        lowBalanceMinor: Math.round(Number(threshold) * 100),
      }),
    });
    const body = await response.json();
    setMessage(body.message ?? body.error?.message ?? "");
    setConfirm(false);
  }

  return (
    <>
      <p className="kicker">Alerts</p>
      <h1 className="serif" style={{ fontSize: 52 }}>Banking notices</h1>
      <p className="lede">Low-balance, large-payment, and card-spend alerts land in <Link href="/inbox">Inbox</Link>. They are demo notifications only.</p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setConfirm(true);
        }}
      >
        <label className="field">
          <input type="checkbox" checked={lowBalance} onChange={(event) => setLowBalance(event.target.checked)} />
          {" "}Low balance
        </label>
        <label className="field">Threshold
          <input aria-label="Low balance threshold" value={threshold} onChange={(event) => setThreshold(event.target.value)} />
        </label>
        <label className="field">
          <input type="checkbox" checked={largePay} onChange={(event) => setLargePay(event.target.checked)} />
          {" "}Large payment (≥ $5,000)
        </label>
        <label className="field">
          <input type="checkbox" checked={cardSpend} onChange={(event) => setCardSpend(event.target.checked)} />
          {" "}Card spend settlements (≥ $100)
        </label>
        {confirm ? (
          <div className="panel" role="group" aria-label="Confirm alert preferences">
            <p>Save these banking alert preferences?</p>
            <button className="btn-solid" type="button" onClick={() => void save()}>Confirm save alerts</button>
            <button className="btn-line" type="button" onClick={() => setConfirm(false)}>Cancel</button>
          </div>
        ) : (
          <button className="btn-solid" type="submit">Review preferences</button>
        )}
      </form>
      {message ? <p role="status">{message}</p> : null}
    </>
  );
}
