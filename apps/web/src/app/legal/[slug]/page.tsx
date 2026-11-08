import Link from "next/link";
import { legalBySlug, LEGAL } from "@halcyon/domain";
import { notFound } from "next/navigation";

export function generateStaticParams() {
  return LEGAL.map((doc) => ({ slug: doc.slug }));
}

export default async function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = legalBySlug(slug);
  if (!doc) notFound();
  return (
    <main className="shell-main">
      <p className="kicker">Version {doc.version}</p>
      <h1 className="serif" style={{ fontSize: 56 }}>{doc.title}</h1>
      {doc.paragraphs.map((paragraph) => <p key={paragraph.slice(0, 24)}>{paragraph}</p>)}
      <p><Link href="/">Back to sign in</Link> · <Link href="/home">Desk</Link></p>
    </main>
  );
}
