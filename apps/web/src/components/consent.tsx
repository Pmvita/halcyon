"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const KEY = "halcyon-consent";

export function ConsentBanner() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setOpen(true);
    } catch {
      setOpen(true);
    }
  }, []);

  function choose(value: "accepted" | "dismissed") {
    try {
      localStorage.setItem(KEY, value);
    } catch {
      /* ignore quota / private mode */
    }
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div className="consent-banner" role="dialog" aria-modal="false" aria-labelledby="consent-title" aria-describedby="consent-body">
      <div>
        <p id="consent-title" className="kicker">Cookies &amp; storage</p>
        <p id="consent-body">
          Halcyon uses a first-party httpOnly session cookie after you sign in, localStorage for theme and density, sessionStorage for the demo banner, and this consent choice. No ad trackers. See{" "}
          <Link href="/legal/privacy">Privacy</Link> and <Link href="/legal/terms">Terms</Link>.
        </p>
      </div>
      <div className="consent-actions">
        <button type="button" className="btn-solid" onClick={() => choose("accepted")}>
          Accept
        </button>
        <button type="button" className="btn-line" onClick={() => choose("dismissed")}>
          Dismiss
        </button>
      </div>
    </div>
  );
}
