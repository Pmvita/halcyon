import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
  theme: z.enum(["system", "light", "dark", "contrast"]).optional(),
});

export const transferSchema = z.object({
  fromAccountId: z.string().min(1),
  toAccountId: z.string().optional(),
  payeeHandle: z.string().optional(),
  amount: z.string().min(1),
  kind: z.enum(["internal", "ach", "wire", "person", "bill", "fx", "international"]),
  memo: z.string().max(140).optional(),
  idempotencyKey: z.string().min(8).max(80),
  confirmed: z.literal(true),
  useOverdraft: z.boolean().optional(),
  scheduledFor: z.string().optional(),
});

export const orderSchema = z.object({
  accountId: z.string().min(1),
  symbol: z.string().min(1).max(24),
  side: z.enum(["buy", "sell"]),
  type: z.enum(["market", "limit", "stop", "stop_limit", "trailing_stop", "moc", "loc"]),
  qty: z.number().positive(),
  limitPrice: z.number().positive().optional(),
  stopPrice: z.number().positive().optional(),
  trailBps: z.number().positive().max(2000).optional(),
  tif: z.enum(["day", "gtc", "ioc", "fok"]),
  lotMethod: z.enum(["fifo", "lifo", "specific"]).optional(),
  confirmed: z.literal(true),
  idempotencyKey: z.string().min(8).max(80),
});

export const watchAddressSchema = z.object({
  address: z
    .string()
    .trim()
    .min(14, "Enter a public address.")
    .max(128, "That address is too long.")
    .regex(/^(0x[a-fA-F0-9]{40}|[13][a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[a-z0-9]{25,87})$/, "Use a public BTC or ETH address. Never enter a seed phrase."),
  chain: z.enum(["btc", "eth"]).optional(),
});

export const LEGAL_VERSION = "2026-11-07";
