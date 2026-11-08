import { formatMoney, formatPct, formatSignedMoney, ageLabel } from "@halcyon/domain";
import type { LiveQuote } from "@halcyon/domain";
import { Sign } from "./marks";

export function Money({ minor, currency = "USD", signed = false }: { minor: number; currency?: string; signed?: boolean }) {
  const text = signed ? formatSignedMoney(minor, currency) : formatMoney(minor, currency);
  return (
    <span className={`num ${minor < 0 ? "loss" : ""}`}>
      {minor < 0 ? <Sign value={minor} /> : null}
      {text}
    </span>
  );
}

export function QuoteStatus({ quote }: { quote: LiveQuote }) {
  return (
    <p className="quote-status">
      <span className="pill">{quote.status}</span>
      <span>{quote.source}</span>
      <span className="num">{ageLabel(quote.asOf)}</span>
      <span className="num">{formatMoney(Math.round(quote.last * 100))} · {formatPct(quote.changePct)}</span>
      {quote.detail ? <span>{quote.detail}</span> : null}
    </p>
  );
}
