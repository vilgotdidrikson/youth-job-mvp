"use client";

import { FormEvent, useState } from "react";
import { submitReport, type ReportReason, type ReportTargetType } from "@/lib/reports";

const reasons: { value: ReportReason; label: string }[] = [
  { value: "scam", label: "Misstänkt bedrägeri" },
  { value: "harassment", label: "Trakasserier eller hot" },
  { value: "discrimination", label: "Diskriminering" },
  { value: "inappropriate", label: "Olämpligt innehåll" },
  { value: "privacy", label: "Personuppgifter eller integritet" },
  { value: "other", label: "Annat" },
];

export function ReportDialog({
  targetType,
  targetId,
  label = "Anmäl",
}: {
  targetType: ReportTargetType;
  targetId: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>("inappropriate");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const close = () => {
    if (submitting) return;
    setOpen(false);
    setError("");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await submitReport({ targetType, targetId, reason, details });
      setSent(true);
      setDetails("");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Kunde inte skicka anmälan.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button type="button" className="secondary-btn" onClick={() => { setOpen(true); setSent(false); }}>
        {label}
      </button>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="report-dialog-title"
          style={{ position: "fixed", inset: 0, zIndex: 40, display: "grid", placeItems: "center", padding: "1.25rem", background: "rgba(0,0,0,.5)" }}
          onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}
        >
          <section className="card" style={{ width: "min(100%, 430px)", padding: "1.4rem" }}>
            {sent ? (
              <>
                <h2 id="report-dialog-title">Anmälan är skickad</h2>
                <p style={{ color: "#5f6368", lineHeight: 1.5 }}>Employos administratörer granskar ärendet. Du får en notis när granskningen är klar.</p>
                <button type="button" className="cta-btn" style={{ width: "100%" }} onClick={close}>Stäng</button>
              </>
            ) : (
              <form onSubmit={handleSubmit}>
                <h2 id="report-dialog-title">Anmäl innehåll</h2>
                <p style={{ color: "#5f6368", lineHeight: 1.5 }}>Välj den anledning som bäst beskriver problemet. Missbruka inte anmälningsfunktionen.</p>
                <label style={{ display: "grid", gap: ".4rem", marginTop: "1rem", fontWeight: 700 }}>
                  Anledning
                  <select className="input-field" value={reason} onChange={(event) => setReason(event.target.value as ReportReason)}>
                    {reasons.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
                <label style={{ display: "grid", gap: ".4rem", marginTop: ".85rem", fontWeight: 700 }}>
                  Beskriv problemet <span style={{ color: "#737373", fontWeight: 500 }}>(valfritt)</span>
                  <textarea className="input-field" rows={5} maxLength={2000} value={details} onChange={(event) => setDetails(event.target.value)} />
                </label>
                {error && <p className="auth-message auth-error" role="alert">{error}</p>}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: ".7rem", marginTop: "1rem" }}>
                  <button type="button" className="secondary-btn" disabled={submitting} onClick={close}>Avbryt</button>
                  <button type="submit" className="cta-btn" disabled={submitting}>{submitting ? "Skickar..." : "Skicka anmälan"}</button>
                </div>
              </form>
            )}
          </section>
        </div>
      )}
    </>
  );
}
