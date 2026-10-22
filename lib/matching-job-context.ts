import { minimizeMatchingText } from "./matching-input-policy";
/** Job data stays separate from candidate evidence: a requirement is no proof. */
export function matchingJobContext(profile: Record<string,unknown>): string {
  const job = profile.job_context;
  if (!job || typeof job !== "object" || Array.isArray(job)) return "";
  const allowed = ["title","description","requirements","employment_type","schedule","workplace_cities"];
  return minimizeMatchingText(allowed.flatMap(key => {
    const value = (job as Record<string,unknown>)[key];
    return value === undefined || value === null ? [] : [`${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`];
  }).join("\n")).text;
}
