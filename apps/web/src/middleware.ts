import { NextRequest, NextResponse } from "next/server";

/** Production-only HTTP → HTTPS. Localhost stays on http. */
export function middleware(request: NextRequest) {
  if (process.env.NODE_ENV !== "production") {
    return NextResponse.next();
  }
  const host = request.headers.get("host") ?? "";
  if (host.startsWith("localhost") || host.startsWith("127.0.0.1")) {
    return NextResponse.next();
  }
  const proto = request.headers.get("x-forwarded-proto");
  if (proto === "http") {
    const url = request.nextUrl.clone();
    url.protocol = "https:";
    return NextResponse.redirect(url, 308);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
