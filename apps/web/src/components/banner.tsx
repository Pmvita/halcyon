"use client";

import { useEffect, useState } from "react";

export function DemoBanner() {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    if (sessionStorage.getItem("halcyon-banner") === "hidden") setOpen(false);
  }, []);
  if (!open) {
    return (
      <button className="demo-chip" type="button" onClick={() => { sessionStorage.removeItem("halcyon-banner"); setOpen(true); }}>
        Halcyon Demo
      </button>
    );
  }
  return (
    <div className="demo-banner" role="region" aria-label="Demo disclosure">
      <span>Halcyon Demo · Simulated balances · Real market data.</span>
      <button type="button" className="btn" onClick={() => { sessionStorage.setItem("halcyon-banner", "hidden"); setOpen(false); }}>
        Dismiss
      </button>
    </div>
  );
}
