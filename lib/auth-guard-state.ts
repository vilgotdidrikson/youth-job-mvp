export type AuthGuardStatus = "checking" | "redirecting" | "error" | "ready";

export function authGuardStatus(loading: boolean, userId: string | null, profileId: string | null, error: string | null): AuthGuardStatus {
  if (loading) return "checking";
  if (error) return "error";
  if (!userId) return "redirecting";
  return profileId === userId ? "ready" : "checking";
}
