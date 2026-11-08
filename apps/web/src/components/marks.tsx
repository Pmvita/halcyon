export function Wordmark() {
  return (
    <span className="brand">
      <svg width="88" height="16" viewBox="0 0 88 16" aria-hidden="true">
        <path d="M2 13 Q44 1 86 13" fill="none" stroke="currentColor" strokeWidth="1" />
      </svg>
      <b>HALCYON</b>
      <small>Private desk</small>
    </span>
  );
}

export function Meridian({ progress }: { progress: number }) {
  const p = Math.max(0, Math.min(1, progress));
  return (
    <svg viewBox="0 0 240 48" width="240" height="48" role="img" aria-label={`Session mark ${Math.round(p * 100)} percent`}>
      <path d="M8 40 Q120 4 232 40" fill="none" stroke="var(--line)" strokeWidth="1" />
      <path d="M8 40 Q120 4 232 40" fill="none" stroke="var(--gold-bright)" strokeWidth="1.5" strokeDasharray={`${p * 280} 280`} />
    </svg>
  );
}

export function DeskEmpty() {
  return (
    <svg viewBox="0 0 160 80" width="160" height="80" aria-hidden="true">
      <path d="M10 60 H150 M20 60 V30 H70 V60 M90 60 V22 H140 V60" fill="none" stroke="currentColor" strokeWidth="1" />
      <circle cx="40" cy="24" r="6" fill="none" stroke="currentColor" />
      <path d="M110 18 l6 8 l-12 0 z" fill="none" stroke="currentColor" />
    </svg>
  );
}

export function Sign({ value }: { value: number }) {
  if (value < 0) {
    return (
      <span className="sign loss" aria-label="Loss">
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2 6 H10 M7 3 L10 6 L7 9" fill="none" stroke="currentColor" /></svg>
      </span>
    );
  }
  if (value > 0) {
    return (
      <span className="sign profit" aria-label="Gain">
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M6 2 V10 M3 5 L6 2 L9 5" fill="none" stroke="currentColor" /></svg>
      </span>
    );
  }
  return null;
}
