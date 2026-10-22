/**
 * Company verification presentation and input validation. Framework-free so
 * the same rules can serve web and a future mobile app. The database trigger
 * remains responsible for the stored verification status.
 */

export type OrganizationNumberResult =
  | { ok: true; value: string }
  | { ok: false; error: string };

function luhnValid(digits: string): boolean {
  let sum = 0;
  for (let index = 0; index < digits.length; index += 1) {
    let value = Number(digits[index]);
    if (index % 2 === 0) { value *= 2; if (value > 9) value -= 9; }
    sum += value;
  }
  return sum % 10 === 0;
}

/**
 * Accepts Swedish organisation numbers (AB, föreningar including UF entities
 * registered with Skatteverket, handelsbolag) and sole-trader personal
 * identity numbers. Returns the canonical NNNNNN-NNNN form.
 */
export function parseOrganizationNumber(input: string): OrganizationNumberResult {
  const compact = input.trim().replace(/[\s-]/g, "");
  if (!compact) return { ok: false, error: "Ange organisationsnummer." };
  if (!/^\d+$/.test(compact) || (compact.length !== 10 && compact.length !== 12)) {
    return { ok: false, error: "Ange organisationsnumret med 10 siffror, till exempel XXXXXX-XXXX." };
  }
  if (compact.length === 12 && !/^(16|19|20)/.test(compact)) {
    return { ok: false, error: "Ange organisationsnumret med 10 siffror, till exempel XXXXXX-XXXX." };
  }
  const digits = compact.slice(-10);
  // Legal entities use 20–99 in the third and fourth digit; sole traders use
  // their personal number, where those digits are the birth month.
  const group = Number(digits.slice(2, 4));
  const plausibleGroup = group >= 20 || (group >= 1 && group <= 12);
  if (/^(\d)\1{9}$/.test(digits) || !plausibleGroup || !luhnValid(digits)) {
    return { ok: false, error: "Organisationsnumret stämmer inte. Kontrollera siffrorna mot registreringsbeviset." };
  }
  return { ok: true, value: `${digits.slice(0, 6)}-${digits.slice(6)}` };
}

export interface VerificationProfileFields {
  company_name?: string | null;
  organization_number?: string | null;
  administrator?: string | null;
  verification_status?: unknown;
  verification_submitted_at?: string | null;
  verification_rejection_reason?: string | null;
}

export type CompanyVerificationState = "missing" | "submitted" | "needs_completion" | "verified" | "unknown";

export const VERIFICATION_REQUIRED_FIELDS = [
  { key: "company_name", label: "Företagsnamn" },
  { key: "organization_number", label: "Giltigt organisationsnummer" },
  { key: "administrator", label: "Kontaktperson (administratör)" },
] as const;

export function missingVerificationFields(profile: VerificationProfileFields): string[] {
  return VERIFICATION_REQUIRED_FIELDS.filter(({ key }) => {
    const value = profile[key]?.trim() ?? "";
    return key === "organization_number" ? !parseOrganizationNumber(value).ok : !value;
  }).map(({ label }) => label);
}

export function companyVerificationState(profile: VerificationProfileFields | null | undefined): CompanyVerificationState {
  if (!profile) return "unknown";
  const status = profile.verification_status;
  if (status === "verified") return "verified";
  if (status === "rejected") return "needs_completion";
  if (status !== "pending") return "unknown";
  return missingVerificationFields(profile).length ? "missing" : "submitted";
}

export interface CompanyVerificationSummary {
  state: CompanyVerificationState;
  title: string;
  body: string;
  /** Required fields that still block review. Empty when nothing is missing. */
  missing: string[];
  submittedOn: string | null;
  tone: "success" | "warning" | "error" | "neutral";
}

function formatDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString("sv-SE", { day: "numeric", month: "long", year: "numeric" });
}

export const VERIFICATION_HELP_TEXT =
  "Om MatchnWork behöver mer underlag får du en notis med vad som ska kompletteras. Rätta uppgifterna under Företagsuppgifter och spara, så skickas de in för ny granskning.";

export function companyVerificationSummary(profile: VerificationProfileFields | null | undefined): CompanyVerificationSummary {
  const state = companyVerificationState(profile);
  const missing = profile ? missingVerificationFields(profile) : [];
  const submittedOn = formatDate(profile?.verification_submitted_at);
  switch (state) {
    case "verified":
      return { state, missing: [], submittedOn, tone: "success", title: "Godkänt företag", body: "Företaget är verifierat. Aktiva annonser är synliga för ungdomar." };
    case "needs_completion":
      return {
        state, missing, submittedOn, tone: "error", title: "Behöver kompletteras",
        body: `${profile?.verification_rejection_reason?.trim() || "MatchnWork behöver fler eller rättade uppgifter."} Rätta uppgifterna och spara för att skicka in dem igen.`,
      };
    case "missing":
      return { state, missing, submittedOn: null, tone: "warning", title: "Uppgifter saknas", body: "Underlaget är inte inskickat. Fyll i uppgifterna nedan och spara, så skickas de till MatchnWork för granskning." };
    case "submitted":
      return {
        state, missing: [], submittedOn, tone: "neutral", title: "Inskickat – under granskning",
        body: `${submittedOn ? `Underlaget skickades in ${submittedOn}. ` : "Underlaget är inskickat. "}MatchnWork granskar uppgifterna manuellt i den ordning de kommer in. Du kan skapa annonser under tiden; aktiva annonser publiceras när företaget har godkänts.`,
      };
    default:
      return { state, missing: [], submittedOn: null, tone: "neutral", title: "Status kunde inte kontrolleras", body: "Verifieringsstatus kunde inte hämtas. Ladda om sidan för att se om underlaget är inskickat." };
  }
}

/**
 * Progress for the normal path. Granskas follows submission because the
 * database stores no separate "review started" event. Rejected and unknown
 * states show their own explanation instead of steps.
 */
export function verificationSteps(state: CompanyVerificationState) {
  const reached = { missing: 0, submitted: 2, verified: 4 }[state as "missing" | "submitted" | "verified"];
  if (reached === undefined) return [];
  return [
    { label: "Uppgifter ifyllda", done: reached >= 1, current: reached === 0 },
    { label: "Inskickat", done: reached >= 2, current: false },
    { label: "Granskas av MatchnWork", done: reached >= 4, current: reached === 2 },
    { label: "Godkänt", done: reached >= 4, current: false },
  ];
}

/** True when saving would make an already approved company go through review again. */
export function changeRequiresReverification(profile: VerificationProfileFields | null | undefined, nextOrganizationNumber: string): boolean {
  if (profile?.verification_status !== "verified") return false;
  const current = (profile.organization_number ?? "").replace(/[\s-]/g, "");
  return current !== nextOrganizationNumber.trim().replace(/[\s-]/g, "");
}

/**
 * The database trigger compares stored text, so keep the stored spelling when
 * only the dash differs. Otherwise an unchanged number would restart review.
 */
export function organizationNumberForSave(stored: string | null | undefined, canonical: string): string {
  return stored && stored.replace(/[\s-]/g, "") === canonical.replace(/-/g, "") ? stored : canonical;
}
