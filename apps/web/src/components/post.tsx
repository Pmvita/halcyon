"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ExpireButton({ paperId }: { paperId: string }) {
  return <PostButton href="/api/v1/options/expire" body={{ paperId }} confirm="Run the demo expiry cycle for this paper contract. If it is in the money, shares are booked at the strike.">Run expiry</PostButton>;
}

export function PostButton({ href, body, children, confirm }: { href: string; body: Record<string, unknown>; children: string; confirm?: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [review, setReview] = useState(false);
  async function send() {
    const response = await fetch(href, { method: "POST", headers: { "content-type": "application/json", "x-halcyon-request": "1" }, body: JSON.stringify({ ...body, confirmed: true, idempotencyKey: body.idempotencyKey ?? crypto.randomUUID() }) });
    const payload = await response.json();
    setMessage(payload.message ?? payload.error?.message ?? "Done.");
    setReview(false);
    router.refresh();
  }
  if (confirm && !review) {
    return (
      <div>
        <button className="btn-line" type="button" onClick={() => setReview(true)}>{children}</button>
        {message ? <p role="status">{message}</p> : null}
      </div>
    );
  }
  if (confirm && review) {
    return (
      <div className="panel">
        <p>{confirm}</p>
        <button className="btn-solid" type="button" onClick={() => void send()}>Confirm</button>
        <button className="btn-line" type="button" onClick={() => setReview(false)}>Back</button>
      </div>
    );
  }
  return (
    <div>
      <button className="btn-solid" type="button" onClick={() => void send()}>{children}</button>
      {message ? <p role="status">{message}</p> : null}
    </div>
  );
}
