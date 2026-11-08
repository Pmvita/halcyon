"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatMoney, orderSchema } from "@halcyon/domain";

type Props = {
  symbol: string;
  accountId: string;
  ask: number;
  bid: number;
  buyingPowerMinor?: number;
  positionQty?: number;
};

export function OrderTicket({ symbol, accountId, ask, bid, buyingPowerMinor = 0, positionQty = 0 }: Props) {
  const router = useRouter();
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [type, setType] = useState("limit");
  const [qty, setQty] = useState("10");
  const [limit, setLimit] = useState(ask.toFixed(2));
  const [review, setReview] = useState(false);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [fill, setFill] = useState<{ status: string; filledQty: number; avg?: number; reason?: string } | null>(null);

  const touch = side === "buy" ? ask : bid;
  const qtyNum = Number(qty) || 0;
  const estimate = useMemo(() => {
    const px = type === "market" || type === "moc" ? touch : Number(limit) || touch;
    const notional = px * qtyNum;
    const fee = qtyNum * 0.0002;
    return { px, notional, fee, total: notional + (side === "buy" ? fee : 0) };
  }, [type, touch, limit, qtyNum, side]);

  function validate() {
    const parsed = orderSchema.safeParse({
      accountId,
      symbol,
      side,
      type,
      qty: Number(qty),
      limitPrice: type === "market" || type === "moc" ? undefined : Number(limit),
      tif: "day",
      confirmed: true,
      idempotencyKey: crypto.randomUUID(),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the ticket fields.");
      return null;
    }
    if (side === "sell" && positionQty > 0 && Number(qty) > positionQty + 1e-9) {
      setError(`You hold ${positionQty.toFixed(2)} ${symbol}. Reduce the sell quantity.`);
      return null;
    }
    if (side === "buy" && buyingPowerMinor > 0 && estimate.total * 100 > buyingPowerMinor * 1.02) {
      setError(`Estimated cost ${formatMoney(Math.round(estimate.total * 100))} exceeds buying power ${formatMoney(buyingPowerMinor)}.`);
      return null;
    }
    setError("");
    return parsed.data;
  }

  function startReview(event?: { preventDefault?: () => void }) {
    event?.preventDefault?.();
    if (!validate()) return;
    setReview(true);
    setFill(null);
    setMessage("");
  }

  async function send() {
    const payload = validate();
    if (!payload) {
      setReview(false);
      return;
    }
    setSending(true);
    try {
      const response = await fetch("/api/v1/orders", {
        method: "POST",
        headers: { "content-type": "application/json", "x-halcyon-request": "1" },
        body: JSON.stringify(payload),
      });
      const body = await response.json();
      const order = body.order;
      if (body.error?.message) {
        setMessage(body.error.message);
        setFill(null);
      } else if (order) {
        setFill({
          status: order.status,
          filledQty: Number(order.filledQty ?? order.filled_qty ?? 0),
          avg: order.avgPrice ?? order.avg_price ?? undefined,
          reason: order.rejectReason ?? order.reject_reason ?? undefined,
        });
        setMessage(
          `${order.status.toUpperCase()} on HALCYON-SIM · filled ${order.filledQty ?? 0} of ${qty} ${symbol}` +
            (order.rejectReason ? ` · ${order.rejectReason}` : ""),
        );
      } else {
        setMessage("No order returned.");
      }
      setReview(false);
      router.refresh();
    } finally {
      setSending(false);
    }
  }

  return (
    <form className="ticket" onSubmit={startReview} noValidate>
      <h2 className="serif">Ticket</h2>
      <p className="meta">
        Bid {bid.toFixed(2)} · Ask {ask.toFixed(2)}. Venue HALCYON-SIM · equity pass-through $0.0002/sh.
        Market buy of 100 shares fills displayed depth of 40, then cancels the rest.
      </p>
      <div className="ticket-stats">
        <div>
          <span className="meta">Buying power</span>
          <strong className="num">{formatMoney(buyingPowerMinor)}</strong>
        </div>
        <div>
          <span className="meta">Position</span>
          <strong className="num">{positionQty.toFixed(2)} {symbol}</strong>
        </div>
      </div>
      <div className="ticket-sides" role="group" aria-label="Side">
        <button type="button" className={side === "buy" ? "btn-solid" : "btn-line"} aria-pressed={side === "buy"} onClick={() => setSide("buy")}>Buy</button>
        <button type="button" className={side === "sell" ? "btn-solid" : "btn-line"} aria-pressed={side === "sell"} onClick={() => setSide("sell")}>Sell</button>
      </div>
      <label className="field">Type
        <select aria-label="Order type" value={type} onChange={(event) => setType(event.target.value)}>
          <option value="market">Market</option>
          <option value="limit">Limit</option>
          <option value="stop">Stop</option>
          <option value="moc">Market on close</option>
        </select>
      </label>
      <label className="field">Quantity
        <input aria-label="Quantity" value={qty} onChange={(event) => setQty(event.target.value)} inputMode="decimal" required />
      </label>
      {type !== "market" && type !== "moc" ? (
        <label className="field">Limit
          <input aria-label="Limit price" value={limit} onChange={(event) => setLimit(event.target.value)} inputMode="decimal" required />
        </label>
      ) : null}
      <p className="meta">Est. touch {estimate.px.toFixed(2)} · notional {formatMoney(Math.round(estimate.notional * 100))} · fee ≈ {formatMoney(Math.round(estimate.fee * 100))}</p>
      {error ? <p role="alert">{error}</p> : null}
      {review ? (
        <div className="panel review-panel">
          <p className="kicker">Review</p>
          <p>
            Confirm <strong>{side}</strong> <strong className="num">{qty}</strong> {symbol} · {type}.
            Estimated touch <span className="num">{estimate.px.toFixed(2)}</span>.
            Settles on HALCYON-SIM with the demo slippage model — not a live broker route.
          </p>
          <div className="ticket-actions">
            <button className="btn-solid" type="button" disabled={sending} onClick={() => void send()}>
              {sending ? "Sending…" : `Confirm ${side} ${qty} ${symbol}`}
            </button>
            <button className="btn-line" type="button" disabled={sending} onClick={() => setReview(false)}>Back</button>
          </div>
        </div>
      ) : (
        <button className="btn-solid" type="submit" disabled={!accountId}>Review order</button>
      )}
      {fill ? (
        <div className="panel fill-panel" role="status">
          <p className="kicker">Fill</p>
          <p>
            <span className="pill">{fill.status}</span>{" "}
            Filled <span className="num">{fill.filledQty}</span>
            {fill.avg != null ? <> @ <span className="num">{Number(fill.avg).toFixed(2)}</span></> : null}
          </p>
          {fill.reason ? <p className="meta">{fill.reason}</p> : null}
        </div>
      ) : null}
      {message ? <p role="status">{message}</p> : null}
    </form>
  );
}
