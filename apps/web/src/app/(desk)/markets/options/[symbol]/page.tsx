import { halcyon, requireUser } from "@/lib/session";
import { ExpireButton } from "@/components/post";

export const dynamic = "force-dynamic";

export default async function OptionsPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const user = await requireUser();
  const chain = await (await halcyon()).options(user.id, symbol);
  const max = Math.max(...chain.payoff.map((point) => Math.abs(point.value)), 1);
  return (
    <>
      <p className="kicker">{chain.delay}</p>
      <h1 className="serif" style={{ fontSize: 52 }}>{symbol.toUpperCase()} options</h1>
      <p className="lede">Black–Scholes with rate {(chain.rate * 100).toFixed(2)}% and IV {(chain.iv * 100).toFixed(0)}%. Educational paper. Not an OPRA feed.</p>
      <svg viewBox="0 0 320 120" width="100%" height="140" role="img" aria-label="Payoff at expiration">
        <path d={chain.payoff.map((point, index) => `${index === 0 ? "M" : "L"} ${(index / (chain.payoff.length - 1)) * 320} ${60 - (point.value / max) * 50}`).join(" ")} fill="none" stroke="currentColor" />
      </svg>
      <table className="dense">
        <thead><tr><th>Type</th><th>Strike</th><th>Model</th><th>Delta</th></tr></thead>
        <tbody>
          {chain.chain.map((row) => (
            <tr key={`${row.type}-${row.strike}`}><td>{row.type}</td><td className="num">{row.strike}</td><td className="num">{row.price.toFixed(2)}</td><td className="num">{row.delta.toFixed(2)}</td></tr>
          ))}
        </tbody>
      </table>
      {chain.paper.map((paper) => (
        <div key={String(paper.id)} className="panel">
          <p>{String(paper.underlying)} {String(paper.contract_type)} {String(paper.strike)} · {String(paper.status)}</p>
          <ExpireButton paperId={String(paper.id)} />
        </div>
      ))}
    </>
  );
}
