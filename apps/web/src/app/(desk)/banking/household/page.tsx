import type { Metadata } from "next";
import { DeskEmpty } from "@/components/marks";
import { Money } from "@/components/money";
import { halcyon, requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Household",
  description: "Joint account visibility for the Chen household on Halcyon.",
};

export default async function HouseholdPage() {
  const user = await requireUser();
  const bank = await (await halcyon()).banking(user.id);
  const shared = bank.accounts.filter((account) => account.visibility === "shared");
  const privateOwned = bank.accounts.filter((account) => account.visibility === "private" && account.owner_id === user.id);

  return (
    <>
      <p className="kicker">Household</p>
      <h1 className="serif" style={{ fontSize: 52 }}>Shared ledger</h1>
      <p className="lede">Joint accounts are visible to household members. Private accounts stay private even when people share a household id.</p>
      <section className="panel">
        <h2 className="serif">Members</h2>
        {bank.household.length === 0 ? (
          <div className="empty-state"><DeskEmpty /><p>This persona is not in a household.</p></div>
        ) : bank.household.map((member) => (
          <div className="row" key={member.id}>
            <span>{member.name}<br /><span className="meta">@{member.handle ?? "—"}{member.id === user.id ? " · you" : ""}</span></span>
          </div>
        ))}
      </section>
      <div className="grid-2">
        <section>
          <h2 className="serif">Joint / shared</h2>
          {shared.length === 0 ? <p className="meta">No shared accounts visible.</p> : shared.map((account) => (
            <div className="row" key={account.id}>
              <span>{account.displayName}<br /><span className="meta">{account.type} · owner {account.owner_id === user.id ? "you" : "household"}</span></span>
              <Money minor={account.balanceMinor} />
            </div>
          ))}
        </section>
        <aside>
          <h2 className="serif">Your private accounts</h2>
          {privateOwned.filter((account) => ["checking", "hysa", "cd", "credit", "escrow"].includes(account.type)).map((account) => (
            <div className="row" key={account.id}>
              <span>{account.displayName}<br /><span className="meta">private · not shown to others</span></span>
              <Money minor={account.balanceMinor} />
            </div>
          ))}
        </aside>
      </div>
    </>
  );
}
