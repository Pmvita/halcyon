"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DeskEmpty } from "@/components/marks";

type Card = { id: string; last4: string; frozen: boolean; status: string; limits?: Record<string, number> };
type Hold = { id: string; merchant: string; amount_minor: number; status: string; city?: string; category?: string };

export default function CardsPage() {
  const [cards, setCards] = useState<Card[]>([]);
  const [holds, setHolds] = useState<Hold[]>([]);
  const [cashbackMinor, setCashbackMinor] = useState(0);
  const [pan, setPan] = useState("");
  const [message, setMessage] = useState("");
  const [merchant, setMerchant] = useState("CAFÉ UMBRIA");
  const [amount, setAmount] = useState("18.40");
  const [city, setCity] = useState("New York");
  const [password, setPassword] = useState("");
  const [confirmFreeze, setConfirmFreeze] = useState(false);
  const [confirmReveal, setConfirmReveal] = useState(false);

  async function load() {
    const response = await fetch("/api/v1/banking", { headers: { "x-halcyon-request": "1" } });
    const body = await response.json();
    setCards(body.cards ?? []);
    setHolds((body.holds ?? []).filter((hold: { status: string }) => hold.status === "pending"));
    setCashbackMinor(Number(body.cashbackMinor ?? 0));
  }

  useEffect(() => { void load(); }, []);

  async function call(href: string, body: Record<string, unknown>) {
    const response = await fetch(href, {
      method: "POST",
      headers: { "content-type": "application/json", "x-halcyon-request": "1" },
      body: JSON.stringify(body),
    });
    const payload = await response.json();
    setMessage(payload.message ?? payload.error?.message ?? payload.note ?? "");
    if (payload.pan) setPan(payload.pan);
    await load();
    return payload;
  }

  const card = cards[0];

  return (
    <>
      <p className="kicker">Cards</p>
      <h1 className="serif" style={{ fontSize: 52 }}>Virtual debit</h1>
      <p className="lede">Numbers begin with 9999, pass Luhn, and are not a real BIN. Reveal needs your password again. Freezing uses a confirm step — not color alone.</p>
      {!card ? (
        <div className="empty-state"><DeskEmpty /><p>No virtual card on this profile yet.</p></div>
      ) : (
        <section className="card-face" aria-label="Virtual card">
          <p className="kicker">Halcyon Card · DEMO</p>
          <p className="num" aria-label={card.frozen ? "Card frozen" : "Card open"}>
            {pan || `···· ···· ···· ${card.last4}`}
          </p>
          <p className="meta">
            Status: <strong>{card.frozen ? "Frozen" : "Open"}</strong>
            {" · "}
            <span className={`pill ${card.frozen ? "warn" : "info"}`} aria-label={card.frozen ? "Frozen" : "Open"}>
              {card.frozen ? "Frozen" : "Open"}
            </span>
          </p>
          <p className="meta">Estimated cashback · ${(cashbackMinor / 100).toFixed(2)} at 1% of settled simulator spend</p>
          {pan ? <p className="meta">Demo PIN after step-up: 0000 (not a real card PIN)</p> : null}
          {card.limits ? (
            <p className="meta">
              Limits · in-person ${((card.limits.inPerson ?? 0) / 100).toFixed(0)} · online ${((card.limits.online ?? 0) / 100).toFixed(0)} · ATM ${((card.limits.atm ?? 0) / 100).toFixed(0)}
            </p>
          ) : null}
        </section>
      )}
      <label className="field">Password for step-up
        <input type="password" aria-label="Password to reveal card" value={password} onChange={(event) => setPassword(event.target.value)} />
      </label>
      {confirmReveal ? (
        <div className="panel" role="group" aria-label="Confirm reveal card number">
          <p>Reveal the demo PAN? Prefix 9999 is not a real BIN.</p>
          <button
            className="btn-solid"
            type="button"
            onClick={() => void call("/api/v1/stepup", { password }).then(() => card && call("/api/v1/cards/reveal", { cardId: card.id })).then(() => setConfirmReveal(false))}
          >
            Confirm reveal card number
          </button>
          <button className="btn-line" type="button" onClick={() => setConfirmReveal(false)}>Cancel</button>
        </div>
      ) : (
        <button className="btn-line" type="button" onClick={() => setConfirmReveal(true)}>Show number</button>
      )}
      {card ? (
        confirmFreeze ? (
          <div className="panel" role="group" aria-label="Confirm freeze card">
            <p>{card.frozen ? "Unfreeze" : "Freeze"} this virtual debit card?</p>
            <button
              className="btn-solid"
              type="button"
              onClick={() => void call("/api/v1/cards/freeze", { cardId: card.id, frozen: !card.frozen }).then(() => setConfirmFreeze(false))}
            >
              Confirm {card.frozen ? "unfreeze" : "freeze"} card
            </button>
            <button className="btn-line" type="button" onClick={() => setConfirmFreeze(false)}>Cancel</button>
          </div>
        ) : (
          <button className="btn-line" type="button" onClick={() => setConfirmFreeze(true)}>
            {card.frozen ? "Unfreeze card" : "Freeze card"}
          </button>
        )
      ) : null}
      <div className="panel">
        <h2 className="serif">Spend simulator</h2>
        <label className="field">Merchant<input aria-label="Merchant" value={merchant} onChange={(event) => setMerchant(event.target.value)} /></label>
        <label className="field">Amount<input aria-label="Spend amount" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
        <label className="field">City<input aria-label="City" value={city} onChange={(event) => setCity(event.target.value)} /></label>
        <button className="btn-solid" type="button" onClick={() => void call("/api/v1/cards/spend", { merchant, amount, city, category: "Dining" })}>
          Authorize {merchant} for ${amount}
        </button>
      </div>
      <h2 className="serif">Authorizations &amp; holds</h2>
      {holds.length === 0 ? <p className="meta">No pending authorizations.</p> : holds.map((hold) => (
        <div className="row" key={hold.id}>
          <span>
            {hold.merchant}
            <br />
            <span className="meta">{hold.city || "—"} · {hold.category || "Pending"} · ${(Number(hold.amount_minor) / 100).toFixed(2)}</span>
          </span>
          <span>
            <button className="btn-line" type="button" onClick={() => void call("/api/v1/cards/settle", { holdId: hold.id, action: "settle" })}>Settle</button>
            <button className="btn-line" type="button" onClick={() => void call("/api/v1/cards/settle", { holdId: hold.id, action: "expire" })}>Expire</button>
            <Link className="btn-line" href="/banking/activity">Dispute from activity</Link>
          </span>
        </div>
      ))}
      {message ? <p role="status">{message}</p> : null}
      <p className="meta">PIN for POS simulators: step-up password, not a stored PIN. ATM locator pins are illustrative only.</p>
    </>
  );
}
