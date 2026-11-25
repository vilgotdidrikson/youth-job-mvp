export const PRODUCTION_SUPABASE_URL = "https://iarnopkuoqumictgnqin.supabase.co";

export function isPrelaunchMode(hostname: string): boolean {
  const mode = process.env.MATCHNWORK_LAUNCH_MODE;
  if (mode === "prelaunch") return true;
  if (mode === "live") return false;

  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
  return projectUrl === PRODUCTION_SUPABASE_URL || hostname === "matchnwork.se" || hostname === "www.matchnwork.se";
}
