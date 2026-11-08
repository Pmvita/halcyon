import Link from "next/link";
import { ThemeControls } from "@/components/palette";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ProfileSettingsPage() {
  const user = await requireUser();
  return (
    <>
      <p className="kicker"><Link href="/profile">Profile</Link> · Settings</p>
      <h1 className="serif" style={{ fontSize: 48 }}>Settings</h1>
      <p className="lede">Appearance preferences for this desk. Changes save to your profile and sync across sessions.</p>
      <h2 className="serif">Appearance</h2>
      <ThemeControls theme={user.theme} density={user.density} />
    </>
  );
}
