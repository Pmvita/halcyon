import { redirect } from "next/navigation";
import { halcyon, requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/home");
  const health = await (await halcyon()).health();
  return (
    <>
      <p className="kicker">Admin</p>
      <h1 className="serif" style={{ fontSize: 48 }}>Desk controls</h1>
      <p>Feature flags: {health.flags.map((flag) => `${flag.key}=${flag.enabled}`).join(", ")}. Impersonation is read-only unless the operate cookie is set, and it is off by default.</p>
      <p>Failed webhooks: none. This demo does not register webhook endpoints.</p>
    </>
  );
}
