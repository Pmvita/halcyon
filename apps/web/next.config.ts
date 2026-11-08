import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";
const scriptSrc = ["'self'", "'unsafe-inline'", isDev ? "'unsafe-eval'" : ""].filter(Boolean).join(" ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: `default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src ${scriptSrc}; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'` },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  ...(isDev
    ? []
    : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]),
];

const nextConfig: NextConfig = {
  transpilePackages: ["@halcyon/domain", "@halcyon/server"],
  serverExternalPackages: ["@electric-sql/pglite", "pdf-lib", "hash-wasm", "drizzle-orm", "postgres", "ioredis"],
  poweredByHeader: false,
  webpack: (config, { isServer }) => {
    if (!isServer) return config;
    const externalPkgs = ["@electric-sql/pglite", "hash-wasm", "pdf-lib"];
    const handle = (
      { request }: { request?: string },
      callback: (error?: Error | null, result?: string) => void,
    ) => {
      if (request && externalPkgs.some((name) => request === name || request.startsWith(`${name}/`))) {
        return callback(null, `commonjs ${request}`);
      }
      callback();
    };
    if (Array.isArray(config.externals)) config.externals.push(handle);
    else config.externals = [config.externals, handle].filter(Boolean);
    return config;
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
