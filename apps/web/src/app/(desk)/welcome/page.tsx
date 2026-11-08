"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export default function WelcomePage() {
  const router = useRouter();
  async function enter() {
    await fetch("/api/v1/profile", { method: "POST", headers: { "content-type": "application/json", "x-halcyon-request": "1" }, body: JSON.stringify({ introSeen: true, terms: true }) });
    router.push("/home");
    router.refresh();
  }
  return (
    <>
      <p className="kicker">Three steps</p>
      <h1>Cash. Invest. Crypto.</h1>
      <div className="figures">
        <article><span>Cash</span><strong className="serif">Move it on the ledger</strong></article>
        <article><span>Invest</span><strong className="serif">Fill against the tape</strong></article>
        <article><span>Crypto</span><strong className="serif">Watch, don’t custody</strong></article>
      </div>
      <p className="lede">
        Entering accepts the current{" "}
        <Link href="/legal/terms">Terms</Link>
        {" "}and{" "}
        <Link href="/legal/privacy">Privacy</Link>
        {" "}notice for this demo desk.
      </p>
      <button className="btn-solid" type="button" onClick={() => void enter()}>Enter the desk</button>
    </>
  );
}
