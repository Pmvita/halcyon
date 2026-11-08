import type { Metadata } from "next";
import Link from "next/link";
import { Money } from "@/components/money";
import { halcyon, requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Banking",
  description: "Internal ledger accounts, transfers, cards, and statements on the Halcyon demo desk.",
};

export default async function BankingPage() {
  const user = await requireUser();
  const bank = await (await halcyon()).banking(user.id);
  return (
    <>
      <p className="kicker">Banking</p>
      <h1 className="serif" style={{ fontSize: 56 }}>Accounts</h1>
      <p className="lede">Internal ledger only. A bank transfer stays pending until the next business morning. Wires quote a fee before they post.</p>
      {bank.accounts.filter((account) => account.kind !== "equity").map((account) => (
        <div className="row" key={account.id}>
          <span>{account.name}<br /><span className="meta">{account.type} · {account.currency} · {account.visibility}</span></span>
          <span><Money minor={account.balanceMinor} currency={account.currency} />{account.heldMinor ? <span className="meta extra"> hold <Money minor={account.heldMinor} /></span> : null}</span>
        </div>
      ))}
      <p><Link className="btn-solid" href="/banking/move">Pay or transfer</Link> <Link className="btn-line" href="/banking/cards">Cards</Link> <Link className="btn-line" href="/banking/statements">Statements</Link> <Link className="btn-line" href="/banking/disputes">Disputes</Link></p>
      <h2 className="serif">Activity</h2>
      {bank.activity.map((item) => (
        <div className="row" key={item.id}><span>{item.memo}<br /><span className="meta">{item.category}</span></span><Money minor={item.amountMinor} signed /></div>
      ))}
    </>
  );
}
