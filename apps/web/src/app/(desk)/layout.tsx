import Link from "next/link";
import { equitySession } from "@halcyon/domain";
import { Wordmark } from "@/components/marks";
import { CommandPalette, ThemeControls } from "@/components/palette";
import { requireUser, halcyon } from "@/lib/session";
import { LEGAL } from "@halcyon/domain";

const LINKS = [
  ["/home", "Home"],
  ["/banking", "Banking"],
  ["/markets", "Markets"],
  ["/crypto", "Crypto"],
  ["/plan", "Plan"],
];

export default async function DeskLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const app = await halcyon();
  const inbox = await app.inbox(user.id);
  const unread = inbox.filter((item) => item.read === false).length;
  const session = equitySession(new Date(), user.replayEnabled);
  return (
    <>
      <header className="mast">
        <Link href="/home" className="brand"><Wordmark /></Link>
        <nav className="nav-main" aria-label="Primary">
          {LINKS.map(([href, label]) => (
            <Link key={href} href={href}>{label}</Link>
          ))}
        </nav>
        <div className="tools">
          <CommandPalette />
          <Link className="tool" href="/inbox">Inbox{unread ? ` (${unread})` : ""}</Link>
          <ThemeControls theme={user.theme} density={user.density} />
          <Link className="tool" href="/profile">{user.name.split(" ")[0]}</Link>
        </div>
      </header>
      <p className="session-strip">
        <span>{session.label} · America/New_York</span>
        <span>Venue HALCYON-SIM · no customer funds</span>
      </p>
      <main id="main" className="shell-main">{children}</main>
      <nav className="thumb" aria-label="Primary mobile">
        {LINKS.map(([href, label]) => <Link key={href} href={href}>{label}</Link>)}
      </nav>
      <footer className="footer">
        {LEGAL.map((doc) => <Link key={doc.slug} href={`/legal/${doc.slug}`}>{doc.title}</Link>)}
        <Link href="/sandbox">Sandbox</Link>
        <Link href="/profile/data-health">Data health</Link>
      </footer>
    </>
  );
}
