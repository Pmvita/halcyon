import type { Metadata } from "next";
import Link from "next/link";
import { formatPct } from "@halcyon/domain";
import { Meridian } from "@/components/marks";
import { Money, QuoteStatus } from "@/components/money";
import { halcyon, requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Home",
  description: "Net worth, cash, investments, and crypto on the Halcyon demo desk.",
};

export default async function HomePage() {
  const user = await requireUser();
  const app = await halcyon();
  const home = await app.home(user.id);
  const progress = home.session.mode === "open" ? 0.62 : 1;
  return (
    <>
      <p className="kicker">{home.session.label}</p>
      <Meridian progress={progress} />
      <h1><Money minor={home.netWorthMinor} /></h1>
      <p className="lede">Net worth for {user.name}, marked with the latest eligible prices. Home value is self-reported. Nothing here is a deposit.</p>
      <section className="figures" aria-label="Allocation">
        <article><span>Cash</span><strong><Money minor={home.cashMinor} /></strong></article>
        <article><span>Investments</span><strong><Money minor={home.investmentsMinor} /></strong></article>
        <article><span>Crypto</span><strong><Money minor={home.cryptoMinor} /></strong></article>
      </section>
      <div className="layout">
        <section>
          <h2 className="serif">Ledger</h2>
          {home.activity.length === 0 ? <p>No entries yet. <Link href="/banking/move">Add demo funds or move money</Link>.</p> : home.activity.map((item) => (
            <div className="row" key={item.id}>
              <span>{item.memo}<br /><span className="meta">{item.category} · {new Date(item.at).toLocaleDateString("en-US", { timeZone: "America/New_York" })}</span></span>
              <Money minor={item.amountMinor} signed />
            </div>
          ))}
        </section>
        <aside>
          <h2 className="serif">Tape</h2>
          {home.quotes.map((quote) => (
            <div key={quote.symbol} className="panel">
              <Link href={quote.symbol === "BTC" ? "/crypto" : `/markets/${quote.symbol}`}><strong>{quote.symbol}</strong> <span className="num">{formatPct(quote.changePct)}</span></Link>
              <QuoteStatus quote={quote} />
            </div>
          ))}
          <div className="panel">
            <h2 className="serif">Due</h2>
            {home.bills.length === 0 ? <p className="meta">No scheduled payments.</p> : home.bills.map((bill) => (
              <div className="row" key={String(bill.id)}>
                <span>{String(bill.memo)}<br /><span className="meta">{String(bill.status)}</span></span>
                <Money minor={Number(bill.amount_minor)} />
              </div>
            ))}
          </div>
        </aside>
      </div>
    </>
  );
}
