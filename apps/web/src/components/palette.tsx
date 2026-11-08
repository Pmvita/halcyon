"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Hit = { href: string; label: string; detail?: string };

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const router = useRouter();
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    if (!open) return;
    const handle = setTimeout(() => {
      void fetch(`/api/v1/search?q=${encodeURIComponent(q)}`, { headers: { "x-halcyon-request": "1" } })
        .then((response) => response.json())
        .then((body) => {
          const next: Hit[] = [
            { href: "/banking/move", label: "Pay or transfer" },
            { href: "/markets/AAPL", label: "AAPL" },
            { href: "/legal/fees", label: "Fee schedule" },
          ];
          for (const symbol of body.symbols ?? []) next.push({ href: `/markets/${symbol.symbol}`, label: symbol.symbol, detail: symbol.name });
          for (const coin of body.coins ?? []) next.push({ href: `/crypto`, label: coin.symbol, detail: coin.name });
          for (const tx of body.transactions ?? []) next.push({ href: "/banking", label: tx.memo });
          setHits(next.slice(0, 8));
        })
        .catch(() => setHits([]));
    }, 120);
    return () => clearTimeout(handle);
  }, [q, open]);
  if (!open) return <button className="tool" type="button" onClick={() => setOpen(true)}>Search</button>;
  return (
    <>
      <button className="scrim" aria-label="Close search" onClick={() => setOpen(false)} />
      <div className="palette" role="dialog" aria-label="Command palette">
        <input autoFocus value={q} onChange={(event) => setQ(event.target.value)} placeholder="Payee, symbol, account, or action" aria-label="Search Halcyon" />
        {hits.map((hit) => (
          <button key={hit.href + hit.label} className="row" type="button" onClick={() => { setOpen(false); router.push(hit.href); }}>
            <span>{hit.label}</span>
            <span className="meta">{hit.detail}</span>
          </button>
        ))}
      </div>
    </>
  );
}

export function ThemeControls({ theme, density }: { theme: string; density: string }) {
  const router = useRouter();
  async function save(patch: Record<string, string>) {
    await fetch("/api/v1/profile", { method: "POST", headers: { "content-type": "application/json", "x-halcyon-request": "1" }, body: JSON.stringify(patch) });
    if (patch.theme) {
      const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      document.documentElement.dataset.theme = patch.theme === "system" ? (dark ? "dark" : "light") : patch.theme;
      localStorage.setItem("halcyon-theme", patch.theme);
    }
    if (patch.density) {
      document.documentElement.dataset.density = patch.density;
      localStorage.setItem("halcyon-density", patch.density);
    }
    router.refresh();
  }
  return (
    <span className="prefs">
      <label className="meta">Theme
        <select aria-label="Theme" value={theme} onChange={(event) => void save({ theme: event.target.value })}>
          <option value="system">System</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
          <option value="contrast">High contrast</option>
        </select>
      </label>
      <label className="meta">Density
        <select aria-label="Density" value={density} onChange={(event) => void save({ density: event.target.value })}>
          <option value="comfortable">Comfortable</option>
          <option value="terminal">Terminal</option>
        </select>
      </label>
    </span>
  );
}
