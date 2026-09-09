"use client";

import type { AuthGuardStatus } from "@/hooks/use-require-auth";

const STATUS_TEXT: Record<Exclude<AuthGuardStatus, "ready">, string> = {
  checking: "Kontrollerar session...",
  redirecting: "Du behöver logga in. Skickar dig till inloggningen...",
  error: "Något gick fel när sessionen skulle kontrolleras.",
};

/**
 * Renders whichever non-content state a page behind useRequireAuth is in
 * (checking the session, redirecting to login, or a session error) so an
 * unauthenticated visitor never sees a blank shell or protected content.
 */
export function AuthGateMessage({ status, error }: { status: Exclude<AuthGuardStatus, "ready">; error?: string | null }) {
  const text = status === "error" && error ? error : STATUS_TEXT[status];
  return (
    <main className="mobile-shell" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
      <p style={{ color: status === "error" ? "#c0392b" : "#737373", fontSize: "0.9rem" }}>{text}</p>
    </main>
  );
}
