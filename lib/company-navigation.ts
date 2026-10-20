export const COMPANY_ROUTES = {
  listings: "/company?view=annonser",
  create: "/company?view=skapa",
  candidates: "/company?view=kandidater",
  account: "/profile?tab=settings",
} as const;

export function createdCompanyJobHref(jobId: string): string {
  return `${COMPANY_ROUTES.listings}&created=${encodeURIComponent(jobId)}`;
}

export type CompanyView = "annonser" | "skapa" | "kandidater";

/** The URL is the single source of truth, including client-side navigation. */
export function companyView(view: string | null, verified = false): CompanyView {
  if (view === "annonser" || view === "skapa" || view === "kandidater") return view;
  if (view === "swipe") return verified ? "kandidater" : "skapa";
  return "annonser";
}

export type ProfileTab = "overview" | "work" | "cv" | "details" | "settings";
export function profileTabFromQuery(tab: string | null): ProfileTab {
  return tab === "work" || tab === "cv" || tab === "details" || tab === "settings" ? tab : "overview";
}
