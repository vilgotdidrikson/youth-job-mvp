import type { ExportCategory } from "./personal-data-export";

type Data = NonNullable<ExportCategory["records"]>[number]["data"];
const escape = (value: string) => value.replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
const sources: Record<string, string> = {
  "public.ai_onboarding_sessions": "CV-utkastets status", "public.youth_videos": "Videons livscykel", "public.notifications": "Notisens lässtatus",
  "public.profiles": "Kontotyp", "public.youth_profiles": "Profilens status", "public.company_profiles": "Företagsprofilens status", "public.private_profiles": "Uppdragsgivarens profil", "public.company_billing_details": "Fakturaunderlagets version",
  "public.youth_application_drafts": "Ansökningsutkast", "public.youth_saved_jobs": "Sparat jobb", "public.youth_job_impressions": "Visat jobb", "public.youth_job_dismissals": "Bortvalt jobb", "public.swipe_actions": "Jobbval", "public.application_workplace_preferences": "Vald arbetsplats",
  "public.application_completions": "Ansökningsstatus", "public.application_followups": "Kompletteringsfrågans status", "private.application_disclosures": "Delat underlags version", "public.candidate_assessments": "Bedömningens version",
  "public.jobs": "Annonsens status", "public.company_match_profiles": "Företagsprofilens version", "public.company_recruitment_controls": "Rekryteringsbehörighet", "public.recruitment_outcomes": "Rekryteringens utfall",
};
const fields: Record<string, string> = {
  id: "Postens ID", owner_id: "Ägarens konto-ID", completed_at: "Slutförd", read_at: "Läst", first_sent_at: "Först skickad", expires_at: "Utgångstid", revoked_at: "Återkallad", cleanup_started_at: "Städning påbörjad", deleted_at: "Radering registrerad", user_id: "Konto-ID", youth_user_id: "Konto-ID", company_user_id: "Konto-ID", job_id: "Annonsens ID", workplace_id: "Arbetsplatsens ID", role: "Kontotyp",
  onboarding_completed: "Profilintroduktion klar", cv_generated: "CV genererat", cv_uploaded: "CV uppladdat", short_onboarding_completed: "Kort introduktion klar", recruitment_profile_version: "Jobbprofilens version",
  created_at: "Skapad", updated_at: "Uppdaterad", first_seen_at: "Först visad", dismissed_at: "Bortvald", decision: "Ditt val", status: "Status", publication_status: "Publiceringsstatus", job_kind: "Typ av jobb", is_active: "Aktiv", job_category_manual: "Jobbtyp vald manuellt", first_published_at: "Först publicerad",
  verification_status: "Verifieringsstatus", verification_submitted_at: "Skickad för verifiering", verified_at: "Verifierad", country_code: "Land", version: "Version", profile_version: "Kravprofilens version", job_profile_version: "Kravprofilens version", question_batch_version: "Frågeomgångens version", revision: "Underlagets revision",
  submitted_at: "Ansökan skickad", supplemented_at: "Kompletterad", withdrawn_at: "Återkallad", question_source: "Frågans källa", answered_at: "Besvarad", restriction: "Rekryteringsbegränsning", changed_at: "Ändrad", outcome: "Utfall", recorded_at: "Registrerat",
};
const values: Record<string, Record<string, string>> = {
  role: { youth: "Ungdom", company: "Företag", private: "Privat uppdragsgivare" },
  verification_status: { pending: "Väntar på verifiering", verified: "Verifierat", rejected: "Inte godkänt" },
  decision: { interested: "Intresserad", skip: "Bortvald" },
  publication_status: { pending_verification: "Väntar på verifiering", published: "Publicerad" },
  job_kind: { employment: "Anställning", private_task: "Privat uppdrag" },
  question_source: { automatic: "Automatisk fråga", company: "Företagets fråga" },
  restriction: { none: "Ingen begränsning", limited: "Begränsad", suspended: "Avstängd" },
  outcome: { hired: "Anställning registrerad", no_hire: "Ingen anställd", continuing: "Rekryteringen fortsätter" },
  country_code: { SE: "Sverige (SE)" },
};
const statuses: Record<string, Record<string, string>> = {
  "public.ai_onboarding_sessions": { in_progress: "Pågående", completed: "Slutförd" },
  "public.application_completions": { needs_completion: "Kan kompletteras", submitted: "Skickad", unavailable: "Inte tillgänglig", withdrawn: "Återkallad" },
  "public.application_followups": { pending: "Obesvarad", answered: "Besvarad", skipped: "Avstått" },
  "public.jobs": { active: "Aktiv", paused: "Pausad", closed: "Stängd" },
};
const dateLabel = new Intl.DateTimeFormat("sv-SE", { dateStyle: "long", timeStyle: "medium", timeZone: "Europe/Stockholm" });
function valueHtml(value: Data, field: string, source: string, knownSource: boolean) {
  if (value === null) return "Inget angivet värde";
  if (typeof value === "boolean") return value ? "Ja" : "Nej";
  if (typeof value === "string" && knownSource) {
    const dictionary = field === "status" ? statuses[source] : Object.hasOwn(values, field) ? values[field] : undefined;
    if (dictionary && Object.hasOwn(dictionary, value)) return escape(dictionary[value]);
    if (Object.hasOwn(fields, field) && field.endsWith("_at") && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value))) return `<time datetime="${escape(value)}">${escape(dateLabel.format(new Date(value)))} (Stockholm)</time>`;
  }
  if (typeof value === "object") return `<code class="record-json">${escape(JSON.stringify(value, null, 2))}</code>`;
  return escape(String(value));
}

/** Presentation ONLY, after the package builder's plain-data/scope validation.
 * No projection, truncation, authorization or rights approval happens here.
 * Unknown fields/sources and generic reviewed text remain visible verbatim.
 */
export function readableExportRecord(data: Data, position: number): string {
  if (data === null || typeof data !== "object" || Array.isArray(data)) return `<article class="record"><h3>Post ${position}</h3><div class="record-value"><bdi>${valueHtml(data, "", "", false)}</bdi></div></article>`;
  const source = typeof data.source === "string" ? data.source : "", known = Object.hasOwn(sources, source);
  const heading = known ? sources[source] : `Post ${position}`;
  const entries = Object.entries(data).filter(([field]) => !(known && field === "source"));
  return `<article class="record"><h3>${escape(heading)}${known ? ` · ${position}` : ""}</h3><dl>${entries.map(([field, value]) => `<dt>${escape(known && Object.hasOwn(fields, field) ? (source === "public.company_match_profiles" && field === "profile_version" ? "Företagsprofilens version" : fields[field]) : field)}</dt><dd><bdi>${valueHtml(value, field, source, known)}</bdi></dd>`).join("")}</dl></article>`;
}
