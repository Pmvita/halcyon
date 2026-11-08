const HOLIDAYS = new Set([
  "2025-01-01",
  "2025-01-20",
  "2025-02-17",
  "2025-04-18",
  "2025-05-26",
  "2025-06-19",
  "2025-07-04",
  "2025-09-01",
  "2025-11-27",
  "2025-12-25",
  "2026-01-01",
  "2026-01-19",
  "2026-02-16",
  "2026-04-03",
  "2026-05-25",
  "2026-06-19",
  "2026-07-03",
  "2026-09-07",
  "2026-11-26",
  "2026-12-25",
  "2027-01-01",
  "2027-01-18",
  "2027-02-15",
  "2027-03-26",
  "2027-05-31",
  "2027-06-18",
  "2027-07-05",
  "2027-09-06",
  "2027-11-25",
  "2027-12-24",
]);

export type NyParts = {
  year: string;
  month: string;
  day: string;
  hour: number;
  minute: number;
  weekday: string;
  isoDate: string;
};

export function nyParts(date: Date): NyParts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const bag: Record<string, string> = {};
  for (const part of fmt.formatToParts(date)) bag[part.type] = part.value;
  const hour = Number(bag.hour);
  return {
    year: bag.year ?? "0000",
    month: bag.month ?? "01",
    day: bag.day ?? "01",
    hour: hour === 24 ? 0 : hour,
    minute: Number(bag.minute ?? "0"),
    weekday: bag.weekday ?? "",
    isoDate: `${bag.year}-${bag.month}-${bag.day}`,
  };
}

export type SessionMode = "open" | "replay" | "closed" | "always" | "reference";

export function equitySession(date: Date, replayEnabled = true): { mode: SessionMode; label: string; tradable: boolean } {
  const parts = nyParts(date);
  const weekend = parts.weekday === "Sat" || parts.weekday === "Sun";
  const holiday = HOLIDAYS.has(parts.isoDate);
  const minutes = parts.hour * 60 + parts.minute;
  const cashOpen = !weekend && !holiday && minutes >= 9 * 60 + 30 && minutes < 16 * 60;
  if (cashOpen) return { mode: "open", label: "US cash session", tradable: true };
  if (replayEnabled) {
    return {
      mode: "replay",
      label: weekend || holiday ? "Session replay" : "Session replay · extended",
      tradable: true,
    };
  }
  return { mode: "closed", label: "Cash session closed", tradable: false };
}

export function isBusinessDay(date: Date): boolean {
  const parts = nyParts(date);
  if (parts.weekday === "Sat" || parts.weekday === "Sun") return false;
  return !HOLIDAYS.has(parts.isoDate);
}

export function nextBusinessMorning(from: Date): Date {
  const cursor = new Date(from.getTime());
  cursor.setUTCHours(cursor.getUTCHours() + 18);
  for (let i = 0; i < 14; i += 1) {
    const probe = new Date(from.getTime() + (i + 1) * 86_400_000);
    if (isBusinessDay(probe)) {
      const parts = nyParts(probe);
      return new Date(`${parts.isoDate}T14:00:00.000Z`);
    }
  }
  return new Date(from.getTime() + 3 * 86_400_000);
}

/** Synthetic path around an official close. The close is the anchor; the path is labeled replay. */
export function replayPrice(close: number, at: Date): number {
  const parts = nyParts(at);
  const minutes = parts.hour * 60 + parts.minute;
  const wobble = Math.sin((minutes / 1440) * Math.PI * 8) * 0.0035 + Math.cos((minutes / 1440) * Math.PI * 3) * 0.0012;
  return close * (1 + wobble);
}

export function wireSameDay(date: Date): boolean {
  const parts = nyParts(date);
  if (!isBusinessDay(date)) return false;
  return parts.hour < 15;
}
