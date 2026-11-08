import Link from "next/link";
import { PostButton } from "@/components/post";
import { halcyon, requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await requireUser();
  const profile = await (await halcyon()).profile(user.id);
  return (
    <>
      <p className="kicker">Profile</p>
      <h1 className="serif" style={{ fontSize: 52 }}>{profile.user.name}</h1>
      <p className="lede">{profile.user.email} · {profile.user.kycStatus} · terms {profile.user.termsVersion ?? "not accepted"}</p>
      <p><Link href="/profile/security">Security</Link> · <Link href="/profile/data-health">Data health</Link> · {user.role === "admin" ? <Link href="/admin">Admin</Link> : null}</p>
      <h2 className="serif">Reset one person</h2>
      <PostButton href="/api/v1/reset" body={{ persona: "andre" }} confirm="Reset Andre only. Maya’s ledger stays.">Reset Andre</PostButton>
      <PostButton href="/api/v1/reset" body={{ persona: "maya" }} confirm="Reset Maya’s ledger and reseed her history. Andre is untouched.">Reset Maya</PostButton>
      <h2 className="serif">Sessions</h2>
      {profile.sessions.map((session) => <p key={String(session.id)} className="meta">{String(session.device)} · {String(session.created_at)}</p>)}
    </>
  );
}
