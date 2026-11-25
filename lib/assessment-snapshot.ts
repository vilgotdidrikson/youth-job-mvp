/** Shared by the request handler and queue worker; no framework or provider dependencies. */
export function disclosureRevision(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
}

export function sameDisclosure(packet: unknown, input: unknown): boolean {
  if (!packet || typeof packet !== "object" || !input || typeof input !== "object") return false;
  const revision = disclosureRevision((packet as Record<string, unknown>).revision);
  return revision !== null && revision === disclosureRevision((input as Record<string, unknown>).disclosure_revision);
}

export function currentAssessment(result: unknown, revision: unknown): boolean {
  if (!result || typeof result !== "object" || disclosureRevision(revision) === null) return false;
  const value = result as Record<string, unknown>;
  return value.policyVersion === 10 && value.disclosureRevision === revision;
}
