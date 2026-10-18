/** Shared with future mobile clients. The database is the authority for expiry. */
export function videoHasExpired(expiresAt: string | null | undefined, now = Date.now()): boolean {
  if (!expiresAt) return false;
  const deadline = Date.parse(expiresAt);
  return !Number.isFinite(deadline) || deadline <= now;
}

export function videoExpiryLabel(expiresAt: string): string {
  return new Intl.DateTimeFormat("sv-SE", {
    dateStyle: "long", timeStyle: "medium", timeZone: "Europe/Stockholm",
  }).format(new Date(expiresAt)) + " (svensk tid)";
}
