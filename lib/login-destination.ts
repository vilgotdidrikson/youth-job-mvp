import type { Role } from "./types";

/** Keep sign-in deep links within the current account's workspace. */
export function loginDestination(role: Role, requested: string | null, isAdmin = false): string {
  const fallback = isAdmin ? "/admin" : role === "company" ? "/company?view=swipe" : role === "youth" ? "/swipe" : "/private";
  if (!requested?.startsWith("/") || requested.startsWith("//") || /[\\\u0000-\u0020]/.test(requested)) return fallback;
  const url = new URL(requested, "https://matchnwork.invalid");
  const path = url.pathname;
  const within = (prefix: string) => path === prefix || path.startsWith(`${prefix}/`);
  const common = ["/", "/profile", "/chats", "/notifications", "/privacy", "/features", "/pricing"].includes(path) || within("/jobb");
  const permitted = common
    || (isAdmin && within("/admin"))
    || (role === "company" && within("/company"))
    || (role === "private" && within("/private"))
    || (role === "youth" && (["/swipe", "/kartan", "/applications", "/voice-cv", "/cv-builder"].includes(path) || within("/youth")));
  return permitted ? `${path}${url.search}${url.hash}` : fallback;
}
