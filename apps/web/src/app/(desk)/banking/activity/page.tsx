import type { Metadata } from "next";
import { ActivityClient } from "./activity-client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Activity",
  description: "Search and filter banking ledger activity on Halcyon.",
};

export default async function ActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ accountId?: string; category?: string }>;
}) {
  const params = await searchParams;
  return <ActivityClient initialAccountId={params.accountId ?? ""} initialCategory={params.category ?? ""} />;
}
