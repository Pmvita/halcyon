import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Enter the Halcyon demo desk. Simulated balances. Real market data where available.",
  robots: { index: true, follow: true },
};

export default function GateLayout({ children }: { children: React.ReactNode }) {
  return children;
}
