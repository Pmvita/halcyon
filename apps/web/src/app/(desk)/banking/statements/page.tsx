"use client";

import { useState } from "react";

export default function StatementsPage() {
  const [note, setNote] = useState("");
  async function download(format: "pdf" | "csv") {
    const response = await fetch("/api/v1/statements", { method: "POST", headers: { "content-type": "application/json", "x-halcyon-request": "1" }, body: JSON.stringify({ format }) });
    const file = await response.json();
    if (file.error) { setNote(file.error.message); return; }
    const blob = format === "pdf" ? new Blob([Uint8Array.from(atob(file.body), (char) => char.charCodeAt(0))], { type: file.mime }) : new Blob([file.body], { type: file.mime });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = file.filename;
    anchor.click();
    URL.revokeObjectURL(url);
    setNote(`Downloaded ${file.filename}. It is a specimen.`);
  }
  return (
    <>
      <p className="kicker">Documents</p>
      <h1 className="serif" style={{ fontSize: 52 }}>Statements</h1>
      <p className="lede">Monthly PDF and CSV are generated from the journal. Tax forms in this demo are specimens. Times are America/New_York when labeled on screen.</p>
      <button className="btn-solid" type="button" onClick={() => void download("pdf")}>Download specimen PDF</button>
      <button className="btn-line" type="button" onClick={() => void download("csv")}>Download CSV</button>
      {note ? <p role="status">{note}</p> : null}
    </>
  );
}
