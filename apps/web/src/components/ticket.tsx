"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function OrderTicket({ symbol, accountId, ask, bid }: { symbol: string; accountId: string; ask: number; bid: number }) {
  const router = useRouter();
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [type, setType] = useState("limit");
  const [qty, setQty] = useState("10");
  const [limit, setLimit] = useState(ask.toFixed(2));
  const [review, setReview] = useState(false);
  const [message, setMessage] = useState("");
  async function send() {
    const response = await fetch("/api/v1/orders", {
      method: "POST",
      headers: { "content-type": "application/json", "x-halcyon-request": "1" },
      body: JSON.stringify({
        accountId,
        symbol,
        side,
        type,
        qty: Number(qty),
        limitPrice: type === "market" ? undefined : Number(limit),
        tif: "day",
        confirmed: true,
        idempotencyKey: crypto.randomUUID(),
      }),
    });
    const body = await response.json();
    const order = body.order;
    setMessage(body.error?.message ?? (order ? `${order.status}. Filled ${order.filledQty ?? 0} on HALCYON-SIM. ${order.rejectReason ?? ""}` : "No order."));
    setReview(false);
    router.refresh();
  }
  return (
    <form onSubmit={(event) => { event.preventDefault(); setReview(true); }}>
      <h2 className="serif">Ticket</h2>
      <p className="meta">Bid {bid.toFixed(2)} · Ask {ask.toFixed(2)}. A market buy of 100 shares partial-fills at the displayed depth of 40, then the rest is cancelled.</p>
      <label className="field">Side
        <select aria-label="Side" value={side} onChange={(event) => setSide(event.target.value as "buy" | "sell")}>
          <option value="buy">Buy</option>
          <option value="sell">Sell</option>
        </select>
      </label>
      <label className="field">Type
        <select aria-label="Order type" value={type} onChange={(event) => setType(event.target.value)}>
          <option value="market">Market</option>
          <option value="limit">Limit</option>
          <option value="stop">Stop</option>
          <option value="moc">Market on close</option>
        </select>
      </label>
      <label className="field">Quantity<input aria-label="Quantity" value={qty} onChange={(event) => setQty(event.target.value)} /></label>
      {type !== "market" && type !== "moc" ? <label className="field">Limit<input aria-label="Limit price" value={limit} onChange={(event) => setLimit(event.target.value)} /></label> : null}
      {review ? (
        <div className="panel">
          <p>Confirm {side} {qty} {symbol} {type}. Estimated touch {side === "buy" ? ask.toFixed(2) : bid.toFixed(2)}. Equity pass-through is $0.0002 per share. Crypto, if this is a coin, is 10 bps taker.</p>
          <button className="btn-solid" type="button" onClick={() => void send()}>Confirm {side} {qty} {symbol}</button>
          <button className="btn-line" type="button" onClick={() => setReview(false)}>Back</button>
        </div>
      ) : <button className="btn-solid" type="submit" disabled={!accountId} onClick={(event) => { event.preventDefault(); setReview(true); }}>Review order</button>}
      {message ? <p role="status">{message}</p> : null}
    </form>
  );
}
