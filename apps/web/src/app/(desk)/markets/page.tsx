import Link from "next/link";
import { formatPct } from "@halcyon/domain";
import { Money } from "@/components/money";
import { halcyon, requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function MarketsPage() {
  const user = await requireUser();
  const markets = await (await halcyon()).markets(user.id);
  return (
    <>
      <p className="kicker">{markets.session.label}</p>
      <h1 className="serif" style={{ fontSize: 56 }}>Markets</h1>
      <p className="lede">One ticket for stocks, ETFs, and the proxies beside them. Orders fill on HALCYON-SIM. Weekend prices are a session replay around the shipped close.</p>
      <h2 className="serif">Positions</h2>
      {markets.positions.length === 0 ? <p>No lots yet.</p> : markets.positions.map((position) => (
        <Link className="row" key={position.symbol} href={`/markets/${position.symbol}`}>
          <span>{position.symbol}<br /><span className="meta num">{position.qty.toFixed(2)} · cost {position.cost.toFixed(0)}</span></span>
          <span className={position.pnl < 0 ? "loss num" : "profit num"}>{formatPct(position.cost ? position.pnl / position.cost : 0)}</span>
        </Link>
      ))}
      <h2 className="serif">Watch</h2>
      {markets.watch.map((quote) => (
        <Link className="row" key={quote.symbol} href={quote.symbol === "BTC" ? "/crypto" : `/markets/${quote.symbol}`}>
          <span>{quote.symbol}<br /><span className="meta">{quote.status} · {quote.source}</span></span>
          <span className="num">{quote.last.toFixed(2)}</span>
        </Link>
      ))}
      <p><Link href="/markets/bonds">Treasury ladder</Link> · <Link href="/markets/fx">FX</Link> · <Link href="/markets/options/AAPL">Options payoff</Link></p>
      <h2 className="serif">Screener</h2>
      <table className="dense">
        <thead><tr><th>Symbol</th><th>Yield</th><th className="extra">Sector</th><th>Close</th></tr></thead>
        <tbody>
          {markets.universe.slice(0, 12).map((item) => (
            <tr key={item.symbol}><td><Link href={`/markets/${item.symbol}`}>{item.symbol}</Link> {item.proxy ? <span className="meta">ETF proxy</span> : null}</td><td className="num">{(item.dividendYield * 100).toFixed(2)}%</td><td className="extra">{item.sector}</td><td className="num">{item.close.toFixed(2)}</td></tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
