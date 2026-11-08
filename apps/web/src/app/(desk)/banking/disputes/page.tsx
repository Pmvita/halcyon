import type { Metadata } from "next";
import Link from "next/link";
import { DeskEmpty } from "@/components/marks";
import { halcyon, requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Disputes",
  description: "Open and track demo dispute cases on the Halcyon banking desk.",
};

type TimelineNote = { at?: string; state?: string; note?: string };

export default async function DisputesPage() {
  const user = await requireUser();
  const banking = await (await halcyon()).banking(user.id);
  const disputes = banking.disputes as Array<{
    id: string;
    status: string;
    reason: string;
    timeline: TimelineNote[] | string;
    created_at: string;
  }>;

  return (
    <>
      <p className="kicker">Cases</p>
      <h1 className="serif" style={{ fontSize: 52 }}>Disputes</h1>
      <p className="lede">A case is a timeline on the demo ledger. Provisional credit is not a network chargeback. Open a new case from <Link href="/banking/activity">Activity</Link>.</p>
      {disputes.length === 0 ? (
        <div className="empty-state">
          <DeskEmpty />
          <p>No open cases. Dispute a charge from activity when something looks wrong.</p>
        </div>
      ) : disputes.map((dispute) => {
        const timeline = Array.isArray(dispute.timeline)
          ? dispute.timeline
          : (typeof dispute.timeline === "string" ? JSON.parse(dispute.timeline) as TimelineNote[] : []);
        return (
          <article className="panel" key={dispute.id}>
            <div className="row">
              <span>
                {dispute.id}
                <br />
                <span className="meta">{dispute.status} · opened {new Date(dispute.created_at).toLocaleDateString("en-US", { timeZone: "America/New_York" })}</span>
              </span>
              <span className="pill" aria-label={`Status ${dispute.status}`}>{dispute.status}</span>
            </div>
            <p>{dispute.reason}</p>
            <ol className="timeline">
              {timeline.map((note, index) => (
                <li key={`${dispute.id}-${index}`}>
                  <strong>{note.state ?? "Update"}</strong>
                  <span className="meta"> · {note.at ? new Date(note.at).toLocaleString("en-US", { timeZone: "America/New_York" }) : "—"}</span>
                  <br />
                  {note.note}
                </li>
              ))}
            </ol>
          </article>
        );
      })}
      <p><Link className="btn-solid" href="/banking/activity">Open dispute from activity</Link></p>
    </>
  );
}
