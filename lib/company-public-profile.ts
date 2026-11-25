import { getSupabaseClient } from "./supabase";

/** What a youth may see about the employer behind a listing (N04). Reusable by a future mobile client. */
export interface PublicCompanyProfile {
  companyName: string;
  industry: string;
  description: string;
  city: string;
  employeeCount: string;
  logoUrl: string;
  websiteUrl: string;
  verified: boolean;
  openJobs: number;
}

const text = (value: unknown) => typeof value === "string" ? value.trim() : "";

/** Only plain http(s) links are shown; anything else (javascript:, data:, typos) is dropped. */
export function safeExternalUrl(value: unknown): string {
  const raw = text(value);
  if (!raw) return "";
  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(raw) ? raw : `https://${raw}`);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : "";
  } catch { return ""; }
}

export function readPublicCompanyProfile(raw: unknown): PublicCompanyProfile | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const data = raw as Record<string, unknown>;
  const openJobs = Number(data.open_jobs);
  return {
    companyName: text(data.company_name),
    industry: text(data.industry),
    description: text(data.description),
    city: text(data.city),
    employeeCount: text(data.employee_count),
    logoUrl: safeExternalUrl(data.logo_url),
    websiteUrl: safeExternalUrl(data.website_url),
    verified: data.verified === true,
    openJobs: Number.isFinite(openJobs) && openJobs > 0 ? Math.floor(openJobs) : 0,
  };
}

/** Short line under the name, e.g. "Café · Stockholm · 10–49 anställda". */
export function companyFacts(profile: PublicCompanyProfile): string[] {
  return [profile.industry, profile.city, profile.employeeCount && (/anställd/i.test(profile.employeeCount) ? profile.employeeCount : `${profile.employeeCount} anställda`)].filter(Boolean);
}

export async function getJobCompanyProfile(jobId: string): Promise<PublicCompanyProfile> {
  const { data, error } = await getSupabaseClient().rpc("get_job_company_profile", { p_job_id: jobId });
  const profile = error ? null : readPublicCompanyProfile(data);
  if (!profile) throw new Error("Företagets profil kunde inte visas just nu.");
  return profile;
}
