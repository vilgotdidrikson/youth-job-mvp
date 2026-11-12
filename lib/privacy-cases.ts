/** Shared contracts; no Auth metadata or UI framework is used for authorization. */
export const PRIVACY_CASE_KINDS = { access: "Tillgång till mina uppgifter", correction: "Rätta uppgifter", deletion: "Radering", restriction: "Begränsa behandling", objection: "Invända mot behandling", portability: "Dataportabilitet", other: "Annan personuppgiftsfråga" } as const;
export const PRIVACY_CASE_STATUSES = { new: "Mottaget", in_progress: "Handläggs", waiting_for_user: "Väntar på ditt svar", closed: "Avslutat" } as const;
export type PrivacyCaseKind = keyof typeof PRIVACY_CASE_KINDS;
export type PrivacyCaseStatus = keyof typeof PRIVACY_CASE_STATUSES;
export type CaseCursor = { created_at: string; id: string };
export type PrivacyCaseEvent = { id: string; action: string; public_message: string | null; created_at: string };
export type PrivacyCase = { id: string; requester_id: string | null; kind: PrivacyCaseKind; body: string; status: PrivacyCaseStatus; revision: string; created_at: string; updated_at: string; reply_due_at: string; closed_at: string | null; review_after?: string | null; assigned: boolean; is_mine: boolean; events: PrivacyCaseEvent[]; events_truncated: boolean };
export type PrivacyCasePage = { available: boolean; cases: PrivacyCase[]; next: CaseCursor | null };
export type PrivacyCaseHistoryPage = { id: string; revision: string; events: PrivacyCaseEvent[]; next: CaseCursor | null };
export type CaseAction = "claim" | "reply" | "waiting" | "close" | "reopen";
export const isUuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(v);
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const timestamp = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v) && Number.isFinite(Date.parse(v));
export function caseText(v: unknown, required = true): string {
  if (typeof v !== "string" || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(v) || v.length > 4000 || required && !v.trim()) throw Error("Ange en beskrivning på högst 4 000 tecken.");
  return v.trim();
}
export function parseCaseCursor(v: unknown): CaseCursor | null {
  if (v === undefined || v === null) return null;
  if (!object(v) || Object.keys(v).sort().join() !== "created_at,id" || !isUuid(v.id) || !timestamp(v.created_at)) throw Error("Ogiltig sidmarkör.");
  return { id: v.id, created_at: v.created_at };
}
export function parsePrivacyCase(v: unknown, owner?: string): PrivacyCase {
  if (!object(v) || !isUuid(v.id) || !isUuid(v.revision) || v.requester_id !== null && !isUuid(v.requester_id) || owner && v.requester_id !== owner || typeof v.kind !== "string" || !Object.hasOwn(PRIVACY_CASE_KINDS, v.kind) || typeof v.status !== "string" || !Object.hasOwn(PRIVACY_CASE_STATUSES, v.status) || ![v.created_at, v.updated_at, v.reply_due_at].every(timestamp) || v.closed_at !== null && !timestamp(v.closed_at) || v.review_after != null && !timestamp(v.review_after) || ![v.assigned,v.is_mine,v.events_truncated].every(x => typeof x === "boolean") || !Array.isArray(v.events) || v.events.length > 20) throw Error("Ärendet kunde inte verifieras.");
  const events = parseCaseEvents(v.events);
  // Explicit projection: never forward extra server fields, handler identities or notes.
  return { id: v.id, requester_id: v.requester_id as string | null, kind: v.kind as PrivacyCaseKind, body: caseText(v.body), status: v.status as PrivacyCaseStatus, revision: v.revision, created_at: v.created_at as string, updated_at: v.updated_at as string, reply_due_at: v.reply_due_at as string, closed_at: v.closed_at as string | null, review_after: owner ? null : v.review_after as string | null ?? null, assigned: v.assigned as boolean, is_mine: v.is_mine as boolean, events_truncated: v.events_truncated as boolean, events };
}
function parseCaseEvents(value: unknown): PrivacyCaseEvent[] {
  if (!Array.isArray(value) || value.length > 20) throw Error("Ärendehistoriken kunde inte verifieras.");
  const events = value.map(e => {
    if (!object(e) || !isUuid(e.id) || !["created","claim","reply","waiting","close","reopen","user_reply"].includes(String(e.action)) || !timestamp(e.created_at)) throw Error("Ärendehistoriken kunde inte verifieras.");
    return { id: e.id, action: e.action as string, created_at: e.created_at, public_message: e.public_message === null ? null : caseText(e.public_message) };
  });
  if (new Set(events.map(e => e.id)).size !== events.length || events.some((e, i) => i > 0 && compareCaseEvents(events[i - 1], e) >= 0)) throw Error("Ärendehistoriken kunde inte verifieras.");
  return events;
}
export function compareCaseEvents(a: CaseCursor, b: CaseCursor) {
  const fraction = (v: string) => Number((/\.(\d+)/.exec(v)?.[1] ?? "").padEnd(9, "0").slice(3));
  return Date.parse(a.created_at) - Date.parse(b.created_at) || fraction(a.created_at) - fraction(b.created_at) || a.id.toLowerCase().localeCompare(b.id.toLowerCase());
}
export function parsePrivacyCaseHistory(v: unknown, item: Pick<PrivacyCase, "id" | "revision">, before: CaseCursor): PrivacyCaseHistoryPage {
  if (!object(v) || v.id !== item.id || v.revision !== item.revision) throw Error("Ärendet har ändrats. Läs aktuell status igen.");
  const events = parseCaseEvents(v.events), next = parseCaseCursor(v.next);
  if (events.some(e => compareCaseEvents(e, before) >= 0) || next && (!events.length || compareCaseEvents(next, events[0]) !== 0)) throw Error("Ärendehistoriken kunde inte verifieras.");
  return { id: item.id, revision: item.revision, events, next };
}
export function privacyCaseFollowup(item: PrivacyCase, now = Date.now()) {
  if (item.status === "closed") return null;
  const reply = Date.parse(item.reply_due_at), review = item.review_after ? Date.parse(item.review_after) : Infinity;
  return { due: Math.min(reply, review), replyOverdue: reply <= now, reviewOverdue: review <= now };
}
export function parsePrivacyCasePage(v: unknown, owner?: string): PrivacyCasePage {
  if (!object(v) || typeof v.available !== "boolean" || !Array.isArray(v.cases) || v.cases.length > 20) throw Error("Ärenden kunde inte läsas.");
  const cases = v.cases.map(c => parsePrivacyCase(c, owner));
  if (new Set(cases.map(c => c.id)).size !== cases.length) throw Error("Dubbla ärenden i svaret.");
  return { available: v.available, cases, next: parseCaseCursor(v.next) };
}
