"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { AuthGateMessage } from "@/components/auth-gate-message";
import { useAdminAccess } from "@/hooks/use-admin-access";
import { getSupabaseClient } from "@/lib/supabase";

interface ModerationReport {
  id: string;
  reporter_user_id: string | null;
  target_type: "job" | "conversation" | "message" | "user";
  target_id: string;
  reason: "scam" | "harassment" | "discrimination" | "inappropriate" | "privacy" | "other";
  details: string | null;
  status: "open" | "reviewing" | "resolved" | "dismissed";
  created_at: string;
  target_summary: string;
  target_snapshot: Record<string, unknown> | null;
}

type SnapshotMessage = { sender_user_id?: string; message_text?: string; created_at?: string };

const shortId = (value: unknown) => (typeof value === "string" ? `${value.slice(0, 8)}…` : "okänd");

// Evidence captured when the report was submitted, so it survives account deletion.
function snapshotLines(report: ModerationReport): string[] {
  const snapshot = report.target_snapshot;
  if (!snapshot) return [];
  if (report.target_type === "message") return [`${shortId(snapshot.sender_user_id)}: ${String(snapshot.message_text ?? "")}`];
  if (report.target_type === "conversation") {
    const messages = Array.isArray(snapshot.messages) ? snapshot.messages as SnapshotMessage[] : [];
    return messages.map((message) => `${shortId(message.sender_user_id)}: ${message.message_text ?? ""}`);
  }
  if (report.target_type === "job") return [String(snapshot.title ?? ""), String(snapshot.description ?? "")].filter(Boolean);
  return [`${String(snapshot.display_name ?? "Namn saknas")} (${String(snapshot.role ?? "okänd roll")})`];
}

const reasonLabels: Record<ModerationReport["reason"], string> = {
  scam: "Misstänkt bedrägeri",
  harassment: "Trakasserier eller hot",
  discrimination: "Diskriminering",
  inappropriate: "Olämpligt innehåll",
  privacy: "Personuppgifter eller integritet",
  other: "Annat",
};

const statusLabels: Record<ModerationReport["status"], string> = {
  open: "Ny",
  reviewing: "Granskas",
  resolved: "Åtgärdad",
  dismissed: "Avslutad",
};

export default function ModerationReportsPage() {
  const { user, status, error: sessionError, adminReady, isAdmin } = useAdminAccess();
  const [reports, setReports] = useState<ModerationReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const loadReports = useCallback(async () => {
    setLoading(true);
    const { data, error: loadError } = await getSupabaseClient().rpc("get_moderation_reports");
    if (loadError) {
      setError(loadError.code === "42501" ? "Du har inte administratörsåtkomst." : "Kunde inte hämta anmälningar.");
      setReports([]);
    } else {
      setError("");
      setReports((data ?? []) as ModerationReport[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!adminReady || !isAdmin) return;
    const timeoutId = window.setTimeout(() => void loadReports(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [adminReady, isAdmin, loadReports]);

  const review = async (report: ModerationReport, nextStatus: "reviewing" | "resolved" | "dismissed") => {
    const note = nextStatus === "reviewing"
      ? null
      : window.prompt(nextStatus === "resolved" ? "Beskriv kort vilken åtgärd som har vidtagits (valfritt):" : "Ange varför ärendet avslutas (valfritt):")?.trim() || null;

    setActionId(report.id);
    setError("");
    const { error: reviewError } = await getSupabaseClient().rpc("review_moderation_report", {
      p_report_id: report.id,
      p_status: nextStatus,
      p_resolution_note: note,
    });
    if (reviewError) setError(reviewError.message || "Kunde inte uppdatera ärendet.");
    else await loadReports();
    setActionId(null);
  };

  if (status !== "ready" || !adminReady) return <AuthGateMessage status={status === "ready" ? "checking" : status} error={sessionError} />;
  if (!isAdmin) return <main className="mobile-shell"><section className="card" style={{ padding: "1.25rem" }}><h1>Ingen administratörsåtkomst</h1><p>Kontot finns inte i MatchnWorks adminlista.</p></section></main>;

  const activeCount = reports.filter((report) => report.status === "open" || report.status === "reviewing").length;

  return (
    <AdminShell title="Anmälningar" eyebrow="Moderering" email={user?.email}>
      <div className="admin-list-intro"><p>Granska rapporterat innehåll och dokumentera beslut. Innehåll tas inte bort automatiskt.</p><span>{activeCount} aktiva</span></div>
      {error && <p className="admin-alert admin-alert-error" role="alert">{error}</p>}
      {loading ? (
        <section className="admin-empty"><span>○</span><strong>Hämtar anmälningar...</strong></section>
      ) : reports.length === 0 ? (
        <section className="admin-empty"><span>✓</span><strong>Inga anmälningar</strong><p>Det finns inga ärenden att granska.</p></section>
      ) : (
        <div className="admin-verification-list">
          {reports.map((report) => (
            <article key={report.id} className="admin-verification-card" style={{ opacity: report.status === "resolved" || report.status === "dismissed" ? 0.72 : 1 }}>
              <div className="admin-verification-heading">
                <div><span className="admin-company-avatar">!</span><div><h2>{report.target_summary}</h2><p>{reasonLabels[report.reason]}</p></div></div>
                <span className={report.status === "dismissed" ? "admin-status admin-status-rejected" : "admin-status"}>{statusLabels[report.status]}</span>
              </div>
              <dl className="admin-company-details">
                <div><dt>Typ</dt><dd>{report.target_type}</dd></div>
                <div><dt>Anmälare</dt><dd>{report.reporter_user_id ? `${report.reporter_user_id.slice(0, 8)}…` : "Raderat konto"}</dd></div>
                <div><dt>Inskickad</dt><dd>{new Date(report.created_at).toLocaleString("sv-SE")}</dd></div>
              </dl>
              {report.details && <p style={{ padding: ".8rem", borderRadius: 10, background: "#f7f7f7", lineHeight: 1.5 }}>{report.details}</p>}
              {snapshotLines(report).length > 0 && (
                <details style={{ padding: ".8rem", borderRadius: 10, background: "#f7f7f7" }}>
                  <summary style={{ cursor: "pointer", fontWeight: 600 }}>Sparat innehåll vid anmälan</summary>
                  {snapshotLines(report).map((line, index) => <p key={index} style={{ margin: ".5rem 0 0", lineHeight: 1.5, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{line}</p>)}
                </details>
              )}
              {(report.status === "open" || report.status === "reviewing") && (
                <div className="admin-review-actions">
                  {report.status === "open" && <button type="button" className="secondary-btn" disabled={actionId === report.id} onClick={() => void review(report, "reviewing")}>Påbörja granskning</button>}
                  <button type="button" className="cta-btn" disabled={actionId === report.id} onClick={() => void review(report, "resolved")}>Markera åtgärdad</button>
                  <button type="button" className="secondary-btn" disabled={actionId === report.id} onClick={() => void review(report, "dismissed")}>Avsluta utan åtgärd</button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
