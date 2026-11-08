import Link from "next/link";
import { PriceChart } from "@/components/chart";
import { QuoteStatus } from "@/components/money";
import { OrderTicket } from "@/components/ticket";
import { halcyon, requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function SymbolPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const user = await requireUser();
  const app = await halcyon();
  const page = await app.symbol(user.id, symbol);
  const bank = await app.banking(user.id);
  const account = bank.accounts.find((item) => item.type === "brokerage") ?? bank.accounts.find((item) => item.type === "checking");
  return (
    <>
      <p className="kicker">{page.instrument?.assetClass ?? "Symbol"} {page.instrument?.proxy ?? ""}</p>
      <h1 className="serif" style={{ fontSize: 64 }}>{symbol.toUpperCase()}</h1>
      <p>{page.instrument?.name}. {page.instrument?.about}</p>
      <QuoteStatus quote={page.quote} />
      <PriceChart bars={page.bars} />
      <p className="meta">Chart path is a seeded walk around the anchor when a live bar feed is not configured. Crosshair text is on the canvas label.</p>
      <div className="grid-2">
        <OrderTicket symbol={symbol.toUpperCase()} accountId={account?.id ?? ""} ask={page.quote.ask} bid={page.quote.bid} />
        <aside>
          <h2 className="serif">Notes</h2>
          {page.news.map((item) => (
            <p key={item.title}>{item.title}<br /><span className="meta">{item.source} · {item.time}. {item.detail}</span></p>
          ))}
          <p><a href={page.filings}>Public filings search</a></p>
          <p><Link href={`/markets/options/${symbol.toUpperCase()}`}>Options payoff</Link></p>
        </aside>
      </div>
    </>
  );
}
