"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { loginSchema } from "@halcyon/domain";
import { Wordmark } from "@/components/marks";

const PEOPLE = [
  ["Maya Chen", "maya@halcyon.demo", "Eighteen months of household history."],
  ["Andre Walsh", "andre@halcyon.demo", "A new client. No history until you add demo funds."],
];

export default function LoginPage() {
  const router = useRouter();
  const openedAt = useRef(Date.now());
  const [email, setEmail] = useState("maya@halcyon.demo");
  const [password, setPassword] = useState("meridian-desk");
  const [theme, setTheme] = useState("system");
  const [honeypot, setHoneypot] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    openedAt.current = Date.now();
  }, []);

  async function submit(event?: { preventDefault?: () => void }) {
    event?.preventDefault?.();
    setError("");
    const parsed = loginSchema.safeParse({ email, password, theme });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check the email and password.");
      return;
    }
    if (honeypot) {
      setError("Sign-in blocked.");
      return;
    }
    const response = await fetch("/api/v1/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json", "x-halcyon-request": "1" },
      body: JSON.stringify({
        ...parsed.data,
        company: honeypot,
        openedAt: openedAt.current,
      }),
    });
    const body = await response.json();
    if (!response.ok) {
      setError(body.error?.message ?? "Sign-in failed.");
      return;
    }
    localStorage.setItem("halcyon-theme", theme);
    router.push(body.intro ? "/welcome" : "/home");
    router.refresh();
  }

  return (
    <div className="login">
      <section className="login-copy">
        <Wordmark />
        <p className="kicker">One desk</p>
        <h1>Cash, markets, and crypto.</h1>
        <p className="lede">A simulated private client. Balances are journal entries. Market marks that can be fetched are real, and every quote says where it came from.</p>
        <p className="meta" style={{ marginTop: 28 }}>
          <Link href="/legal/privacy">Privacy</Link>
          {" · "}
          <Link href="/legal/terms">Terms</Link>
          {" · "}
          <Link href="/legal/risk">Risk</Link>
        </p>
      </section>
      <form className="login-form" onSubmit={submit} noValidate>
        <p className="kicker">Enter</p>
        <h2 className="serif">Choose a demo person</h2>
        {PEOPLE.map(([name, mail, detail]) => (
          <button key={mail} type="button" className="persona" onClick={() => setEmail(mail)}>
            <span><strong>{name}</strong><br /><span className="meta">{detail}</span></span>
            <span className="meta">{mail}</span>
          </button>
        ))}
        <label className="field">Email
          <input value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" required type="email" inputMode="email" />
        </label>
        <label className="field">Password
          <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" required minLength={8} />
        </label>
        <label className="hp" aria-hidden="true">
          Company
          <input tabIndex={-1} autoComplete="off" value={honeypot} onChange={(event) => setHoneypot(event.target.value)} />
        </label>
        <fieldset className="field">
          <legend>Theme</legend>
          {["system", "light", "dark", "contrast"].map((item) => (
            <label key={item} style={{ marginRight: 12 }}><input type="radio" name="theme" checked={theme === item} onChange={() => setTheme(item)} /> {item}</label>
          ))}
        </fieldset>
        <p className="warn">Demo password: meridian-desk. Do not reuse this password anywhere.</p>
        <p className="meta">Forms include a quiet timing check and CSRF header. Failed attempts lock briefly.</p>
        {error ? <p role="alert">{error}</p> : null}
        <button className="btn-solid" type="submit">Enter the desk</button>
        <p className="meta">Elena Marlowe can sign in at elena@halcyon.demo. An admin desk is at admin@halcyon.demo. Same demo password.</p>
      </form>
    </div>
  );
}
