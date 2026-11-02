const pages = new Set(["/", "/demo", "/launch-privacy", "/avregistrera", "/launch-admin"]);
const endpoints = new Set(["/api/prelaunch", "/api/prelaunch/admin", "/api/prelaunch/unsubscribe"]);
export function prelaunchRoute(pathname: string): "allow" | "redirect" | "deny-api" {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (pages.has(path) || endpoints.has(path)) return "allow";
  if (path === "/favicon.ico" || /^\/(brand|fonts|icons)\//.test(path) || /^\/_next\/(static|image)(\/|$)/.test(path)) return "allow";
  return path === "/api" || path.startsWith("/api/") ? "deny-api" : "redirect";
}
