import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Crypto",
  description: "Spot paper quotes, watch-only addresses, and demo earn on the Halcyon desk.",
};

export default function CryptoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
