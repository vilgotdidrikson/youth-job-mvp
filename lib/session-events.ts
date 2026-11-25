import type { AuthChangeEvent, User } from "@supabase/supabase-js";

/** A token rotation changes credentials, not the account identity used by page effects. */
export function sessionUserForEvent(previous: User | null, incoming: User | null, event?: AuthChangeEvent): User | null {
  if (event === "TOKEN_REFRESHED" && previous && incoming?.id === previous.id) return previous;
  return incoming;
}
