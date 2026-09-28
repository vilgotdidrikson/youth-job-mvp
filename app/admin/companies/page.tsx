"use client";

import { useCallback, useEffect, useState } from "react";
import { AuthGateMessage } from "@/components/auth-gate-message";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { getSupabaseClient } from "@/lib/supabase";

interface VerificationRequest {
  user_id: string;
  company_name: string;
  organization_number: string | null;
  administrator: string;
  city: string;
  verification_status: "pending" | "rejected";
  verification_submitted_at: string | null;
  updated_at: string;
}

export default function CompanyVerificationAdminPage() {
  const { status, error: sessionError } = useRequireAuth();
  const [requests, setRequests] = useState<VerificationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const loadRequests = useCallback(async () => {
    setLoading(true);
    const { data, error: loadError } = await getSupabaseClient().rpc("get_pending_company_verifications");
    if (loadError) {
      setError(loadError.code === "42501" ? "Du har inte administratörsåtkomst." : "Kunde inte hämta verifieringsärenden.");
      setRequests([]);
    } else {
      setError("");
      setRequests((data ?? []) as VerificationRequest[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (status !== "ready") return;
    const timeoutId = window.setTimeout(() => void loadRequests(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadRequests, status]);

  const review = async (request: VerificationRequest, decision: "verified" | "rejected") => {
    const reason = decision === "rejected"
      ? window.prompt("Beskriv vad företaget behöver komplettera:")?.trim()
      : null;
    if (decision === "rejected" && !reason) return;
    if (decision === "verified" && !window.confirm(`Godkänn ${request.company_name}? Företagets aktiva annonser publiceras direkt.`)) return;

    setActionId(request.user_id);
    setError("");
    const { error: reviewError } = await getSupabaseClient().rpc("review_company_verification", {
      p_company_user_id: request.user_id,
      p_decision: decision,
      p_reason: reason,
    });
    if (reviewError) setError(reviewError.message || "Kunde inte spara beslutet.");
    else await loadRequests();
    setActionId(null);
  };

  if (status !== "ready") return <AuthGateMessage status={status} error={sessionError} />;

  return (
    <main className="mobile-shell" style={{ paddingBottom: "4rem" }}>
      <header style={{ padding: ".75rem 0 1.25rem" }}>
        <p style={{ margin: 0, color: "#a3a3a3", fontSize: ".72rem", fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase" }}>Admin</p>
        <h1 style={{ margin: ".2rem 0 0", color: "#111", fontSize: "1.7rem" }}>Företagsverifiering</h1>
      </header>

      {error && <p role="alert" style={{ padding: ".8rem 1rem", borderRadius: 10, background: "#fff1f0", color: "#b42318" }}>{error}</p>}
      {loading ? <p>Hämtar ärenden...</p> : !error && requests.length === 0 ? <section className="card" style={{ padding: "1.25rem" }}><strong>Inga väntande företag</strong><p style={{ color: "#737373", marginBottom: 0 }}>Alla verifieringsärenden är hanterade.</p></section> : requests.map((request) => (
        <article key={request.user_id} className="card" style={{ padding: "1.15rem", marginBottom: ".75rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
            <div><h2 style={{ margin: 0, fontSize: "1.05rem" }}>{request.company_name || "Namnlöst företag"}</h2><p style={{ margin: ".25rem 0 0", color: "#737373", fontSize: ".83rem" }}>{request.organization_number || "Organisationsnummer saknas"}</p></div>
            <span style={{ alignSelf: "flex-start", padding: ".2rem .55rem", borderRadius: 999, background: request.verification_status === "rejected" ? "#fff1f0" : "#fff3d6", color: request.verification_status === "rejected" ? "#b42318" : "#6a4a00", fontSize: ".72rem", fontWeight: 700 }}>{request.verification_status === "rejected" ? "Avvisad" : "Väntar"}</span>
          </div>
          <dl style={{ display: "grid", gap: ".35rem", margin: "1rem 0", fontSize: ".85rem" }}>
            <div><dt style={{ color: "#737373" }}>Administratör</dt><dd style={{ margin: 0 }}>{request.administrator || "Ej angiven"}</dd></div>
            <div><dt style={{ color: "#737373" }}>Ort</dt><dd style={{ margin: 0 }}>{request.city || "Ej angiven"}</dd></div>
          </dl>
          <div style={{ display: "flex", gap: ".6rem" }}>
            <button type="button" className="cta-btn" style={{ flex: 1, padding: ".7rem" }} disabled={actionId === request.user_id || !request.organization_number} onClick={() => void review(request, "verified")}>Godkänn</button>
            <button type="button" className="secondary-btn" style={{ flex: 1, padding: ".7rem", color: "#b42318" }} disabled={actionId === request.user_id} onClick={() => void review(request, "rejected")}>Begär komplettering</button>
          </div>
        </article>
      ))}
    </main>
  );
}
