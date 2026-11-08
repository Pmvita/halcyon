import Link from "next/link";
import { QuoteStatus } from "@/components/money";
import { PriceChart } from "@/components/chart";
import { SymbolNews } from "@/components/news";
import { halcyon, requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const PAIRS = ["EURUSD", "GBPUSD", "USDJPY", "USDCHF"];

export default async function FxPage() {
  const user = await requireUser();
  const app = await halcyon();
  const desk = await app.symbol(user.id, "EURUSD", "3M");
  const quotes = [];
  for (const pair of PAIRS) quotes.push(await app.quotes.quote(pair, "page", user.replayEnabled));
  return (
    <>
      <p className="kicker">FX</p>
      <h1 className="serif" style={{ fontSize: 52 }}>Reference rates</h1>
      <p className="lede">
        Frankfurter republishes ECB reference rates. When only a mid is known, Halcyon shows an indicative 1 pip spread and says so.
        Charts use public Yahoo FX series when reachable, otherwise a labeled synthetic path. Conversion inside the ledger adds the 0.40% demo spread.
      </p>
      {quotes.map((quote) => (
        <Link key={quote.symbol} className="row" href={`/markets/${quote.symbol}`}>
          <span>
            <strong>{quote.symbol}</strong>
            <br />
            <span className="meta">Open desk</span>
          </span>
          <span className="num">{quote.last.toFixed(quote.symbol.includes("JPY") ? 3 : 4)}</span>
        </Link>
      ))}
      {quotes[0] ? <QuoteStatus quote={quotes[0]} /> : null}
      <PriceChart symbol="EURUSD" initial={desk.chart} bars={desk.bars} />
      <SymbolNews items={desk.news} meta={desk.newsMeta} />
    </>
  );
}
