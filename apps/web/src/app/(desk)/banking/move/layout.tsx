import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pay and transfer",
  description: "Move simulated balances on the Halcyon ledger. Domestic only.",
};

export default function MoveLayout({ children }: { children: React.ReactNode }) {
  return children;
}
