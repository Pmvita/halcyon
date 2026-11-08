export function formatMoney(minor: number, currency = "USD", locale = "en-US"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    currencyDisplay: "symbol",
  }).format(minor / 100);
}

export function formatSignedMoney(minor: number, currency = "USD", locale = "en-US"): string {
  const body = formatMoney(Math.abs(minor), currency, locale);
  if (minor > 0) return `+${body}`;
  if (minor < 0) return `−${body}`;
  return body;
}

export function formatQty(value: number, digits = 4): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatPct(fraction: number, digits = 2): string {
  const pct = fraction * 100;
  const body = `${Math.abs(pct).toFixed(digits)}%`;
  if (pct > 0) return `+${body}`;
  if (pct < 0) return `−${body}`;
  return body;
}

export function formatPlain(value: number, digits = 2): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function ageLabel(iso: string, now = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function formatWhen(iso: string, timeZone = "America/New_York", locale = "en-US"): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(iso));
}

export function quoteLine(parts: { price: string; change?: string; age?: string }): string {
  return [parts.price, parts.change, parts.age].filter(Boolean).join(" · ");
}
