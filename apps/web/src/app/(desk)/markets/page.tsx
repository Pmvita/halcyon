import type { Metadata } from "next";
import Link from "next/link";
import { formatMoney, formatPct } from "@halcyon/domain";
import { MarketsScreener } from "@/components/screener";
import { halcyon, requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Markets",
  description: "Positions, watchlist, and HALCYON-SIM tickets for stocks, ETFs, bonds, FX, and options.",
};

export default async function MarketsPage() {
  const user = await requireUser();
  const markets = await (await halcyon()).markets(user.id);
  return (
    <>
      <p className="kicker">{markets.session.label}</p>
      <h1 className="serif" style={{ fontSize: 56 }}>Markets</h1>
      <p className="lede">
        Working desk for the curated universe. Quotes show source, age, and status. Orders fill on HALCYON-SIM —
        never a live broker route. Weekend prices are a session replay around the shipped close.
      </p>

      <div className="figures">
        <article>
          <span>Buying power</span>
          <strong>{formatMoney(markets.buyingPowerMinor)}</strong>
        </article>
        <article>
          <span>Open positions</span>
          <strong>{markets.positions.length}</strong>
        </article>
        <article>
          <span>Working orders</span>
          <strong>{markets.openOrders.length}</strong>
        </article>
      </div>

      <h2 className="serif">Positions</h2>
      {markets.positions.length === 0 ? (
        <p className="meta">No lots yet. Open a symbol and place a ticket.</p>
      ) : (
        markets.positions.map((position) => (
          <Link className="row" key={position.symbol} href={`/markets/${position.symbol}`}>
            <span>
              {position.symbol}
              <br />
              <span className="meta num">
                {position.qty.toFixed(2)} · cost {position.cost.toFixed(0)} · mkt {position.market.toFixed(0)}
              </span>
            </span>
            <span className={position.pnl < 0 ? "loss num" : "profit num"}>
              {formatPct(position.cost ? position.pnl / position.cost : 0)}
            </span>
          </Link>
        ))
      )}

      {markets.openOrders.length > 0 ? (
        <>
          <h2 className="serif">Open orders</h2>
          {(markets.openOrders as Array<Record<string, unknown>>).map((order) => {
            const id = String(order.id);
            const symbol = String(order.symbol);
            const side = String(order.side);
            const orderType = String(order.order_type);
            const status = String(order.status);
            return (
              <Link className="row" key={id} href={`/markets/${symbol}`}>
                <span>
                  {side} {symbol}
                  <br />
                  <span className="meta">{orderType} · {status}</span>
                </span>
                <span className="num">
                  {Number(order.filled_qty)}/{Number(order.qty)}
                </span>
              </Link>
            );
          })}
        </>
      ) : null}

      <h2 className="serif">Watch</h2>
      {markets.watch.map((quote) => (
        <Link className="row" key={quote.symbol} href={quote.symbol === "BTC" ? "/crypto" : `/markets/${quote.symbol}`}>
          <span>
            {quote.symbol}
            <br />
            <span className="meta">
              {quote.status} · {quote.source}
            </span>
          </span>
          <span className="num">{quote.last.toFixed(2)}</span>
        </Link>
      ))}

      <p>
        <Link href="/markets/bonds">Treasury ladder</Link> · <Link href="/markets/fx">FX</Link> ·{" "}
        <Link href="/markets/options/AAPL">Options payoff</Link>
      </p>

      <h2 className="serif">Screener</h2>
      <MarketsScreener rows={markets.universe} />
    </>
  );
}
