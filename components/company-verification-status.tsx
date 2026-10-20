"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { UiIcon } from "@/components/ui-icon";
import { companyVerificationSummary, verificationSteps, VERIFICATION_HELP_TEXT, type VerificationProfileFields } from "@/lib/company-verification";
import "./company-verification-status.css";

const STATE_LABELS = { missing: "Åtgärd krävs", needs_completion: "Komplettera", submitted: "Under granskning", verified: "Godkänt", unknown: "Okänd status" } as const;

/** Remembered per state, so a new status (e.g. a completion request) opens the card again. */
const storageKey = (state: string) => `mnw-verification-collapsed:${state}`;

export function CompanyVerificationStatus({ profile, action, compact = false }: {
  profile: VerificationProfileFields | null | undefined;
  /** Where the company fixes its details; omitted when already on that view. */
  action?: { href?: string; onClick?: () => void; label: string };
  compact?: boolean;
}) {
  const summary = companyVerificationSummary(profile);
  const steps = verificationSteps(summary.state);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Restore a per-viewer preference that only exists in the browser.
      setOpen(window.localStorage.getItem(storageKey(summary.state)) !== "1");
    } catch { setOpen(true); }
  }, [summary.state]);

  const toggle = (next: boolean) => {
    setOpen(next);
    try { window.localStorage.setItem(storageKey(summary.state), next ? "0" : "1"); } catch { /* Preference only. */ }
  };

  const actionClass = "secondary-btn company-verification-action";
  return <details
    className={`card company-verification is-${summary.state}${compact ? " is-compact" : ""}`}
    open={open}
    onToggle={(event) => { const next = event.currentTarget.open; if (next !== open) toggle(next); }}
    aria-label="Företagsverifiering"
  >
    <summary>
      <span className="company-verification-icon" aria-hidden="true"><UiIcon name={summary.state === "verified" ? "check" : "info"} width="18" /></span>
      <span className="company-verification-heading">
        <small>Företagsverifiering</small>
        <strong>{summary.title}</strong>
      </span>
      <span className="company-verification-pill">{STATE_LABELS[summary.state]}</span>
      <span className="company-verification-toggle"><span className="sr-only">{open ? "Minimera" : "Visa detaljer"}</span><UiIcon name="chevron" width="18" /></span>
    </summary>
    <div className="company-verification-body" role="status">
      <p>{summary.body}</p>
      {steps.length > 0 && <ol className="company-verification-steps">
        {steps.map((step) => <li key={step.label} className={step.done ? "is-done" : step.current ? "is-current" : undefined} aria-current={step.current ? "step" : undefined}>
          <span aria-hidden="true" />{step.label}
        </li>)}
      </ol>}
      {summary.missing.length > 0 && summary.state !== "verified" && <div className="company-verification-missing">
        <strong>Krävs för granskning</strong>
        <ul>{summary.missing.map((label) => <li key={label}>{label}</li>)}</ul>
      </div>}
      {!compact && summary.state !== "verified" && <p className="company-verification-help">{VERIFICATION_HELP_TEXT}</p>}
      {action && summary.state !== "verified" && (action.href
        ? <Link href={action.href} className={actionClass}>{action.label}<UiIcon name="arrow" width="15" /></Link>
        : <button type="button" className={actionClass} onClick={action.onClick}>{action.label}<UiIcon name="arrow" width="15" /></button>)}
    </div>
  </details>;
}
