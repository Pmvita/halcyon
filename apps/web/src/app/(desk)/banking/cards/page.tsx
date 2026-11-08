"use client";

import { useEffect, useState } from "react";

export default function CardsPage() {
  const [cards, setCards] = useState<{ id: string; last4: string; frozen: boolean }[]>([]);
  const [holds, setHolds] = useState<{ id: string; merchant: string; amount_minor: number; status: string }[]>([]);
  const [pan, setPan] = useState("");
  const [message, setMessage] = useState("");
  const [merchant, setMerchant] = useState("CAFÉ UMBRIA");
  const [amount, setAmount] = useState("18.40");
  const [city, setCity] = useState("New York");
  const [password, setPassword] = useState("");
  async function load() {
    const response = await fetch("/api/v1/banking", { headers: { "x-halcyon-request": "1" } });
    const body = await response.json();
    setCards(body.cards ?? []);
    setHolds((body.holds ?? []).filter((hold: { status: string }) => hold.status === "pending"));
  }
  useEffect(() => { void load(); }, []);
  async function call(href: string, body: Record<string, unknown>) {
    const response = await fetch(href, { method: "POST", headers: { "content-type": "application/json", "x-halcyon-request": "1" }, body: JSON.stringify(body) });
    const payload = await response.json();
    setMessage(payload.message ?? payload.error?.message ?? payload.note ?? "");
    if (payload.pan) setPan(payload.pan);
    await load();
  }
  const card = cards[0];
  return (
    <>
      <p className="kicker">Cards</p>
      <h1 className="serif" style={{ fontSize: 52 }}>Virtual debit</h1>
      <p className="lede">Numbers begin with 9999, pass the Luhn check, and are not a real BIN. Reveal needs your password again.</p>
      {card ? <p className="num">···· ···· ···· {card.last4} · {card.frozen ? "Frozen" : "Open"}</p> : <p>No card on this profile yet.</p>}
      {pan ? <p className="num">{pan}</p> : null}
      <label className="field">Password for step-up
        <input type="password" aria-label="Password to reveal card" value={password} onChange={(event) => setPassword(event.target.value)} />
      </label>
      <button className="btn-line" type="button" onClick={() => void call("/api/v1/stepup", { password }).then(() => card && call("/api/v1/cards/reveal", { cardId: card.id }))}>Show number</button>
      {card ? <button className="btn-line" type="button" onClick={() => void call("/api/v1/cards/freeze", { cardId: card.id, frozen: !card.frozen })}>{card.frozen ? "Unfreeze" : "Freeze"}</button> : null}
      <div className="panel">
        <h2 className="serif">Spend simulator</h2>
        <label className="field">Merchant<input aria-label="Merchant" value={merchant} onChange={(event) => setMerchant(event.target.value)} /></label>
        <label className="field">Amount<input aria-label="Spend amount" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
        <label className="field">City<input aria-label="City" value={city} onChange={(event) => setCity(event.target.value)} /></label>
        <button className="btn-solid" type="button" onClick={() => void call("/api/v1/cards/spend", { merchant, amount, city, category: "Dining" })}>Authorize {merchant} for ${amount}</button>
      </div>
      {holds.map((hold) => (
        <div className="row" key={hold.id}>
          <span>{hold.merchant}</span>
          <button className="btn-line" type="button" onClick={() => void call("/api/v1/cards/settle", { holdId: hold.id, action: "settle" })}>Settle</button>
        </div>
      ))}
      {message ? <p role="status">{message}</p> : null}
      <p className="meta">ATM locator: sample locations only. Grand Central, Union Square, and a Hudson Yards lobby are illustrative pins, not a live network.</p>
    </>
  );
}
