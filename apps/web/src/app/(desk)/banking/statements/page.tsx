"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DeskEmpty } from "@/components/marks";

type Statement = { id: string; label: string; period: string };
type Download = { id: string; label: string; format: string; created_at: string; kind: string };

export default function StatementsPage() {
  const [note, setNote] = useState("");
  const [statements, setStatements] = useState<Statement[]>([]);
  const [downloads, setDownloads] = useState<Download[]>([]);

  async function load() {
    const body = await fetch("/api/v1/banking", { headers: { "x-halcyon-request": "1" } }).then((response) => response.json());
    setStatements(body.statements ?? []);
    setDownloads(body.documents ?? []);
  }

  useEffect(() => { void load(); }, []);

  async function download(format: "pdf" | "csv", label = "Current specimen") {
    const response = await fetch("/api/v1/statements", {
      method: "POST",
      headers: { "content-type": "application/json", "x-halcyon-request": "1" },
      body: JSON.stringify({ format, label }),
    });
    const file = await response.json();
    if (file.error) {
      setNote(file.error.message);
      return;
    }
    const blob = format === "pdf"
      ? new Blob([Uint8Array.from(atob(file.body), (char) => char.charCodeAt(0))], { type: file.mime })
      : new Blob([file.body], { type: file.mime });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = file.filename;
    anchor.click();
    URL.revokeObjectURL(url);
    setNote(`Downloaded ${file.filename}. ${file.note ?? "It is a specimen."}`);
    await load();
  }

  return (
    <>
      <p className="kicker">Documents</p>
      <h1 className="serif" style={{ fontSize: 52 }}>Statements</h1>
      <p className="lede">Monthly PDF and CSV are generated from the journal. Tax forms here are specimens. Times are America/New_York when labeled on screen.</p>
      <section>
        <h2 className="serif">Monthly list</h2>
        {statements.length === 0 ? (
          <div className="empty-state"><DeskEmpty /><p>No statement periods yet.</p></div>
        ) : statements.map((statement) => (
          <div className="row" key={statement.id}>
            <span>{statement.label}<br /><span className="meta">Specimen · {statement.period}</span></span>
            <span>
              <button className="btn-line" type="button" onClick={() => void download("pdf", statement.label)}>PDF</button>
              <button className="btn-line" type="button" onClick={() => void download("csv", statement.label)}>CSV</button>
            </span>
          </div>
        ))}
      </section>
      <div className="panel">
        <h2 className="serif">Tax specimen</h2>
        <p className="meta">1099-INT / consolidated tax packages in this demo are labeled specimens and are not filed with any authority.</p>
        <button className="btn-solid" type="button" onClick={() => void download("pdf", "Tax specimen 2025")}>Download tax specimen PDF</button>
      </div>
      <div className="panel">
        <h2 className="serif">Download history</h2>
        {downloads.length === 0 ? <p className="meta">No downloads recorded yet.</p> : downloads.map((item) => (
          <div className="row" key={item.id}>
            <span>{item.label}<br /><span className="meta">{item.kind} · {item.format} · {new Date(item.created_at).toLocaleString("en-US", { timeZone: "America/New_York" })}</span></span>
          </div>
        ))}
      </div>
      {note ? <p role="status">{note}</p> : null}
      <p className="meta"><Link href="/legal/privacy">Privacy</Link> · documents are generated on demand from the demo ledger.</p>
    </>
  );
}
