import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const TTL_SEC = 60 * 60 * 24 * 14;
const DEMO_FALLBACK = "halcyon-demo-session-secret-v1-not-for-production-use";

export type SessionClaims = {
  userId: string;
  exp: number;
  jti: string;
};

function b64url(buf: Buffer | string): string {
  const raw = Buffer.isBuffer(buf) ? buf : Buffer.from(buf, "utf8");
  return raw.toString("base64url");
}

function fromB64url(value: string): Buffer {
  return Buffer.from(value, "base64url");
}

function workspaceRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 6; i += 1) {
    if (fs.existsSync(path.join(dir, "pnpm-workspace.yaml"))) return dir;
    dir = path.dirname(dir);
  }
  return process.cwd();
}

function isServerless(): boolean {
  return Boolean(
    process.env.VERCEL ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.LAMBDA_TASK_ROOT ||
      process.env.NOW_REGION,
  );
}

/** Resolve a stable HMAC secret across serverless instances. Prefer SESSION_SECRET. */
export function sessionSecret(): string {
  const fromEnv = process.env.SESSION_SECRET?.trim() || process.env.HALCYON_SESSION_SECRET?.trim();
  if (fromEnv) return fromEnv;

  if (!isServerless()) {
    const keyPath = path.join(workspaceRoot(), ".data", "session.key");
    try {
      if (fs.existsSync(keyPath)) {
        const existing = fs.readFileSync(keyPath, "utf8").trim();
        if (existing) return existing;
      }
      fs.mkdirSync(path.dirname(keyPath), { recursive: true });
      const generated = randomBytes(32).toString("hex");
      fs.writeFileSync(keyPath, generated, { encoding: "utf8", mode: 0o600 });
      return generated;
    } catch {
      // Fall through to tmp / demo fallback.
      try {
        const tmpKey = path.join(os.tmpdir(), "halcyon-session.key");
        if (fs.existsSync(tmpKey)) {
          const existing = fs.readFileSync(tmpKey, "utf8").trim();
          if (existing) return existing;
        }
        const generated = randomBytes(32).toString("hex");
        fs.writeFileSync(tmpKey, generated, { encoding: "utf8", mode: 0o600 });
        return generated;
      } catch {
        /* ignore */
      }
    }
  }

  // Zero-config Vercel demo only. Set SESSION_SECRET in the project env for real deployments.
  return DEMO_FALLBACK;
}

export function issueSessionToken(userId: string, now = Date.now()): string {
  const claims: SessionClaims = {
    userId,
    exp: Math.floor(now / 1000) + TTL_SEC,
    jti: randomBytes(12).toString("hex"),
  };
  const payload = b64url(JSON.stringify(claims));
  const sig = b64url(createHmac("sha256", sessionSecret()).update(`v1.${payload}`).digest());
  return `v1.${payload}.${sig}`;
}

export function verifySessionToken(token: string | undefined, now = Date.now()): SessionClaims | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return null;
  const [, payload, sig] = parts;
  if (!payload || !sig) return null;
  const expected = createHmac("sha256", sessionSecret()).update(`v1.${payload}`).digest();
  let actual: Buffer;
  try {
    actual = fromB64url(sig);
  } catch {
    return null;
  }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const claims = JSON.parse(fromB64url(payload).toString("utf8")) as SessionClaims;
    if (!claims?.userId || typeof claims.exp !== "number") return null;
    if (claims.exp * 1000 <= now) return null;
    return claims;
  } catch {
    return null;
  }
}

export function isSignedSessionToken(token: string | undefined): boolean {
  return Boolean(token?.startsWith("v1."));
}
