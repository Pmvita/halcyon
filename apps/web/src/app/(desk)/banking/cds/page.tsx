import type { Metadata } from "next";
import Link from "next/link";
import { DeskEmpty } from "@/components/marks";
import { Money } from "@/components/money";
import { halcyon, requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Certificates",
  description: "CD terms and ladder overview on the Halcyon demo desk.",
};

export default async function CdsPage() {
  const user = await requireUser();
  const bank = await (await halcyon()).banking(user.id);

  return (
    <>
      <p className="kicker">Certificates</p>
      <h1 className="serif" style={{ fontSize: 52 }}>CD ladder</h1>
      <p className="lede">Term deposits accrue demo APY daily when Banking loads. Early withdrawal forfeits the last period of interest in this simulation.</p>
      {bank.cds.length === 0 ? (
        <div className="empty-state">
          <DeskEmpty />
          <p>No certificates on this persona.</p>
        </div>
      ) : bank.cds.map((cd) => (
        <article className="panel" key={cd.id}>
          <div className="row">
            <span>
              {cd.name}
              <br />
              <span className="meta">{cd.termMonths}-month · matures {cd.maturityDate ?? "—"}</span>
            </span>
            <span className="num"><Money minor={cd.balanceMinor} /></span>
          </div>
          <p className="meta">APY {(cd.apyBps / 100).toFixed(2)}% · {cd.earlyWithdrawal}</p>
        </article>
      ))}
      <div className="panel">
        <h2 className="serif">Bond ladder (markets)</h2>
        <p className="lede">Treasury and model bond prices live on Markets. Banking only links out — this page does not rewrite the tape.</p>
        <p><Link className="btn-line" href="/markets/bonds">Open bond desk</Link></p>
      </div>
      {bank.goals.some((goal) => String(goal.name).toLowerCase().includes("cd")) ? (
        <p className="meta">A CD-ladder savings goal is also tracked under <Link href="/banking/goals">Goals</Link>.</p>
      ) : null}
    </>
  );
}
