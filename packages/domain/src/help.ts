export type HelpArticle = { id: string; title: string; body: string };

export const HELP: HelpArticle[] = [
  {
    id: "simulation",
    title: "How the simulation works",
    body: "Halcyon keeps an append-only double-entry journal. Transfers, fees, interest, and trade cash all post there. Securities and coins are tracked as tax lots beside that cash. Nothing is sent to a bank, a broker, or a chain, except an optional Alpaca paper mirror when server keys exist. The venue code on every fill is HALCYON-SIM.",
  },
  {
    id: "sessions",
    title: "Sessions and weekend replay",
    body: "US equities trade 9:30 to 16:00 America/New_York on weekdays that are not exchange holidays. When that session is closed, weekend clock mode is on by default. The tape is labeled Session replay. Prices walk a small synthetic path around the shipped official close so a limit can fill while you are reviewing the demo. Crypto is 24/7. FX outside the published day is a reference rate.",
  },
  {
    id: "slippage",
    title: "Spread and slippage",
    body: "If a provider sends a bid and ask, Halcyon uses them. Otherwise it synthesizes a spread: equities 1 to 5 basis points by price tier, FX 1 pip on majors when only a mid is known, crypto a tight default when the public book is not used. Marketable orders fill at the far side plus a size curve: about 0.5 basis points near $1,000 of notional, rising with the square root, capped at 15 basis points. Limits never fill through their limit.",
  },
  {
    id: "fees",
    title: "Fee schedule",
    body: "Equities and ETFs have $0 commission and a small regulatory-style pass-through of $0.0002 per share, minimum one cent. Options are $0.05 per contract. Crypto is 10 basis points for a taker and 4 for a maker. Domestic wires quote a $15 fee before send. Currency conversion uses the displayed mid plus a 0.40% demo spread. Card rewards post 1% of settled simulator spend. You can read the same numbers on the fee schedule page.",
  },
  {
    id: "good-faith",
    title: "Buying power and good faith",
    body: "Buying power is settled cash. Proceeds from a sale stay unsettled until the next business morning, which is the demo stand-in for a good-faith window. The pattern-day-trader flag is educational. It appears inside the simulation only and does not contact a real broker.",
  },
  {
    id: "quotes",
    title: "Why a quote says cached or delayed",
    body: "Every quote shows a source, an age, and a status: Live, Cached, Delayed, Stale, or Unavailable. Options stay Delayed because this demo does not take a live options feed. Treasury prices are model prices, not dealer quotes. If a provider budget is spent, Halcyon serves the last cached value and tells you when it may refresh. The browser never holds provider keys.",
  },
  {
    id: "cards",
    title: "Demo card numbers",
    body: "Virtual debit numbers start with 9999 and pass the Luhn check so forms can validate them. 9999 is not a real issuer BIN. Halcyon is not a card network. Reveal requires step-up. The spend simulator creates a pending hold, then you settle or let it expire.",
  },
  {
    id: "crypto",
    title: "Watch-only coins",
    body: "A watch-only address is read from a public explorer. Halcyon cannot move those coins. It will never ask for a seed phrase or a private key. Demo deposits generate a labeled fake address. Earn rewards and perpetual funding are demo units on the internal ledger.",
  },
  {
    id: "advice",
    title: "What help search will not do",
    body: "Help search answers from these articles and from your own demo figures. It will not say what to buy, sell, or hold. Nothing in Halcyon is a solicitation or personal advice.",
  },
  {
    id: "limits",
    title: "Limits and holds",
    body: "Sending $5,000 or more asks for step-up. The daily demo send limit is $50,000. A payment over that limit is held and the reason is shown. Overdraft is off unless you turn it on. If it is on, a linked savings account can cover checking, and the fee is shown before you confirm.",
  },
];

const REFUSALS = [/what should i buy/i, /should i sell/i, /which stock/i, /guarantee/i, /financial advice/i];

export function answerHelp(query: string, figures: string[] = []): { text: string; articles: HelpArticle[] } {
  const q = query.trim();
  if (!q) return { text: "Search the desk guides.", articles: HELP.slice(0, 4) };
  if (REFUSALS.some((pattern) => pattern.test(q))) {
    return {
      text: "Help search cannot recommend a trade. This is not a financial adviser. Try a question about fees, sessions, or your demo balances.",
      articles: HELP.filter((article) => article.id === "advice" || article.id === "simulation"),
    };
  }
  const terms = q.toLowerCase().split(/\s+/).filter((term) => term.length > 2);
  const articles = HELP.filter((article) => terms.some((term) => `${article.title} ${article.body}`.toLowerCase().includes(term))).slice(0, 4);
  const figure = figures.find((line) => terms.some((term) => line.toLowerCase().includes(term)));
  const lead = articles[0]?.body ?? "No guide matches that. Try fees, replay, cards, or buying power.";
  return { text: figure ? `${lead} From your demo ledger: ${figure}` : lead, articles: articles.length ? articles : HELP.slice(0, 3) };
}
