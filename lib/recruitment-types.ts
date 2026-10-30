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

/** Facts and decision actually displayed when the form was opened. */
export function employmentSnapshot(employment: EmploymentRecord | null) {
  return employment ? {
    role_name: employment.role_name,
    start_date: employment.start_date,
    response: employment.response,
  } : null;
}

/** The company's one name for the hire step, in chat, panel and when closing a job. */
export const REGISTER_EMPLOYMENT = "Registrera anställning";
/** What registering means and what happens next, shown before the company registers. */
export const EMPLOYMENT_STEPS = [
  "Ni anger befattning och startdatum som ni har kommit överens om.",
  "Kandidaten granskar uppgifterna och godkänner dem eller ber om en rättelse.",
  "När kandidaten har godkänt står anställningen som bekräftad hos er båda.",
] as const;
/** Short status for a hired match: registered until the candidate approves the facts. */
export function employmentStatusLabel(response?: EmploymentRecord["response"] | null): string {
  return response === "approved" ? "Anställning bekräftad" : response === "disputed" ? "Anställning behöver rättas" : "Anställning registrerad";
}

export function employmentPresentation(employment: EmploymentRecord | null, company: boolean) {
  if (!employment) return {
    title: "Har rekryteringen lett till ett jobb?",
    description: company
      ? "Registrera befattning och startdatum när ni har kommit överens. Kandidaten granskar sedan uppgifterna innan anställningen blir bekräftad här."
      : "Be arbetsgivaren registrera befattning och startdatum. Du får sedan granska uppgifterna innan anställningen blir bekräftad här.",
    action: company ? REGISTER_EMPLOYMENT : "Be arbetsgivaren registrera anställningen",
  };
  if (employment.response === "approved") return {
    title: "Anställning bekräftad",
    description: "Arbetsgivaren och kandidaten har godkänt uppgifterna. Kandidaten väljer själv om erfarenheten ska visas på profilen och i CV:t.",
    action: company ? null : "Ändra synlighet och CV",
  };
  if (employment.response === "disputed") return {
    title: "Uppgifterna behöver rättas",
    description: company
      ? "Kandidaten har invänt mot uppgifterna. Stäm av befattning och startdatum och skicka en rättelse för ny granskning. Anställningen är inte bekräftad här."
      : "Du har bett om en rättelse. När arbetsgivaren uppdaterar uppgifterna får du granska dem igen. Ingen verifierad erfarenhet visas under tiden.",
    action: company ? "Rätta anställningsuppgifter" : "Granska uppgifterna",
  };
  return {
    title: company ? "Inväntar kandidatens granskning" : "Granska din anställning",
    description: company
      ? "Uppgifterna är skickade till kandidaten. Anställningen blir bekräftad här först när kandidaten godkänner dem. Chatten finns kvar."
      : "Arbetsgivaren har registrerat befattning och startdatum. Godkänn om uppgifterna stämmer eller be om en rättelse. Chatten finns kvar.",
    action: company ? "Rätta anställningsuppgifter" : "Granska uppgifterna",
  };
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
