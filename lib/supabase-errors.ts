"use client";

function hasStringProperty(value: unknown, key: string): value is Record<string, string> {
  return typeof value === "object" && value !== null && key in value && typeof (value as Record<string, unknown>)[key] === "string";
}

export function getSupabaseErrorMessage(error: unknown, fallback: string): string {
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

  console.error(`[Supabase] ${action}`, payload);
}
