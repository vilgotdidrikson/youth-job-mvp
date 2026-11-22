import { firstResponseTarget } from "./privacy-case-response";
/** Shared contracts; no Auth metadata or UI framework is used for authorization. */
export const PRIVACY_CASE_KINDS = { access: "Tillgång till mina uppgifter", correction: "Rätta uppgifter", deletion: "Radering", restriction: "Begränsa behandling", objection: "Invända mot behandling", portability: "Dataportabilitet", other: "Annan personuppgiftsfråga" } as const;
export const PRIVACY_CASE_STATUSES = { new: "Mottaget", in_progress: "Handläggs", waiting_for_user: "Väntar på ditt svar", closed: "Avslutat" } as const;
export type PrivacyCaseKind = keyof typeof PRIVACY_CASE_KINDS;
export type PrivacyCaseStatus = keyof typeof PRIVACY_CASE_STATUSES;
export const CASE_QUEUE_FILTERS = {all:"Alla ärenden",open:"Öppna",unassigned:"Ej tilldelade",mine:"Mina öppna",waiting:"Väntar på användaren",closed:"Avslutade",reply_overdue:"Svarsdatum passerat",review_overdue:"Uppföljning passerad",due_soon:"Svars- och uppföljningsdatum inom sju dagar",email:"Mejlärenden",incidents:"Interna incidenter"} as const;
export type CaseQueueFilter=keyof typeof CASE_QUEUE_FILTERS;
export function matchesCaseQueue(item:PrivacyCase,filter:CaseQueueFilter,now=Date.now()) {
  if (filter==="incidents") return item.intake_source==="incident";
  if (item.intake_source==="incident") return false;
  if(filter==="reply_overdue"||filter==="review_overdue")return item.status!=="closed"&&(filter==="reply_overdue"?Date.parse(item.reply_due_at):item.review_after?Date.parse(item.review_after):Infinity)<=now;
  if (filter === "due_soon") {
    const until = now + 7 * 24 * 60 * 60 * 1000;
    return item.status !== "closed" && [item.reply_due_at, item.review_after].some(value => {
      const time = value ? Date.parse(value) : NaN;
      return time > now && time <= until;
    });
  }
  if(filter==="email")return item.intake_source==="email";
  return filter==="all"||filter==="closed"&&item.status==="closed"||filter==="open"&&item.status!=="closed"||filter==="waiting"&&item.status==="waiting_for_user"||filter==="unassigned"&&item.status!=="closed"&&!item.assigned||filter==="mine"&&item.status!=="closed"&&item.is_mine;
}
export type CaseCursor = { created_at: string; id: string };
export type PrivacyCaseEvent = { id: string; action: string; public_message: string | null; created_at: string; review_after?:string|null;external_sent_at?:string|null };
export type PrivacyCase = { id: string; requester_id: string | null;intake_source?:"portal"|"email"|"incident";contact_email?:string|null; kind: PrivacyCaseKind; body: string; status: PrivacyCaseStatus; revision: string; created_at: string; updated_at: string; reply_due_at: string; closed_at: string | null; retention_until?: string | null; review_after?: string | null; first_reply_at?: string | null; assigned: boolean; is_mine: boolean; events: PrivacyCaseEvent[]; events_truncated: boolean };
export type PrivacyCasePage = { available: boolean; cases: PrivacyCase[]; next: CaseCursor | null; as_of?:string };
export type PrivacyCaseHistoryPage = { id: string; revision: string; events: PrivacyCaseEvent[]; next: CaseCursor | null };
export type CaseAction = "claim" | "reply" | "waiting" | "close" | "reopen" | "review" | "schedule_review";
export type CaseWriteInput={action:CaseAction;id:string;revision:string;eventId:string;message:string;reviewAfter?:string;externalReplyConfirmed?:boolean;externalSentAt?:string};
export type EmailCaseInput={action:"email_create";id:string;kind:PrivacyCaseKind;body:string;contactEmail:string;receivedAt:string};
export type IncidentCaseInput = { action: "incident_create"; id: string; body: string; awareAt: string };
export type AdminCaseInput=IncidentCaseInput|{action:"list";cursor:CaseCursor|null;filter?:CaseQueueFilter}|{action:"find";id:string}|CaseWriteInput|EmailCaseInput|{action:"purge";id:string;revision:string;confirmed:true};
export function privacyCaseRetentionEnabled() {
  return process.env.NEXT_PUBLIC_PRIVACY_CASE_RETENTION_ENABLED === "true" &&
    process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") === "https://vwcfjvwfeatvuisojwrh.supabase.co";
}
export type CaseActionResult={ok:true}|{ok:false;rejected:boolean};
export function caseContactEmail(value:unknown):string {
 if(typeof value!=="string"||value.length>254||!/^\s*[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+\s*$/.test(value)||/[\u0000-\u001f\u007f]/.test(value))throw Error("Ange en giltig kontaktadress.");return value.trim().toLowerCase();
}
export function casePastTime(value:unknown,earliest?:string,now=Date.now()):string {
 if(typeof value!=="string"||!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value)||!Number.isFinite(Date.parse(value))||Date.parse(value)>now||earliest&&Date.parse(value)<Date.parse(earliest))throw Error("Ange en giltig tidigare tid; ett svar måste vara skickat efter mottagandet.");return new Date(value).toISOString();
}
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
  if (!object(v) || !isUuid(v.id) || !isUuid(v.revision) || v.requester_id !== null && !isUuid(v.requester_id) || owner && v.requester_id !== owner || typeof v.kind !== "string" || !Object.hasOwn(PRIVACY_CASE_KINDS, v.kind) || typeof v.status !== "string" || !Object.hasOwn(PRIVACY_CASE_STATUSES, v.status) || ![v.created_at, v.updated_at, v.reply_due_at].every(timestamp) || v.closed_at !== null && !timestamp(v.closed_at) || v.first_reply_at != null && !timestamp(v.first_reply_at) || v.review_after != null && !timestamp(v.review_after) || v.retention_until != null && !timestamp(v.retention_until) || ![v.assigned,v.is_mine,v.events_truncated].every(x => typeof x === "boolean") || !Array.isArray(v.events) || v.events.length > 20) throw Error("Ärendet kunde inte verifieras.");
  if(v.intake_source!==undefined&&v.intake_source!=="portal"&&v.intake_source!=="email"&&v.intake_source!=="incident")throw Error("Ärendets källa kunde inte verifieras.");
  const email=v.intake_source==="email";if(email&&(owner||v.requester_id!==null||caseContactEmail(v.contact_email)!==v.contact_email)||!email&&v.contact_email!=null)throw Error("Kontaktuppgiften kunde inte verifieras.");
  const incident=v.intake_source==="incident";
  if (incident && (owner || v.requester_id!==null || v.kind!=="other")) throw Error("Incidenten är endast tillgänglig internt.");
  const events = parseCaseEvents(v.events,owner);
  // Explicit projection: never forward extra server fields, handler identities or notes.
  return { intake_source:incident?"incident":email?"email":"portal",contact_email:email?v.contact_email as string:null,id: v.id, requester_id: v.requester_id as string | null, kind: v.kind as PrivacyCaseKind, body: caseText(v.body), status: v.status as PrivacyCaseStatus, revision: v.revision, created_at: v.created_at as string, updated_at: v.updated_at as string, reply_due_at: v.reply_due_at as string, closed_at: v.closed_at as string | null, first_reply_at: owner ? null : v.first_reply_at as string | null | undefined, retention_until: owner ? null : v.retention_until as string | null ?? null, review_after: owner ? null : v.review_after as string | null ?? null, assigned: v.assigned as boolean, is_mine: v.is_mine as boolean, events_truncated: v.events_truncated as boolean, events };
}
function parseCaseEvents(value: unknown,owner?:string): PrivacyCaseEvent[] {
  if (!Array.isArray(value) || value.length > 20) throw Error("Ärendehistoriken kunde inte verifieras.");
  const events = value.map(e => {
    if (!object(e) || !isUuid(e.id) || !["created","claim","reply","waiting","close","reopen","user_reply","review","schedule_review"].includes(String(e.action)) || !timestamp(e.created_at)||e.review_after!=null&&!timestamp(e.review_after)||e.external_sent_at!=null&&!timestamp(e.external_sent_at)||owner&&(["review","schedule_review"].includes(String(e.action))||e.review_after!=null||e.external_sent_at!=null)) throw Error("Ärendehistoriken kunde inte verifieras.");
    if(["review","schedule_review"].includes(String(e.action))&&(e.public_message!==null||!timestamp(e.review_after)))throw Error("Uppföljningen kunde inte verifieras.");
    if(e.external_sent_at!=null&&(!["reply","waiting","close"].includes(String(e.action))||e.public_message===null))throw Error("Sändningstiden kunde inte verifieras.");
    return { external_sent_at:owner?undefined:e.external_sent_at as string|null|undefined,review_after:owner?undefined:e.review_after as string|null|undefined, id: e.id, action: e.action as string, created_at: e.created_at, public_message: e.public_message === null ? null : caseText(e.public_message) };
  });
  if (new Set(events.map(e => e.id)).size !== events.length || events.some((e, i) => i > 0 && compareCaseEvents(events[i - 1], e) >= 0)) throw Error("Ärendehistoriken kunde inte verifieras.");
  return events;
}
export function compareCaseEvents(a: CaseCursor, b: CaseCursor) {
  const fraction = (v: string) => Number((/\.(\d+)/.exec(v)?.[1] ?? "").padEnd(9, "0").slice(3));
  return Date.parse(a.created_at) - Date.parse(b.created_at) || fraction(a.created_at) - fraction(b.created_at) || a.id.toLowerCase().localeCompare(b.id.toLowerCase());
}
export function parsePrivacyCaseHistory(v: unknown, item: Pick<PrivacyCase, "id" | "revision">, before: CaseCursor,owner?:string): PrivacyCaseHistoryPage {
  if (!object(v) || v.id !== item.id || v.revision !== item.revision) throw Error("Ärendet har ändrats. Läs aktuell status igen.");
  const events = parseCaseEvents(v.events,owner), next = parseCaseCursor(v.next);
  if (events.some(e => compareCaseEvents(e, before) >= 0) || next && (!events.length || compareCaseEvents(next, events[0]) !== 0)) throw Error("Ärendehistoriken kunde inte verifieras.");
  return { id: item.id, revision: item.revision, events, next };
}
export function privacyCaseFollowup(item: PrivacyCase, now = Date.now()) {
  if (item.status === "closed") return null;
  const reply = Date.parse(item.reply_due_at), review = item.review_after ? Date.parse(item.review_after) : Infinity;
  const first=firstPrivacyCaseResponse(item,now);
  return { due: Math.min(reply, review,first&&!first.responded?first.due:Infinity), replyOverdue: reply <= now, reviewOverdue: review <= now };
}
export function parsePrivacyCasePage(v: unknown, owner?: string): PrivacyCasePage {
  if (!object(v) || typeof v.available !== "boolean" || !Array.isArray(v.cases) || v.cases.length > 20) throw Error("Ärenden kunde inte läsas.");
  if(v.as_of!==undefined&&!timestamp(v.as_of))throw Error("Kön kunde inte tidsbestämmas.");
  const cases = v.cases.map(c => parsePrivacyCase(c, owner));
  if (new Set(cases.map(c => c.id)).size !== cases.length) throw Error("Dubbla ärenden i svaret.");
  return { as_of:v.as_of as string|undefined, available: v.available, cases, next: parseCaseCursor(v.next) };
}

export function firstPrivacyCaseResponse(item:PrivacyCase,now=Date.now()) {
  if(item.intake_source==="incident" || item.first_reply_at===undefined)return null; // Older backend: never infer no reply from a truncated thread.
  const due=firstResponseTarget(item.created_at),responded=item.first_reply_at!==null;
  return {due,responded,overdue:(responded?Date.parse(item.first_reply_at!):now)>due};
}

export function reviewTime(value:unknown,now=Date.now()):string {
  if(typeof value!=="string"||!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value)||!Number.isFinite(Date.parse(value))||Date.parse(value)<=now||Date.parse(value)>now+30*86400000)throw Error("Välj en framtida uppföljning inom 30 dygn.");
  return new Date(value).toISOString();
}

export function matchesEmailCase(item:PrivacyCase,input:EmailCaseInput) {
 return item.id===input.id&&item.intake_source==="email"&&item.contact_email===input.contactEmail&&item.kind===input.kind&&item.body===input.body&&Date.parse(item.created_at)===Date.parse(input.receivedAt);
}

export function localCasePastTime(value:string,earliest?:string):string {
 return casePastTime(localCaseTime(value),earliest);
}

export function localCaseTime(value:string):string {
 const match=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
 if(!match)throw Error("Ange en giltig lokal tid.");
 const parts=match.slice(1).map(Number),time=new Date(value);
 if(!Number.isFinite(time.getTime())||[time.getFullYear(),time.getMonth()+1,time.getDate(),time.getHours(),time.getMinutes()].some((part,i)=>part!==parts[i]))throw Error("Tiden finns inte i din lokala kalender. Välj en annan tid.");
 return time.toISOString();
}

export function matchesIncidentCase(item: PrivacyCase, input: IncidentCaseInput) {
  return item.intake_source === "incident" && item.id === input.id.toLowerCase() &&
    item.requester_id === null && item.body === input.body.trim() && Date.parse(item.created_at) === Date.parse(input.awareAt);
}
