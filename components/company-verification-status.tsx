import Link from "next/link";
import { UiIcon } from "@/components/ui-icon";
import { companyVerificationSummary, verificationSteps, VERIFICATION_HELP_TEXT, type VerificationProfileFields } from "@/lib/company-verification";
import "./company-verification-status.css";

export function CompanyVerificationStatus({ profile, action, compact = false }: {
  profile: VerificationProfileFields | null | undefined;
  /** Where the company fixes its details; omitted when already on that view. */
  action?: { href?: string; onClick?: () => void; label: string };
  compact?: boolean;
}) {
  const summary = companyVerificationSummary(profile);
  const steps = verificationSteps(summary.state);
  const actionClass = "secondary-btn company-verification-action";
  return <section className={`card company-verification is-${summary.tone}${compact ? " is-compact" : ""}`} role="status" aria-label="Företagsverifiering">
    <div className="company-verification-heading">
      <UiIcon name={summary.state === "verified" ? "check" : "info"} width="22" />
      <div><p className="company-verification-eyebrow">Företagsverifiering</p><h2>{summary.title}</h2></div>
    </div>
    <p>{summary.body}</p>
    {steps.length > 0 && <ol className="company-verification-steps">
      {steps.map((step) => <li key={step.label} className={step.done ? "is-done" : step.current ? "is-current" : undefined} aria-current={step.current ? "step" : undefined}>
        <span aria-hidden="true">{step.done ? <UiIcon name="check" width="13" /> : null}</span>{step.label}
      </li>)}
    </ol>}
    {summary.missing.length > 0 && summary.state !== "verified" && <div className="company-verification-missing">
      <strong>Krävs för granskning</strong>
      <ul>{summary.missing.map((label) => <li key={label}>{label}</li>)}</ul>
    </div>}
    {!compact && summary.state !== "verified" && <p className="company-verification-help">{VERIFICATION_HELP_TEXT}</p>}
    {action && summary.state !== "verified" && (action.href
      ? <Link href={action.href} className={actionClass}>{action.label}</Link>
      : <button type="button" className={actionClass} onClick={action.onClick}>{action.label}</button>)}
  </section>;
}
