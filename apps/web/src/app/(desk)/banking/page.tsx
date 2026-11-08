import type { Metadata } from "next";
import Link from "next/link";
import { DeskEmpty } from "@/components/marks";
import { Money } from "@/components/money";
import { NicknameForm } from "@/components/banking-actions";
import { halcyon, requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Banking",
  description: "Accounts, available balances, and demo routing on the Halcyon private desk.",
};

const HUB_TYPES = new Set(["checking", "hysa", "joint", "cd", "escrow", "credit", "mortgage", "cash_management"]);

export default async function BankingPage() {
  const user = await requireUser();
  const bank = await (await halcyon()).banking(user.id);
  const hub = bank.accounts.filter((account) => HUB_TYPES.has(account.type));
  const cashTotal = hub
    .filter((account) => account.kind === "asset" && account.type !== "home")
    .reduce((sum, account) => sum + account.availableMinor, 0);

  return (
    <>
      <p className="kicker">Banking</p>
      <h1 className="serif" style={{ fontSize: 56 }}>Accounts</h1>
      <p className="lede">{bank.demoNotice}</p>
      <section className="figures" aria-label="Cash summary">
        <article>
          <span>Available cash</span>
          <strong className="num"><Money minor={cashTotal} /></strong>
        </article>
        <article>
          <span>Pending holds</span>
          <strong className="num"><Money minor={hub.reduce((sum, account) => sum + account.heldMinor, 0)} /></strong>
        </article>
        <article>
          <span>Card cashback (est.)</span>
          <strong className="num"><Money minor={bank.cashbackMinor} /></strong>
        </article>
      </section>

      <div className="layout">
        <section>
          <h2 className="serif">Ledger accounts</h2>
          {hub.length === 0 ? (
            <div className="empty-state">
              <DeskEmpty />
              <p>No cash accounts yet. <Link href="/banking/move">Add demo funds</Link> to open checking.</p>
            </div>
          ) : hub.map((account) => (
            <article className="acct-block" key={account.id}>
              <div className="row">
                <span>
                  <Link href={`/banking/activity?accountId=${account.id}`}>{account.displayName}</Link>
                  <br />
                  <span className="meta">
                    {account.type} · {account.visibility}
                    {account.apy_bps ? ` · ${(account.apy_bps / 100).toFixed(2)}% APY` : ""}
                    {account.apr_bps ? ` · ${(account.apr_bps / 100).toFixed(2)}% APR` : ""}
                  </span>
                </span>
                <span className="num">
                  <Money minor={account.balanceMinor} currency={account.currency} />
                  <br />
                  <span className="meta">
                    avail <Money minor={account.availableMinor} />
                    {account.heldMinor ? <> · hold <Money minor={account.heldMinor} /></> : null}
                  </span>
                </span>
              </div>
              <p className="meta watermark">
                Routing {account.demoRouting} · Acct {account.demoAccountNumber} · DEMO watermark — not payable
              </p>
              {account.owner_id === user.id ? <NicknameForm accountId={account.id} current={account.nickname ?? ""} /> : null}
            </article>
          ))}
        </section>
        <aside>
          <h2 className="serif">Desk shortcuts</h2>
          <p><Link className="btn-solid" href="/banking/move">Pay or transfer</Link></p>
          <p><Link className="btn-line" href="/banking/deposit">Deposit a check</Link> <Link className="btn-line" href="/banking/cards">Cards</Link></p>
          <p><Link className="btn-line" href="/banking/statements">Statements</Link> <Link className="btn-line" href="/banking/goals">Goals</Link></p>
          {bank.mortgage ? (
            <div className="panel">
              <h2 className="serif">Mortgage</h2>
              <p className="meta">Next demo payment <Money minor={bank.mortgage.nextPaymentMinor} /></p>
              <p><Link href="/banking/loans">Amortization snapshot</Link></p>
            </div>
          ) : null}
          {bank.cds[0] ? (
            <div className="panel">
              <h2 className="serif">CD</h2>
              <p className="meta">{bank.cds[0].name} · matures {bank.cds[0].maturityDate ?? "—"}</p>
              <p><Link href="/banking/cds">Terms &amp; ladder</Link></p>
            </div>
          ) : null}
          <div className="panel">
            <h2 className="serif">Recent activity</h2>
            {bank.activity.slice(0, 8).map((item) => (
              <div className="row" key={item.id}>
                <span>{item.memo}<br /><span className="meta">{item.category}</span></span>
                <Money minor={item.amountMinor} signed />
              </div>
            ))}
            <p><Link href="/banking/activity">Search activity</Link></p>
          </div>
        </aside>
      </div>
    </>
  );
}
