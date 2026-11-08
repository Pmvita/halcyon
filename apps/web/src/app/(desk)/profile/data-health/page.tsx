import { halcyon, requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function HealthPage() {
  await requireUser();
  const health = await (await halcyon()).health();
  return (
    <>
      <p className="kicker">Data health</p>
      <h1 className="serif" style={{ fontSize: 48 }}>Providers</h1>
      <p className="lede">Budgets and last errors. No secrets are shown on this page.</p>
      <table className="dense">
        <thead><tr><th>Provider</th><th>Minute</th><th>Upstream</th><th>Last error</th></tr></thead>
        <tbody>
          {health.providers.map((provider) => (
            <tr key={provider.id}>
              <td>{provider.id}</td>
              <td className="num">{provider.usedMinute}/{provider.perMinute}</td>
              <td className="num">{provider.upstreamCalls}</td>
              <td>{provider.lastError || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
