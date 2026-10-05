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
    <main className="mobile-shell mnw-session-state">
      <div className="mnw-session-card" role={status === "error" ? "alert" : "status"}>{status !== "error" && <span className="mnw-session-spinner" aria-hidden="true" />}<p>{text}</p></div>
    </main>
  );
}
