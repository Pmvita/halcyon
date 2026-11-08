import { halcyon, requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function DisputesPage() {
  const user = await requireUser();
  const banking = await (await halcyon()).banking(user.id);
  return (
    <>
      <p className="kicker">Cases</p>
      <h1 className="serif" style={{ fontSize: 52 }}>Disputes</h1>
      <p className="lede">A case is a timeline on the demo ledger. Provisional credit, when you post one from the spend simulator’s reversal path, is not a network chargeback.</p>
      {banking.activity.slice(0, 4).map((item) => (
        <div className="row" key={item.id}><span>{item.memo}</span><span className="meta">{item.category}</span></div>
      ))}
      <p>The seeded café case for Maya stays open with two notes: opened, then a reminder that any credit is simulated.</p>
    </>
  );
}
