export interface EmploymentRecord {
  match_id: string;
  youth_user_id: string;
  company_user_id: string;
  company_name: string;
  role_name: string;
  start_date: string;
  response: "pending" | "approved" | "disputed";
  approved_at: string | null;
  show_on_profile: boolean;
  include_in_cv: boolean;
  registered_at: string;
  paid_at: string | null;
}
export interface VerifiedExperience {
  match_id: string;
  company_name: string;
  role_name: string;
  start_date: string;
  show_on_profile: boolean;
  include_in_cv: boolean;
}
export interface RecruitmentRecord {
  match_id: string;
  job_id: string;
  match_status: string;
  job_title: string;
  company_user_id: string;
  youth_user_id: string;
  company_name: string;
  youth_name: string;
  employment: EmploymentRecord | null;
  requested_at: string | null;
  reminder_sent_at: string | null;
  reported_at: string | null;
  review_state: "open" | "reviewing" | "resolved" | "dismissed" | null;
  report_details: string | null;
  admin_notes: string | null;
  escalated_at: string | null;
  restriction: "none" | "limited" | "suspended";
  restriction_reason: string | null;
  created_at: string;
}

const VERIFIED_HEADING = "ARBETSLIVSERFARENHET VIA MATCHNWORK";
export function experiencePeriod(startDate: string, today = new Date().toISOString().slice(0, 10)): string {
  const formatted = new Intl.DateTimeFormat("sv-SE", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${startDate}T12:00:00Z`));
  return startDate > today ? `${formatted} · Planerad start` : `${formatted}–pågående`;
}
/** Compose from authoritative records each time, preserving the user's base CV. */
export function withVerifiedExperience(text: string, experiences: VerifiedExperience[], today?: string): string {
  const base = text.startsWith(`${VERIFIED_HEADING}\n`) ? "" : text.split(`\n\n${VERIFIED_HEADING}\n`)[0].trim();
  const selected = [...new Map(experiences.filter(item => item.include_in_cv).map(item => [item.match_id, item])).values()];
  if (!selected.length) return base;
  return [base, `${VERIFIED_HEADING}\n${selected.map(item => `${item.role_name} – ${item.company_name}\n${experiencePeriod(item.start_date, today)}\nAnställning bekräftad av arbetsgivaren via MatchnWork`).join("\n\n")}`].filter(Boolean).join("\n\n");
}

export function needsRecruitmentReview(item: RecruitmentRecord): boolean {
  return !["resolved", "dismissed"].includes(item.review_state ?? "") && Boolean(item.reported_at || item.escalated_at || item.employment?.response === "disputed");
}
