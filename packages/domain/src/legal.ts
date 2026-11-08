import { LEGAL_VERSION } from "./schemas";

export type LegalDoc = { slug: string; title: string; version: string; paragraphs: string[] };

export const LEGAL: LegalDoc[] = [
  {
    slug: "terms",
    title: "Terms of Service",
    version: LEGAL_VERSION,
    paragraphs: [
      "Halcyon is a demonstration. It is operated as a software simulation of a private bank and trading desk. It is not a bank, broker-dealer, money transmitter, commodity advisor, or crypto custodian.",
      "No deposits are held. No customer funds are taken. No FDIC, SIPC, or equivalent protection applies, because there is nothing to insure. Balances, cards, transfers, and trades exist only on an internal ledger.",
      "No order is sent to an exchange or a broker. The only exception is an optional mirror to Alpaca paper trading when the operator has placed paper keys in server environment variables. If those keys are absent, the interface does not mention Alpaca and the internal engine is the only venue.",
      "Quotes can be delayed, wrong, cached, or unavailable. Model bond prices are not dealer quotes. You should not rely on Halcyon for a real financial decision.",
      "The operator may reset demo data, take the service offline, or change the simulation. Acceptance of these terms is stored with a timestamp and asked again when the version changes.",
    ],
  },
  {
    slug: "privacy",
    title: "Privacy",
    version: LEGAL_VERSION,
    paragraphs: [
      "The demo stores a profile, a password hash, optional simulated KYC images, the ledger, device session records, and inbox items. Images you upload for the fake identity check stay in the demo data directory and are deleted when you reset or delete the persona.",
      "Halcyon does not sell data and does not use it for advertising. There are no third-party trackers. A first-party, cookieless analytics toggle is off by default and, if you turn it on, stores only anonymous event counts in this browser.",
      "Provider API keys, if you add them later, live in server environment variables. They are not written into the browser. The data-health page shows budgets and errors, never secrets.",
      "You can reset one persona without touching the other, or delete the local data directory. Retention is the life of this demo install. The contact method is the in-app outbox. This build does not send real email.",
    ],
  },
  {
    slug: "risk",
    title: "Risk disclosure",
    version: LEGAL_VERSION,
    paragraphs: [
      "Markets lose money. A demo profit is not evidence that a live trade would have worked. Past prices in the replay tape are not a forecast.",
      "Options can expire worthless. The chain is a teaching model with a visible interest rate and a default or edited implied volatility. It is not a live OPRA feed, and the delay badge stays on.",
      "The perpetual simulator can liquidate the demo position. Leverage is capped at 5x. Funding is charged on an 8-hour demo clock. It is marked Education simulator and is not connected to an exchange.",
      "Crypto prices move at all hours. Stablecoin balances here are ledger positions, not a promise that anyone will redeem them. A watched public address is display-only.",
      "Nothing in Halcyon is a solicitation or personal advice. Help search will refuse a question about what you should buy.",
    ],
  },
  {
    slug: "fees",
    title: "Fee schedule",
    version: LEGAL_VERSION,
    paragraphs: [
      "Equities and ETFs: $0 commission. A regulatory-style pass-through of $0.0002 per share is posted, with a one-cent minimum, so you can see a fee line even when commission is zero.",
      "Listed options, paper only: $0.05 per contract. Crypto spot: 10 basis points taker, 4 basis points maker. FX conversion: the mid-market rate plus a visible 0.40% demo spread. Domestic wire: $15, quoted before you send. Overdraft, if you enable it: $25, shown before you confirm.",
      "High-yield savings accrues a posted demo APY of 4.15%, credited on the ledger when you open the desk on a new day. It is not a quoted bank rate. Debit rewards credit 1% of settled spend-simulator volume.",
      "International transfers do not complete. You can see a quote and a demo-corridor notice. No SWIFT success is invented.",
    ],
  },
  {
    slug: "attribution",
    title: "Data attribution",
    version: LEGAL_VERSION,
    paragraphs: [
      "Crypto tickers and OHLC try CoinGecko, then CoinCap, then Binance public REST for symbols Binance lists. A public Binance WebSocket is used only for symbols you are viewing, and it falls back to polling. Their terms apply to their data.",
      "Bitcoin fee estimates come from the mempool.space public API. Address watches for Bitcoin use that same public API. Ethereum watches use a public explorer response and are cached. Halcyon does not proxy arbitrary URLs.",
      "Foreign exchange daily rates come from Frankfurter, which republishes European Central Bank reference rates. Those rates are labeled as reference rates.",
      "Yields and policy series come from FRED public files when the fetch succeeds, cached for 12 hours. If FRED is unreachable, the curve shipped with the demo is labeled as a snapshot.",
      "US stock quotes use Finnhub when FINNHUB_API_KEY is set, then Alpha Vantage when its key is set, then a versioned end-of-day snapshot shipped in this repository. News and profiles follow the same order. Names and sectors that free APIs will not serve in bulk come from that snapshot.",
      "Optional order mirrors use Alpaca paper only when ALPACA_PAPER_KEY and ALPACA_PAPER_SECRET are both set on the server.",
    ],
  },
  {
    slug: "continuity",
    title: "Business continuity",
    version: LEGAL_VERSION,
    paragraphs: [
      "This demo may be unavailable, slow, or reset without notice. It is not a system of record for real money, because it holds none.",
      "Balances can be restored only from demo backups of the local data directory or the optional Postgres database. There is no consumer restoration desk and no regulator to call.",
      "If a provider is down, you will see the last cached or shipped value with an honest status, or Unavailable when nothing is stored.",
    ],
  },
  {
    slug: "simulation",
    title: "How the simulation works",
    version: LEGAL_VERSION,
    paragraphs: [
      "The journal is append-only. A mistake is corrected with a reversal entry that points at the original. Idempotency keys stop a double post when a request is retried. Each account has a running balance from the sum of its lines.",
      "US equity orders fill on HALCYON-SIM against the latest eligible price plus the spread and slippage model described in Help. Partial fills happen when the order is larger than the configured book depth. Cancels, rejects, and fills are kept.",
      "On weekends and holidays the cash session is closed and the tape is marked Session replay. Trading stays on so the demo is usable. The path is synthetic around the shipped close, and the label says so. Crypto does not use that clock.",
      "Each market-data provider has a rate budget: requests per minute, per day, and a concurrency cap, taken from a config file. Identical in-flight requests are coalesced. When the budget is gone, the cache is served and the screen says so.",
    ],
  },
  {
    slug: "faq",
    title: "FAQ",
    version: LEGAL_VERSION,
    paragraphs: [
      "Why do card numbers start with 9999? So they are obviously fake. They pass the Luhn check for form practice. 9999 is not an assigned issuer identification number, and a real terminal would not route them. Halcyon does not talk to a card network.",
      "Can I deposit a real check or connect a bank login? No. Mobile deposit stores the image locally and follows a scripted availability schedule. A file whose name contains “blur” is rejected on purpose. Halcyon never asks for a bank password, a government ID that you actually use, or a social security number.",
      "Is the credit score real? No. The credit snapshot is a self-reported number for education. No credit file is pulled.",
      "What is the household view? Maya Chen shares a joint account and household bills with a linked partner. Private accounts stay off that view. Resetting Maya does not reset Andre.",
    ],
  },
];

export function legalBySlug(slug: string): LegalDoc | undefined {
  return LEGAL.find((doc) => doc.slug === slug);
}
