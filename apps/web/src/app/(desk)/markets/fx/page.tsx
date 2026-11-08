import { QuoteStatus } from "@/components/money";
import { halcyon, requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const PAIRS = ["EURUSD", "GBPUSD", "USDJPY", "USDCHF"];

export default async function FxPage() {
  const user = await requireUser();
  const app = await halcyon();
  const quotes = [];
  for (const pair of PAIRS) quotes.push(await app.quotes.quote(pair, "page", user.replayEnabled));
  return (
    <>
      <p className="kicker">FX</p>
      <h1 className="serif" style={{ fontSize: 52 }}>Reference rates</h1>
      <p className="lede">Frankfurter republishes ECB reference rates. When only a mid is known, Halcyon shows an indicative 1 pip spread and says so. Conversion inside the ledger adds the 0.40% demo spread.</p>
      {quotes.map((quote) => (
        <div key={quote.symbol} className="panel">
          <strong>{quote.symbol}</strong>
          <QuoteStatus quote={quote} />
        </div>
      ))}
    </>
  );
}
