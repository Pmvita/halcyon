"use client";

import { useEffect, useRef, useState } from "react";
import { watchAddressSchema } from "@halcyon/domain";

type Quote = { symbol: string; last: number; status: string; source: string; detail?: string; asOf: string };

export default function CryptoPage() {
  const openedAt = useRef(Date.now());
  const [data, setData] = useState<{ quotes: Quote[]; digest: string; fees: { source: string; status: string; ethSource: string }; earns: { symbol: string; qty: number; rate: number }[] } | null>(null);
  const [address, setAddress] = useState("1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa");
  const [honeypot, setHoneypot] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    openedAt.current = Date.now();
    void fetch("/api/v1/crypto", { headers: { "x-halcyon-request": "1" } }).then((response) => response.json()).then(setData);
  }, []);

  async function watch() {
    if (honeypot) {
      setError("Request blocked.");
      return;
    }
    const parsed = watchAddressSchema.safeParse({
      address,
      chain: address.startsWith("0x") ? "eth" : "btc",
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the public address.");
      return;
    }
    setError("");
    const response = await fetch("/api/v1/watch", {
      method: "POST",
      headers: { "content-type": "application/json", "x-halcyon-request": "1" },
      body: JSON.stringify({ ...parsed.data, company: honeypot, openedAt: openedAt.current }),
    });
    const body = await response.json();
    if (body.error?.message) {
      setMessage(body.error.message);
      return;
    }
    const balance = body.balance == null ? "Balance unavailable" : `${body.balance} ${body.unit ?? ""}`;
    setMessage(`${body.notice ?? "Watch-only."} ${balance} · ${body.status ?? ""} · ${body.source ?? body.detail ?? ""}`);
  }

  return (
    <>
      <p className="kicker">Crypto</p>
      <h1 className="serif" style={{ fontSize: 56 }}>Spot paper</h1>
      <p className="lede">{data?.digest}</p>
      {data?.quotes.map((quote) => (
        <a className="row" key={quote.symbol} href={`/markets/${quote.symbol}`}>
          <span>{quote.symbol}<br /><span className="meta">{quote.status} · {quote.source} {quote.detail ? `· ${quote.detail}` : ""}</span></span>
          <span className="num">{quote.last ? quote.last.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "—"}</span>
        </a>
      ))}
      <div className="panel">
        <h2 className="serif">Watch-only</h2>
        <p>Watch-only. Halcyon cannot move these coins. Never enter a seed phrase or a private key.</p>
        <label className="field">Public address
          <input aria-label="Public address" value={address} onChange={(event) => setAddress(event.target.value)} autoComplete="off" spellCheck={false} />
        </label>
        <label className="hp" aria-hidden="true">
          Company
          <input tabIndex={-1} autoComplete="off" value={honeypot} onChange={(event) => setHoneypot(event.target.value)} />
        </label>
        {error ? <p role="alert">{error}</p> : null}
        <button className="btn-solid" type="button" onClick={() => void watch()}>Read public balance</button>
        {message ? <p role="status">{message}</p> : null}
      </div>
      <div className="panel">
        <h2 className="serif">Earn</h2>
        {data?.earns.map((earn) => <p key={earn.symbol}>{earn.qty} {earn.symbol} at {(earn.rate * 100).toFixed(1)}% posted. Rewards are demo units.</p>)}
        <p className="meta">Fees: {data?.fees.source} · {data?.fees.status}. ETH gas: {data?.fees.ethSource}.</p>
      </div>
    </>
  );
}
