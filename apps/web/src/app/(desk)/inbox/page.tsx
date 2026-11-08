import { halcyon, requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const user = await requireUser();
  const items = await (await halcyon()).inbox(user.id);
  return (
    <>
      <p className="kicker">Inbox</p>
      <h1 className="serif" style={{ fontSize: 52 }}>Messages</h1>
      {items.length === 0 ? <p>The inbox is empty.</p> : items.map((item) => (
        <div className="row" key={String(item.id)}>
          <span>{String(item.title)}<br /><span className="meta">{String(item.kind)} · {String(item.body)}</span></span>
          <span className="meta">{item.read ? "Read" : "Unread"}</span>
        </div>
      ))}
    </>
  );
}
