import Link from "next/link";
import { Wordmark } from "@/components/marks";

export default function NotFound() {
  return (
    <main id="main" className="shell-main" style={{ minHeight: "70vh", display: "grid", alignContent: "center", gap: 12 }}>
      <Wordmark />
      <p className="kicker">404</p>
      <h1 className="serif" style={{ fontSize: "clamp(40px, 7vw, 72px)", margin: 0 }}>
        That page is not on this desk.
      </h1>
      <p className="lede">The route may have moved, or you need to sign in before the desk will show it.</p>
      <p style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        <Link className="btn-solid" href="/">Sign in</Link>
        <Link className="btn-line" href="/home">Open desk</Link>
        <Link className="btn-line" href="/legal/privacy">Privacy</Link>
      </p>
    </main>
  );
}
