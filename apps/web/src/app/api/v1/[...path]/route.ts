import { NextRequest, NextResponse } from "next/server";
import { HalcyonError, isHalcyonError } from "@halcyon/domain";
import { getHalcyon } from "@halcyon/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function actor() {
  const jar = await cookies();
  const app = await getHalcyon();
  const user = await app.userByToken(jar.get("halcyon_session")?.value);
  return { app, user, jar };
}

function fail(error: unknown) {
  if (isHalcyonError(error) || error instanceof HalcyonError) {
    const known = error as HalcyonError;
    const status = known.code === "auth" ? 401 : known.code === "step_up" ? 403 : 400;
    return NextResponse.json({ ok: false, error: { code: known.code, message: known.message } }, { status });
  }
  const message = error instanceof Error ? error.message : "The desk could not finish that.";
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  return NextResponse.json({ ok: false, error: { message } }, { status: 500 });
}

function guard(req: NextRequest) {
  if (req.method === "GET") return null;
  const host = req.headers.get("host");
  const origin = req.headers.get("origin");
  if (origin && host && new URL(origin).host !== host) {
    return NextResponse.json({ ok: false, error: { message: "Cross-site request blocked." } }, { status: 403 });
  }
  if (req.headers.get("x-halcyon-request") !== "1") {
    return NextResponse.json({ ok: false, error: { message: "Missing Halcyon request header." } }, { status: 403 });
  }
  return null;
}

async function handle(req: NextRequest, path: string[]) {
  const blocked = guard(req);
  if (blocked) return blocked;
  const key = path.join("/");
  try {
    const { app, user } = await actor();
    if (key === "auth/login" && req.method === "POST") {
      const body = await req.json();
      const result = await app.login(String(body.email ?? ""), String(body.password ?? ""), req.headers.get("user-agent") ?? "web");
      if (body.theme) await app.updateProfile(result.user.id, { theme: body.theme });
      const response = NextResponse.json({ ok: true, intro: !result.user.introSeen, user: result.user, token: result.token });
      response.cookies.set("halcyon_session", result.token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 14 });
      return response;
    }
    if (key === "auth/logout" && req.method === "POST") {
      const jar = await cookies();
      await app.logout(jar.get("halcyon_session")?.value);
      const response = NextResponse.json({ ok: true });
      response.cookies.delete("halcyon_session");
      return response;
    }
    if (!user) return NextResponse.json({ ok: false, error: { message: "Sign in again." } }, { status: 401 });
    if (key === "home") return NextResponse.json(await app.home(user.id));
    if (key === "banking") return NextResponse.json(await app.banking(user.id));
    if (key === "quotes") {
      const symbols = (req.nextUrl.searchParams.get("symbols") ?? "BTC").split(",");
      const quotes = [];
      for (const symbol of symbols) quotes.push(await app.quotes.quote(symbol, "page", user.replayEnabled));
      return NextResponse.json({ quotes });
    }
    if (key === "search") return NextResponse.json(await app.search(user.id, req.nextUrl.searchParams.get("q") ?? ""));
    if (key === "orders" && req.method === "GET") return NextResponse.json(await app.orders(user.id));
    if (key === "inbox") return NextResponse.json(await app.inbox(user.id));
    if (key === "crypto") return NextResponse.json(await app.crypto(user.id));
    if (key === "plan") return NextResponse.json(await app.plan(user.id));
    if (key === "health") return NextResponse.json(await app.health());
    if (req.method !== "POST") return NextResponse.json({ ok: false, error: { message: "Not found." } }, { status: 404 });
    const body = await req.json().catch(() => ({}));
    if (key === "transfers") return NextResponse.json(await app.transfer(user.id, body));
    if (key === "paycheck") return NextResponse.json(await app.paycheck(user.id));
    if (key === "funds") return NextResponse.json(await app.addFunds(user.id, Boolean(body.acceptedRisk)));
    if (key === "orders") return NextResponse.json(await app.placeOrder(user.id, body));
    if (key === "orders/cancel") return NextResponse.json(await app.cancel(user.id, String(body.orderId)));
    if (key === "cards/reveal") return NextResponse.json(await app.revealCard(user.id, String(body.cardId)));
    if (key === "cards/freeze") return NextResponse.json(await app.freezeCard(user.id, String(body.cardId), Boolean(body.frozen)));
    if (key === "cards/spend") return NextResponse.json(await app.spend(user.id, body));
    if (key === "cards/settle") return NextResponse.json(await app.settleHold(user.id, String(body.holdId), body.action));
    if (key === "payments/stop") return NextResponse.json(await app.stopPayment(user.id, String(body.paymentId)));
    if (key === "profile") return NextResponse.json(await app.updateProfile(user.id, body));
    if (key === "stepup") return NextResponse.json(await app.stepUp(user.id, String(body.password ?? "")));
    if (key === "kyc") return NextResponse.json(await app.kyc(user.id, String(body.name ?? "")));
    if (key === "watch") return NextResponse.json(await app.watch(user.id, String(body.address ?? ""), body.chain === "eth" ? "eth" : "btc"));
    if (key === "perp") return NextResponse.json(await app.openPerp(user.id, body));
    if (key === "options/expire") return NextResponse.json(await app.expirePaper(user.id, String(body.paperId)));
    if (key === "reset") return NextResponse.json(await app.reset(body.persona));
    if (key === "statements") {
      const file = await app.statement(user.id, body.format === "csv" ? "csv" : "pdf");
      return NextResponse.json(file);
    }
    if (key === "admin/flag" && user.role === "admin") {
      await app.setFlag(String(body.key), Boolean(body.enabled));
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ ok: false, error: { message: "That action is not on the desk." } }, { status: 404 });
  } catch (error) {
    return fail(error);
  }
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return handle(req, path);
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  const { path } = await ctx.params;
  return handle(req, path);
}
