import { NextRequest, NextResponse } from "next/server";
import { prelaunchRoute } from "./lib/prelaunch-routes";

// This is a public prelaunch boundary, not an authentication decision.
// Waitlist admin authorization remains enforced inside its API handler.
export function proxy(request: NextRequest) {
  const action = prelaunchRoute(request.nextUrl.pathname);
  if (action === "allow") return NextResponse.next();
  if (action === "deny-api") return NextResponse.json({ error: "Tjänsten är inte öppen ännu." }, { status: 404, headers: { "Cache-Control": "no-store" } });
  return NextResponse.redirect(new URL("/", request.url), 307);
}
export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
