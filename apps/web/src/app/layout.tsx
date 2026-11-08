import type { Metadata, Viewport } from "next";
import { Fraunces, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";
import { DemoBanner } from "@/components/banner";
import { ConsentBanner } from "@/components/consent";
import { RegisterSW } from "@/components/sw";
import { siteUrl } from "@/lib/site";

const sans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-sans",
  display: "swap",
});
const serif = Fraunces({
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
});
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

const base = siteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(base),
  title: { default: "Halcyon — Private desk", template: "%s · Halcyon" },
  description: "One desk for cash, markets, and crypto. A simulated private client with real market marks and journaled balances.",
  applicationName: "Halcyon",
  keywords: ["Halcyon", "private desk", "demo banking", "simulated trading"],
  openGraph: {
    title: "Halcyon — Private desk",
    description: "One desk for cash, markets, and crypto. Simulated balances. Real market data where available.",
    type: "website",
    siteName: "Halcyon",
  },
  twitter: {
    card: "summary",
    title: "Halcyon — Private desk",
    description: "One desk for cash, markets, and crypto. A simulated private client.",
  },
  icons: {
    icon: [{ url: "/icon" }, { url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/apple-icon" }],
  },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#f4f0e6" };

const themeBoot = `try{var t=localStorage.getItem('halcyon-theme')||'system';var d=localStorage.getItem('halcyon-density')||'comfortable';var dark=matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.dataset.theme=t==='system'?(dark?'dark':'light'):t;document.documentElement.dataset.density=d;}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable} ${mono.variable}`} suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
        <a className="skip" href="#main">Skip to content</a>
        <DemoBanner />
        <RegisterSW />
        {children}
        <ConsentBanner />
      </body>
    </html>
  );
}
