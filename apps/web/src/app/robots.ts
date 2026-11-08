import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/legal/"],
        disallow: [
          "/home",
          "/banking",
          "/markets",
          "/crypto",
          "/plan",
          "/inbox",
          "/profile",
          "/admin",
          "/sandbox",
          "/welcome",
          "/api/",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
