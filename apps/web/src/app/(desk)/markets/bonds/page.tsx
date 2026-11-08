import { halcyon, requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function BondsPage() {
  await requireUser();
  const bonds = await (await halcyon()).bonds();
  return (
    <>
      <p className="kicker">Bond desk</p>
      <h1 className="serif" style={{ fontSize: 52 }}>Treasury ladder</h1>
      <p className="lede">{bonds.note}</p>
      <table className="dense">
        <thead><tr><th>Tenor</th><th>Yield</th><th>Model price</th><th>Duration</th><th>Source</th></tr></thead>
        <tbody>
          {bonds.curve.map((row) => (
            <tr key={row.tenor}>
              <td>{row.tenor}</td>
              <td className="num">{(row.yield * 100).toFixed(2)}%</td>
              <td className="num">{row.price.toFixed(3)}</td>
              <td className="num">{row.duration.toFixed(2)}</td>
              <td>{row.source} · {row.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
