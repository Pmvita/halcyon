import Link from "next/link";
import { formatMoney, formatPct, formatPlain } from "@halcyon/domain";
import { PriceChart } from "@/components/chart";
import { QuoteStatus } from "@/components/money";
import { SymbolNews } from "@/components/news";
import { OrderTicket } from "@/components/ticket";
import { halcyon, requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function SymbolPage({
  params,
  searchParams,
}: {
  params: Promise<{ symbol: string }>;
  searchParams: Promise<{ range?: string }>;
}) {
  const { symbol } = await params;
  const { range } = await searchParams;
  const user = await requireUser();
  const app = await halcyon();
  const page = await app.symbol(user.id, symbol, range ?? "3M");
  const upper = symbol.toUpperCase();
  const name = page.instrument?.name ?? upper;

  return (
    <>
      <p className="kicker">
        {page.instrument?.assetClass ?? "Symbol"}
        {page.instrument?.proxy ? ` · ${page.instrument.proxy}` : ""}
      </p>
      <div className="symbol-head">
        <div>
          <h1 className="serif" style={{ fontSize: 64 }}>
            {upper}
          </h1>
          <p className="lede" style={{ marginBottom: 8 }}>
            {name}. {page.instrument?.about}
          </p>
        </div>
        <div className="symbol-mark">
          <p className="num mark-last">{formatPlain(page.quote.last)}</p>
          <p className={`num ${page.quote.changePct < 0 ? "loss" : "profit"}`}>{formatPct(page.quote.changePct)}</p>
        </div>
      </div>

      <QuoteStatus quote={page.quote} />

      {page.stats ? (
        <div className="figures">
          <article>
            <span>Sector</span>
            <strong>{page.stats.sector}</strong>
          </article>
          <article>
            <span>Div. yield</span>
            <strong className="num">{(page.stats.dividendYield * 100).toFixed(2)}%</strong>
          </article>
          <article>
            <span>Buying power</span>
            <strong className="num">{formatMoney(page.buyingPowerMinor)}</strong>
          </article>
        </div>
      ) : null}

      <PriceChart symbol={upper} initial={page.chart} bars={page.bars} />

      <div className="grid-2 desk-split">
        <OrderTicket
          symbol={upper}
          accountId={page.accountId}
          ask={page.quote.ask}
          bid={page.quote.bid}
          buyingPowerMinor={page.buyingPowerMinor}
          positionQty={page.position?.qty ?? 0}
        />
        <aside className="desk-aside">
          <h2 className="serif">Position</h2>
          {page.position ? (
            <p>
              <span className="num">{page.position.qty.toFixed(4)}</span> shares · cost{" "}
              <span className="num">{page.position.cost.toFixed(2)}</span> · mkt{" "}
              <span className="num">{page.position.market.toFixed(2)}</span>
              <br />
              <span className={page.position.pnl < 0 ? "loss num" : "profit num"}>
                P&amp;L {formatMoney(Math.round(page.position.pnl * 100))} (
                {formatPct(page.position.cost ? page.position.pnl / page.position.cost : 0)})
              </span>
            </p>
          ) : (
            <p className="meta">Flat · no open lot in this symbol.</p>
          )}

          <h2 className="serif">Orders on {upper}</h2>
          {page.orders.length === 0 ? (
            <p className="meta">No recent tickets for this symbol.</p>
          ) : (
            page.orders.map((order) => (
              <div className="row" key={order.id}>
                <span>
                  {order.side} {order.order_type}
                  <br />
                  <span className="meta">{order.status}</span>
                </span>
                <span className="num">
                  {Number(order.filled_qty)}/{Number(order.qty)}
                  {order.avg_price != null ? ` @ ${Number(order.avg_price).toFixed(2)}` : ""}
                </span>
              </div>
            ))
          )}

          <SymbolNews items={page.news} meta={page.newsMeta} />

          <p>
            <a href={page.filings} target="_blank" rel="noreferrer">
              Public filings search
            </a>
          </p>
          <p>
            <Link href={`/markets/options/${upper}`}>Options payoff</Link>
          </p>
        </aside>
      </div>

      {page.related.length > 0 ? (
        <>
          <h2 className="serif">Related</h2>
          <div className="related-row">
            {page.related.map((item) => (
              <Link className="related-chip" key={item.symbol} href={`/markets/${item.symbol}`}>
                <strong>{item.symbol}</strong>
                <span className="meta">{item.name}</span>
                <span className="num">{item.close.toFixed(2)}</span>
              </Link>
            ))}
          </div>
        </>
      ) : null}

      <p className="meta">
        <Link href="/markets">← Markets</Link>
      </p>
    </>
  );
}
