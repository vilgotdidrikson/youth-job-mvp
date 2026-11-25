import { NextRequest, NextResponse } from "next/server";
import { isPrelaunchMode } from "./lib/launch-mode";
import { prelaunchRoute } from "./lib/prelaunch-routes";

export function proxy(request: NextRequest) {
  const { hostname, pathname } = request.nextUrl;
  const prelaunch = isPrelaunchMode(hostname);
  if (pathname === "/prelaunch") {
    return prelaunch ? NextResponse.next() : NextResponse.redirect(new URL("/", request.url), 307);
  }
  if (!prelaunch) return NextResponse.next();

  if (pathname === "/") {
    const destination = request.nextUrl.clone();
    destination.pathname = "/prelaunch";
    return NextResponse.rewrite(destination);
  }

  // Waitlist admin authorization remains enforced inside its API handler.
  const action = prelaunchRoute(pathname);
  if (action === "allow") return NextResponse.next();
  if (action === "deny-api") return NextResponse.json({ error: "Tjänsten är inte öppen ännu." }, { status: 404, headers: { "Cache-Control": "no-store" } });
  return NextResponse.redirect(new URL("/", request.url), 307);
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
