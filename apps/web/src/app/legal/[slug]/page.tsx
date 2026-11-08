import type { Metadata } from "next";
import Link from "next/link";
import { legalBySlug, LEGAL } from "@halcyon/domain";
import { notFound } from "next/navigation";
import { Wordmark } from "@/components/marks";

export function generateStaticParams() {
  return LEGAL.map((doc) => ({ slug: doc.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const doc = legalBySlug(slug);
  if (!doc) return { title: "Legal" };
  return {
    title: doc.title,
    description: doc.paragraphs[0]?.slice(0, 155) ?? `${doc.title} for the Halcyon demo desk.`,
    robots: { index: true, follow: true },
  };
}

export default async function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = legalBySlug(slug);
  if (!doc) notFound();
  return (
    <main id="main" className="shell-main">
      <p style={{ marginBottom: 24 }}><Link href="/" className="brand"><Wordmark /></Link></p>
      <p className="kicker">Version {doc.version}</p>
      <h1 className="serif" style={{ fontSize: 56 }}>{doc.title}</h1>
      {doc.paragraphs.map((paragraph) => <p key={paragraph.slice(0, 24)}>{paragraph}</p>)}
      <nav className="footer" aria-label="Legal" style={{ paddingLeft: 0, borderTop: "1px solid var(--line)", marginTop: 32 }}>
        {LEGAL.map((item) => (
          <Link key={item.slug} href={`/legal/${item.slug}`} aria-current={item.slug === slug ? "page" : undefined}>
            {item.title}
          </Link>
        ))}
      </nav>
      <p><Link href="/">Back to sign in</Link> · <Link href="/home">Desk</Link></p>
    </main>
  );
}
