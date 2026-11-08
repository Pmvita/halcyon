import type { Metadata } from "next";
import Link from "next/link";
import { DeskEmpty } from "@/components/marks";
import { Money } from "@/components/money";
import { halcyon, requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Loans",
  description: "Mortgage amortization snapshot and escrow for the Halcyon demo desk.",
};

export default async function LoansPage() {
  const user = await requireUser();
  const bank = await (await halcyon()).banking(user.id);
  const mortgage = bank.mortgage;

  if (!mortgage) {
    return (
      <>
        <p className="kicker">Loans</p>
        <h1 className="serif" style={{ fontSize: 52 }}>Mortgage</h1>
        <div className="empty-state">
          <DeskEmpty />
          <p>No mortgage on this persona. Maya’s household carries the residence loan in the seed.</p>
        </div>
      </>
    );
  }

  const balance = mortgage.balanceMinor;
  const rate = mortgage.aprBps / 10_000;
  const rows = Array.from({ length: 6 }, (_, index) => {
    const interest = Math.round(balance * rate / 12);
    const principal = Math.max(0, mortgage.nextPaymentMinor - mortgage.escrowMinor - interest);
    return {
      period: index + 1,
      payment: mortgage.nextPaymentMinor,
      principal,
      interest,
      escrow: mortgage.escrowMinor,
      remaining: Math.max(0, balance - principal * (index + 1)),
    };
  });

  return (
    <>
      <p className="kicker">Loans</p>
      <h1 className="serif" style={{ fontSize: 52 }}>{mortgage.name}</h1>
      <p className="lede">{mortgage.note} Self-reported home value is not an appraisal.</p>
      <section className="figures" aria-label="Mortgage summary">
        <article><span>Principal balance</span><strong className="num"><Money minor={mortgage.balanceMinor} /></strong></article>
        <article><span>Next payment</span><strong className="num"><Money minor={mortgage.nextPaymentMinor} /></strong></article>
        <article><span>APR</span><strong className="num">{(mortgage.aprBps / 100).toFixed(2)}%</strong></article>
      </section>
      <div className="grid-2">
        <section>
          <h2 className="serif">Payment split</h2>
          <div className="row"><span>Principal</span><Money minor={mortgage.principalMinor} /></div>
          <div className="row"><span>Interest</span><Money minor={mortgage.interestMinor} /></div>
          <div className="row"><span>Escrow</span><Money minor={mortgage.escrowMinor} /></div>
          <div className="row"><span>Escrow balance</span><Money minor={mortgage.escrowBalanceMinor} /></div>
          <div className="row"><span>Home value (self-reported)</span><Money minor={mortgage.homeValueMinor} /></div>
        </section>
        <aside>
          <h2 className="serif">Amortization snapshot</h2>
          <table className="dense">
            <thead>
              <tr><th>Period</th><th>Payment</th><th>Principal</th><th>Interest</th><th>Escrow</th><th>Remaining</th></tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.period}>
                  <td>{row.period}</td>
                  <td>{(row.payment / 100).toFixed(2)}</td>
                  <td>{(row.principal / 100).toFixed(2)}</td>
                  <td>{(row.interest / 100).toFixed(2)}</td>
                  <td>{(row.escrow / 100).toFixed(2)}</td>
                  <td>{(row.remaining / 100).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="meta">Illustrative only. Scripted mortgage posts appear in <Link href="/banking/activity?category=Housing">activity</Link>.</p>
        </aside>
      </div>
    </>
  );
}
