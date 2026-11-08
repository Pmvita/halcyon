import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Halcyon",
    short_name: "Halcyon",
    description: "One desk for cash, markets, and crypto. A simulated private client.",
    start_url: "/home",
    display: "standalone",
    background_color: "#f4f0e6",
    theme_color: "#f4f0e6",
    icons: [
      { src: "/icon", sizes: "32x32", type: "image/png", purpose: "any" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png", purpose: "any" },
    ],
  };
}
