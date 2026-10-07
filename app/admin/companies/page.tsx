"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { AuthGateMessage } from "@/components/auth-gate-message";
import { useAdminAccess } from "@/hooks/use-admin-access";
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
  const { user, status, error: sessionError, adminReady, isAdmin } = useAdminAccess();
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
    if (!adminReady || !isAdmin) return;
    const timeoutId = window.setTimeout(() => void loadRequests(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [adminReady, isAdmin, loadRequests]);

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

  if (status !== "ready" || !adminReady) return <AuthGateMessage status={status === "ready" ? "checking" : status} error={sessionError} />;
  if (!isAdmin) return <main className="mobile-shell"><section className="card" style={{ padding: "1.25rem" }}><h1>Ingen administratörsåtkomst</h1><p>Kontot finns inte i MatchnWorks adminlista.</p></section></main>;

  return (
    <AdminShell title="Företagsverifiering" eyebrow="Granskning" email={user?.email}>
      <div className="admin-list-intro"><p>Kontrollera uppgifterna innan företaget får publicera annonser.</p><span>{requests.length} ärenden</span></div>
      {error && <p className="admin-alert admin-alert-error" role="alert">{error}</p>}
      {loading ? <section className="admin-empty"><span>○</span><strong>Hämtar verifieringsärenden...</strong></section> : !error && requests.length === 0 ? <section className="admin-empty"><span>✓</span><strong>Allt är klart</strong><p>Det finns inga företag som väntar på granskning.</p></section> : <div className="admin-verification-list">{requests.map((request) => (
        <article key={request.user_id} className="admin-verification-card">
          <div className="admin-verification-heading">
            <div><span className="admin-company-avatar">{(request.company_name || "F").slice(0, 1).toUpperCase()}</span><div><h2>{request.company_name || "Namnlöst företag"}</h2><p>{request.organization_number || "Organisationsnummer saknas"}</p></div></div>
            <span className={request.verification_status === "rejected" ? "admin-status admin-status-rejected" : "admin-status"}>{request.verification_status === "rejected" ? "Komplettering krävs" : "Väntar"}</span>
          </div>
          <dl className="admin-company-details">
            <div><dt>Kontaktperson</dt><dd>{request.administrator || "Ej angiven"}</dd></div>
            <div><dt>Ort</dt><dd>{request.city || "Ej angiven"}</dd></div>
            <div><dt>Inskickad</dt><dd>{request.verification_submitted_at ? new Date(request.verification_submitted_at).toLocaleDateString("sv-SE") : "Datum saknas"}</dd></div>
          </dl>
          {!request.organization_number && <p className="admin-alert">Företaget behöver komplettera sitt organisationsnummer innan det kan godkännas. Använd ”Begär komplettering” för att skicka en förklaring.</p>}
          <div className="admin-review-actions">
            <button type="button" className="cta-btn" disabled={actionId === request.user_id || !request.organization_number} onClick={() => void review(request, "verified")}>Godkänn företag</button>
            <button type="button" className="secondary-btn" disabled={actionId === request.user_id} onClick={() => void review(request, "rejected")}>Begär komplettering</button>
          </div>
        </article>
      ))}</div>}
    </AdminShell>
  );
}
