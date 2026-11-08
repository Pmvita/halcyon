"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

async function post(href: string, body: Record<string, unknown>) {
  const response = await fetch(href, {
    method: "POST",
    headers: { "content-type": "application/json", "x-halcyon-request": "1" },
    body: JSON.stringify(body),
  });
  return response.json();
}

export function NicknameForm({ accountId, current }: { accountId: string; current: string }) {
  const router = useRouter();
  const [nickname, setNickname] = useState(current);
  const [message, setMessage] = useState("");
  const [confirm, setConfirm] = useState(false);

  async function save() {
    const body = await post("/api/v1/accounts/nickname", { accountId, nickname });
    setMessage(body.message ?? body.error?.message ?? "");
    setConfirm(false);
    router.refresh();
  }

  return (
    <div className="inline-form">
      <label className="field">
        Nickname
        <input aria-label="Account nickname" value={nickname} onChange={(event) => setNickname(event.target.value)} maxLength={40} />
      </label>
      {confirm ? (
        <div className="panel" role="group" aria-label="Confirm nickname">
          <p>Save nickname “{nickname}” for this demo account?</p>
          <button className="btn-solid" type="button" onClick={() => void save()}>Confirm nickname change</button>
          <button className="btn-line" type="button" onClick={() => setConfirm(false)}>Cancel</button>
        </div>
      ) : (
        <button className="btn-line" type="button" onClick={() => setConfirm(true)}>Save nickname</button>
      )}
      {message ? <p role="status">{message}</p> : null}
    </div>
  );
}

export function StatusLine({ message }: { message: string }) {
  if (!message) return null;
  return <p role="status">{message}</p>;
}
