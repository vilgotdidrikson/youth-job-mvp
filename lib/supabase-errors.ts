"use client";

function hasStringProperty(value: unknown, key: string): value is Record<string, string> {
  return typeof value === "object" && value !== null && key in value && typeof (value as Record<string, unknown>)[key] === "string";
}

export const NETWORK_ERROR_MESSAGE = "Kunde inte nå servern. Kontrollera anslutningen och försök igen.";

// Browsers reject fetch with a TypeError when no response arrives (offline,
// blocked by an extension, DNS). Supabase wraps it as AuthRetryableFetchError
// in auth and as a "TypeError: Failed to fetch" message in PostgREST errors;
// errors rethrown with NETWORK_ERROR_MESSAGE stay recognizable.
export function isNetworkError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  if ((error as { name?: unknown }).name === "AuthRetryableFetchError") return true;
  const message = hasStringProperty(error, "message") ? error.message : "";
  return message === NETWORK_ERROR_MESSAGE || /failed to fetch|load failed|networkerror|network request failed/i.test(message);
}

export function getSupabaseErrorMessage(error: unknown, fallback: string): string {
  if (isNetworkError(error)) {
    return NETWORK_ERROR_MESSAGE;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (hasStringProperty(error, "message")) {
    return error.message;
  }

  return fallback;
}

export function logSupabaseError(
  action: string,
  error: unknown,
  metadata?: unknown,
): void {
  const payload: Record<string, unknown> = {
    message: getSupabaseErrorMessage(error, "Unknown Supabase error."),
  };

  if (hasStringProperty(error, "code")) {
    payload.code = error.code;
  }

  if (hasStringProperty(error, "details")) {
    payload.details = error.details;
  }

  if (hasStringProperty(error, "hint")) {
    payload.hint = error.hint;
  }

  if (metadata) {
    payload.metadata = metadata;
  }

  payload.error = error;

  // A lost connection is not an application bug; keep it out of the dev overlay.
  if (isNetworkError(error)) {
    console.warn(`[Supabase] ${action}`, payload);
    return;
  }

  console.error(`[Supabase] ${action}`, payload);
}
