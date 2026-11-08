import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getHalcyon, type PublicUser } from "@halcyon/server";

export async function halcyon() {
  return getHalcyon();
}

export async function viewer(): Promise<{ user: PublicUser; readOnly: boolean } | null> {
  const jar = await cookies();
  const app = await getHalcyon();
  const user = await app.userByToken(jar.get("halcyon_session")?.value);
  if (!user) return null;
  const view = jar.get("halcyon_view")?.value;
  const operate = jar.get("halcyon_operate")?.value === "1";
  if (view && user.role === "admin") {
    const subject = await app.profile(view).catch(() => null);
    if (subject) return { user: subject.user, readOnly: !operate };
  }
  return { user, readOnly: false };
}

export async function requireUser(): Promise<PublicUser> {
  const found = await viewer();
  if (!found) redirect("/");
  return found.user;
}
