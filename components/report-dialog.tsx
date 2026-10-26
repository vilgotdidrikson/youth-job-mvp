"use client";

import { ModalDialog } from "./modal-dialog";
import { FormEvent, useEffect, useRef, useState } from "react";
import { submitReport, type ReportReason, type ReportTargetType } from "@/lib/reports";

const reasons: { value: ReportReason; label: string }[] = [
  { value: "scam", label: "Misstänkt bedrägeri" },
  { value: "harassment", label: "Trakasserier eller hot" },
  { value: "discrimination", label: "Diskriminering" },
  { value: "inappropriate", label: "Olämpligt innehåll" },
  { value: "privacy", label: "Personuppgifter eller integritet" },
  { value: "other", label: "Annat" },
];

function ReportForm({
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
  const submittingRef = useRef(false);
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const close = () => {
    if (submittingRef.current) return;
    setOpen(false);
    setError("");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittingRef.current || !active.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError("");
    try {
      await submitReport({ targetType, targetId, reason, details });
      if (active.current) { setSent(true); setDetails(""); }
    } catch (submitError) {
      if (active.current) setError(submitError instanceof Error ? submitError.message : "Kunde inte skicka anmälan.");
    } finally {
      submittingRef.current = false;
      if (active.current) setSubmitting(false);
    }
  };

  return (
    <>
      <button type="button" className="secondary-btn" onClick={() => { setOpen(true); setSent(false); }}>
        {label}
      </button>
      {open && (
        <ModalDialog labelledBy="report-dialog-title" onClose={close} busy={submitting} className="mnw-report-dialog">
          <section className="card mnw-report-content">
            {sent ? (
              <>
                <h2 id="report-dialog-title">Anmälan är skickad</h2>
                <p className="report-description">MatchnWorks administratörer granskar ärendet. Du får en notis när granskningen är klar.</p>
                <button type="button" className="cta-btn report-close" onClick={close}>Stäng</button>
              </>
            ) : (
              <form onSubmit={handleSubmit}>
                <h2 id="report-dialog-title">Anmäl innehåll</h2>
                <p className="report-description">Välj den anledning som bäst beskriver problemet. Missbruka inte anmälningsfunktionen.</p>
                <label className="report-field">
                  Anledning
                  <select className="input-field" value={reason} onChange={(event) => setReason(event.target.value as ReportReason)}>
                    {reasons.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
                <label className="report-field">
                  Beskriv problemet <span className="report-optional">(valfritt)</span>
                  <textarea className="input-field" rows={5} maxLength={2000} value={details} onChange={(event) => setDetails(event.target.value)} />
                </label>
                {error && <p className="auth-message auth-error" role="alert">{error}</p>}
                <div className="report-actions">
                  <button type="button" className="secondary-btn" disabled={submitting} onClick={close}>Avbryt</button>
                  <button type="submit" className="cta-btn" disabled={submitting}>{submitting ? "Skickar..." : "Skicka anmälan"}</button>
                </div>
              </form>
            )}
          </section>
        </ModalDialog>
      )}
    </>
  );
}

export function ReportDialog(props: {targetType: ReportTargetType; targetId: string; label?: string}) {
  return <ReportForm key={JSON.stringify([props.targetType, props.targetId])} {...props} />;
}
