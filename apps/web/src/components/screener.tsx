"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatPct } from "@halcyon/domain";

export type ScreenerRow = {
  symbol: string;
  name: string;
  assetClass: string;
  sector: string;
  close: number;
  last: number;
  changePct: number;
  dividendYield: number;
  status: string;
  source: string;
  proxy?: string;
};

type SortKey = "symbol" | "last" | "changePct" | "dividendYield" | "sector";

export function MarketsScreener({ rows }: { rows: ScreenerRow[] }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("symbol");
  const [dir, setDir] = useState<"asc" | "desc">("asc");
  const [klass, setKlass] = useState("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = rows.filter((row) => {
      if (klass !== "all" && row.assetClass !== klass) return false;
      if (!q) return true;
      return row.symbol.toLowerCase().includes(q) || row.name.toLowerCase().includes(q) || row.sector.toLowerCase().includes(q);
    });
    list.sort((a, b) => {
      const av = a[sort];
      const bv = b[sort];
      const cmp = typeof av === "string" && typeof bv === "string" ? av.localeCompare(bv) : Number(av) - Number(bv);
      return dir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [rows, query, sort, dir, klass]);

  function toggle(key: SortKey) {
    if (sort === key) setDir((value) => (value === "asc" ? "desc" : "asc"));
    else {
      setSort(key);
      setDir(key === "symbol" || key === "sector" ? "asc" : "desc");
    }
  }

  return (
    <section className="screener">
      <div className="screener-controls">
        <label className="field">
          Search
          <input
            aria-label="Search markets"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Symbol, name, sector"
          />
        </label>
        <label className="field">
          Class
          <select aria-label="Asset class" value={klass} onChange={(event) => setKlass(event.target.value)}>
            <option value="all">All</option>
            <option value="equity">Equity</option>
            <option value="etf">ETF</option>
            <option value="commodity">Commodity</option>
          </select>
        </label>
      </div>
      <table className="dense screener-table">
        <thead>
          <tr>
            <th><button type="button" className="sort" onClick={() => toggle("symbol")}>Symbol</button></th>
            <th className="extra">Name</th>
            <th><button type="button" className="sort" onClick={() => toggle("sector")}>Sector</button></th>
            <th><button type="button" className="sort" onClick={() => toggle("last")}>Last</button></th>
            <th><button type="button" className="sort" onClick={() => toggle("changePct")}>Chg</button></th>
            <th><button type="button" className="sort" onClick={() => toggle("dividendYield")}>Yield</button></th>
            <th>Quote</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((row) => (
            <tr key={row.symbol}>
              <td>
                <Link href={`/markets/${row.symbol}`}>{row.symbol}</Link>
                {row.proxy ? <span className="meta"> {row.proxy}</span> : null}
              </td>
              <td className="extra">{row.name}</td>
              <td>{row.sector}</td>
              <td className="num">{row.last.toFixed(2)}</td>
              <td className={`num ${row.changePct < 0 ? "loss" : row.changePct > 0 ? "profit" : ""}`}>{formatPct(row.changePct)}</td>
              <td className="num">{(row.dividendYield * 100).toFixed(2)}%</td>
              <td><span className="pill">{row.status}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="meta">{filtered.length} instruments · click a row to open the desk</p>
    </section>
  );
}
