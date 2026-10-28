import { randomUUID } from "node:crypto";

const events = ["job_generation_failed", "voice_session_upstream_failed", "voice_session_transport_failed", "voice_turn_failed", "cv_generation_failed", "account_delete_recipients_failed", "account_delete_files_failed", "account_delete_notification_failed", "application_submission_failed"] as const;
type FailureEvent = typeof events[number];
type FailureCategory = "permission" | "rate_limit" | "timeout" | "conflict" | "invalid_data" | "upstream" | "unknown";

/** No message, stack, body, header, URL, identifier or getter is serialized. */
function scalar(error: unknown, key: string): unknown {
  if (!error || (typeof error !== "object" && typeof error !== "function")) return undefined;
  try {
    const descriptor = Object.getOwnPropertyDescriptor(error, key);
    return descriptor && "value" in descriptor ? descriptor.value : undefined;
  } catch { return undefined; }
}

export function failureCategory(error: unknown, status?: number): FailureCategory {
  const code = scalar(error, "code"), name = scalar(error, "name");
  if (status === 401 || status === 403 || code === "42501") return "permission";
  if (status === 429 || code === "rate_limit_exceeded" || code === "insufficient_quota") return "rate_limit";
  if (status === 408 || status === 504 || code === "57014" || name === "AbortError" || name === "TimeoutError" || name === "APIConnectionTimeoutError") return "timeout";
  if (code === "23505" || code === "40001") return "conflict";
  if (code === "22023" || code === "23503") return "invalid_data";
  if (typeof status === "number" && status >= 500 && status <= 599) return "upstream";
  return "unknown";
}

/** Fixed metadata only; arbitrary upstream values never become log fields. */
export function reportServerFailure(event: FailureEvent, error?: unknown, httpStatus?: number): string {
  const incidentId = randomUUID();
  const suppliedStatus = httpStatus ?? scalar(error, "status");
  const status = typeof suppliedStatus === "number" && Number.isInteger(suppliedStatus) && suppliedStatus >= 100 && suppliedStatus <= 599 ? suppliedStatus : undefined;
  try {
    console.error("MatchnWork server failure", {
      event: events.includes(event) ? event : "server_failure", incidentId,
      category: failureCategory(error, status), ...(status === undefined ? {} : { status }),
    });
  } catch { /* A diagnostic sink must not break recovery, deletion or fallback. */ }
  return incidentId;
}

/** Public submission errors are fixed copy, never a database exception string. */
export function applicationSubmissionFailure(error: unknown) {
  const code = scalar(error, "code");
  if (code === "42501") {
    const cvRequired = scalar(error, "message") === "Complete your CV first";
    return { status: 403, error: cvRequired ? "Gör klart ditt CV innan du skickar ansökan." : "Ansökan är inte tillgänglig. Uppdatera sidan och kontrollera att du är inloggad på rätt konto." };
  }
  return { status: 409, error: code === "22023" ? "Kontrollera dina ansökningssvar och försök igen." : "Ansökan kunde inte uppdateras. Hämta aktuell status innan du försöker igen." };
}
