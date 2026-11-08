import { ageLabel, formatWhen } from "@halcyon/domain";
import type { NewsItem } from "@halcyon/domain";

type Meta = {
  source: string;
  status: string;
  asOf: string;
  detail?: string;
};

export function SymbolNews({ items, meta }: { items: NewsItem[]; meta?: Meta }) {
  return (
    <section className="symbol-news">
      <h2 className="serif">News</h2>
      {meta ? (
        <p className="meta">
          <span className="pill">{meta.status}</span> {meta.source}
          {meta.asOf ? ` · ${ageLabel(meta.asOf)}` : null}
          {meta.detail ? ` · ${meta.detail}` : null}
        </p>
      ) : null}
      {items.length === 0 ? (
        <p className="meta">Unavailable · no headlines for this symbol.</p>
      ) : (
        items.map((item) => (
          <article className="news-item" key={`${item.title}-${item.time}`}>
            <a href={item.href} target="_blank" rel="noreferrer">
              {item.title}
            </a>
            <p className="meta">
              <span className="pill">{item.status}</span> {item.source} ·{" "}
              {item.time.includes("T") ? formatWhen(item.time) : item.time}
            </p>
            {item.detail ? <p className="meta">{item.detail}</p> : null}
          </article>
        ))
      )}
    </section>
  );
}
