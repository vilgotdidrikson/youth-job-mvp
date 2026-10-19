import { createEmptyStructuredCv, renderStructuredCv, type StructuredCvData } from "./structured-cv";
import { emptyRecruitmentProfile, readRecruitmentProfile, type RecruitmentProfile } from "./recruitment-profile";
import { candidateSourceDetails } from "./candidate-assessment";

export interface DisclosureItem { key: string; label: string; text: string; value: unknown }
export interface ApplicationDisclosure {
  version: number; revision?: number; shared_at?: string;
  job_id: string; youth_user_id: string; job_title: string; company_name: string;
  identity: { full_name: string | null; age: number | null };
  cv: { text: string; structured: Record<string, unknown>; documents: {type:string;url:string;name:string}[] };
  practical: { city: string | null; availability: RecruitmentProfile["availability"] };
  profile_items: DisclosureItem[];
  answers?: Record<string,string>; followup_answers?: {question:string;answer:string}[];
}
export interface DisclosurePreview {
  packet: ApplicationDisclosure; options: DisclosureItem[]; selected_keys: string[];
  source_token: string; is_saved: boolean; matching_input: Record<string,unknown>;
}
/** Reconstruct only explicitly shared optional facts, never a complete profile. */
export function disclosedRecruitmentProfile(packet: ApplicationDisclosure): RecruitmentProfile {
  const profile = emptyRecruitmentProfile();
  profile.availability = { ...profile.availability, ...packet.practical.availability };
  for (const item of packet.profile_items) {
    if (item.value === null) continue;
    const kind = item.key.split(":")[0];
    if (kind === "motivation" && typeof item.value === "string") profile.preferences.motivation = item.value;
    if (kind === "licences" && typeof item.value === "string") profile.qualifications.licences.push(item.value);
    if (kind === "tools" && typeof item.value === "string") profile.qualifications.tools.push(item.value);
    if (kind === "languages" && item.value && typeof item.value === "object") profile.qualifications.languages.push(item.value as RecruitmentProfile["qualifications"]["languages"][number]);
    if (kind === "example" && item.value && typeof item.value === "object") profile.examples.push(item.value as RecruitmentProfile["examples"][number]);
  }
  return readRecruitmentProfile(profile);
}
export function disclosedMatchingSource(packet: ApplicationDisclosure, pdfText = "") {
  return candidateSourceDetails({ full_name:packet.identity.full_name, cv_text: packet.cv.text, cv_structured: packet.cv.structured, pdf_cv_text:pdfText,
    recruitment_profile: disclosedRecruitmentProfile(packet), answers: packet.answers,
    followup_answers: packet.followup_answers });
}

export function disclosedCvText(packet: ApplicationDisclosure): string {
  if (typeof packet.cv.text === "string" && packet.cv.text.trim()) return packet.cv.text;
  const raw = packet.cv.structured;
  if (!raw || typeof raw.profile !== "object" || !raw.profile) return "";
  const empty = createEmptyStructuredCv();
  const cv = { ...empty, ...raw, personalInfo: {name:packet.identity.full_name ?? "",city:packet.practical.city ?? ""}, profile: { ...empty.profile, ...raw.profile } };
  for (const key of ["workExperience","education","projects","skills","certifications","languages","otherExperience"] as const) {
    if (!Array.isArray(cv[key])) cv[key] = [];
  }
  try { return renderStructuredCv(cv as StructuredCvData); } catch { return ""; }
}
