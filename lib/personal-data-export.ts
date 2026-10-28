import { strToU8, zipSync, type Zippable } from "fflate";
import inventory from "../docs/privacy/personal-data-inventory.json";

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type ExportStatus = "included" | "requires_review" | "unavailable" | "not_applicable";
export interface ExportCategory {
  id: string; subjectId: string; status: ExportStatus;
  records?: { subjectId: string; data: Json }[]; summary?: { label: string; value: string }[];
}
export interface ExportInformation {
  controller: string; contact: string; purposes: string[]; recipients: string[];
  retention: string[]; sources: string[]; rights: string[]; automatedProcessing: string[];
}
export interface ExportPackageInput {
  subjectId: string; exportId: string; createdAt: string;
  information: ExportInformation; categories: ExportCategory[];
}
interface ExportFileMetadata { ownerId: string; bucketId: string; name: string; mimeType: string }
export type ExportFile = ExportFileMetadata & ({status:"included";bytes:Uint8Array}|{status:"unavailable"|"requires_review"});
export const EXPORT_LIMITS = Object.freeze({ jsonBytes: 8 * 1024 * 1024, fileBytes: 32 * 1024 * 1024, totalBytes: 64 * 1024 * 1024, files: 100, nodes: 50_000 } as const);
export const EXPORT_CATEGORY_IDS = Object.freeze([...inventory.groups.map(g => g.id), ...inventory.outsideCatalog.map(g => g.id)]);
const labels: Record<string, string> = {
  account:"Konto och profil", billing:"Fakturauppgifter", "private-cv-work":"Privat CV-arbetsmaterial", "own-discovery":"Sparade jobb och val", applications:"Ansökningar och svar", assessments:"Matchningsbedömningar", "company-job-context":"Annonser och kravprofiler", "interest-and-matches":"Intressen och matchningar", chat:"Meddelanden", employment:"Anställning och uppföljning", notifications:"Notiser", safety:"Säkerhetsärenden", videos:"Video", "processing-state":"Behandlings- och lagringsstatus", premium:"Beställningar och tillägg", configuration:"Gemensamma produkt- och lagringsregler", "auth-identity":"Kontoidentiteter", "auth-security":"Inloggning och kontosäkerhet", "auth-configuration":"Inloggningstjänstens inställningar", "storage-content":"Filuppgifter", "storage-configuration":"Lagringens inställningar", "browser-drafts":"Utkast på dina enheter", "provider-processing":"Uppgifter hos tjänsteleverantörer", "vault-and-operations":"Teknisk drift",
};
const statuses: Record<ExportStatus,string> = { included:"Ingår", requires_review:"Behöver individuell granskning", unavailable:"Kunde inte hämtas", not_applicable:"Inte tillämpligt" };
const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const forbidden = /password|token|secret|authorization|apikey|privatekey|cookie|credential|codeverifier/;
const fileFolders: Record<string,string> = {"youth-documents":"dokument","job-images":"bilder","youth-profile-videos":"video"};
const mimeExtensions: Record<string,string[]> = { "application/pdf":["pdf"], "application/msword":["doc"], "application/vnd.openxmlformats-officedocument.wordprocessingml.document":["docx"], "text/plain":["txt"], "image/jpeg":["jpg","jpeg"], "image/png":["png"], "image/webp":["webp"], "video/mp4":["mp4"], "video/webm":["webm"] };

export class ExportPackageError extends Error {
  constructor(public readonly code: "invalid_input" | "unsafe_field" | "scope_mismatch" | "incomplete_inventory" | "unsafe_file" | "too_large") {
    super("Exportpaketet kunde inte skapas med det angivna underlaget."); this.name = "ExportPackageError";
  }
}
function fail(code: ExportPackageError["code"]): never { throw new ExportPackageError(code); }
function wellFormed(value: string): boolean {
  for(let i=0;i<value.length;i++){
    const c=value.charCodeAt(i);
    if(c>=0xd800&&c<=0xdbff){const next=value.charCodeAt(++i);if(!(next>=0xdc00&&next<=0xdfff))return false;}
    else if(c>=0xdc00&&c<=0xdfff)return false;
  }
  return true;
}
function text(value: unknown, max = 4000): value is string { return typeof value === "string" && value.trim().length > 0 && value.length <= max && wellFormed(value); }

/** Snapshot plain JSON without invoking getters/toJSON or silently dropping fields.
 * Secret detection is structural; collectors must still review free text. */
function jsonSnapshot(input: unknown): Json {
  const active = new Set<object>(); let nodes = 0, stringBytes = 0;
  function read(value: unknown, depth: number): Json {
    if (++nodes > EXPORT_LIMITS.nodes || depth > 24) return fail("too_large");
    if (value === null || typeof value === "boolean") return value;
    if (typeof value === "number") { if (!Number.isFinite(value) || Object.is(value,-0) || (Number.isInteger(value)&&!Number.isSafeInteger(value))) return fail("invalid_input"); return value; }
    if (typeof value === "string") {
      if (!wellFormed(value)) return fail("invalid_input");
      if (value.length > EXPORT_LIMITS.jsonBytes) return fail("too_large");
      stringBytes += strToU8(value).byteLength;
      if (stringBytes > EXPORT_LIMITS.jsonBytes) return fail("too_large");
      return value;
    }
    if (typeof value !== "object" || active.has(value)) return fail("invalid_input");
    const array = Array.isArray(value), proto = Object.getPrototypeOf(value);
    if (proto !== (array ? Array.prototype : Object.prototype) && !(proto === null && !array)) return fail("invalid_input");
    if (Object.getOwnPropertySymbols(value).length) return fail("invalid_input");
    const descriptors = Object.getOwnPropertyDescriptors(value);
    active.add(value);
    const result: Record<string, Json> = Object.create(null);
    const length = array ? descriptors.length?.value : 0;
    if (array && (!Number.isSafeInteger(length) || length < 0 || length > EXPORT_LIMITS.nodes)) return fail("too_large");
    for (const [key, descriptor] of Object.entries(descriptors)) {
      if (array && key === "length") continue;
      if (!descriptor.enumerable || !("value" in descriptor) || key.length > 200 || !wellFormed(key)) return fail("invalid_input");
      const normalized = key.replace(/\p{Cf}/gu, "").normalize("NFKC").toLowerCase().replace(/[\s_-]/g, "");
      if (forbidden.test(normalized) || ["__proto__","constructor","prototype"].includes(key)) return fail("unsafe_field");
      if (array && (!/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= length)) return fail("invalid_input");
      stringBytes += strToU8(key).byteLength;
      if (stringBytes > EXPORT_LIMITS.jsonBytes) return fail("too_large");
      result[key] = read(descriptor.value, depth + 1);
    }
    active.delete(value);
    if (!array) return result;
    if (Object.keys(result).length !== length) return fail("invalid_input");
    return Array.from({ length }, (_, i) => result[String(i)]);
  }
  return read(input, 0);
}
const escape = (value: string) => value.replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]!);
const href = (path: string) => path.split("/").map(encodeURIComponent).join("/");

/** Pure package builder, NOT authentication, data collection, redaction or retention.
 * A trusted collector supplies reviewed projections for the verified subject. */
export function buildPersonalDataExport(verifiedSubjectId: string, input: ExportPackageInput, files: readonly ExportFile[] = []) {
  if(typeof verifiedSubjectId!=="string" || !uuid.test(verifiedSubjectId))return fail("invalid_input");
  try { return build(verifiedSubjectId, input, files); }
  catch (error) { if (error instanceof ExportPackageError) throw error; return fail("invalid_input"); }
}
function build(verifiedSubjectId: string, input: ExportPackageInput, files: readonly ExportFile[]) {
  const snapshot = jsonSnapshot(input) as unknown as ExportPackageInput;
  if (!snapshot || Object.keys(snapshot).sort().join() !== "categories,createdAt,exportId,information,subjectId" || typeof snapshot.subjectId!=="string" || !uuid.test(snapshot.subjectId) || typeof snapshot.exportId!=="string" || !uuid.test(snapshot.exportId) || typeof snapshot.createdAt !== "string" || !/^20[0-9]{2}-/.test(snapshot.createdAt) || !Number.isFinite(Date.parse(snapshot.createdAt)) || new Date(snapshot.createdAt).toISOString()!==snapshot.createdAt) return fail("invalid_input");
  if(snapshot.subjectId!==verifiedSubjectId)return fail("scope_mismatch");
  if (!Array.isArray(snapshot.categories) || snapshot.categories.length !== EXPORT_CATEGORY_IDS.length) return fail("incomplete_inventory");
  const categories = new Map<string, ExportCategory>();
  for (const category of snapshot.categories) {
    if (!category || !/^[a-z][a-z0-9-]{0,63}$/.test(category.id) || !EXPORT_CATEGORY_IDS.includes(category.id) || !Object.hasOwn(labels,category.id) || categories.has(category.id)) return fail("incomplete_inventory");
    if (category.subjectId !== snapshot.subjectId) return fail("scope_mismatch");
    if (typeof category.status!=="string" || !Object.hasOwn(statuses, category.status) || Object.keys(category).some(key=>!["id","subjectId","status","records","summary"].includes(key))) return fail("invalid_input");
    if (category.status === "included") {
      if (!Array.isArray(category.records) || !Array.isArray(category.summary) || (category.records.length>0&&category.summary.length===0) || category.summary.length > 100 || category.summary.some(row => !row || !text(row.label,120) || !text(row.value))) return fail("invalid_input");
      for (const row of category.records) {
        if (!row || Object.keys(row).sort().join()!=="data,subjectId") return fail("invalid_input");
        if (row.subjectId!==snapshot.subjectId) return fail("scope_mismatch");
      }
      if(category.summary.some(row=>Object.keys(row).sort().join()!=="label,value")) return fail("invalid_input");
    } else if (category.records !== undefined || category.summary !== undefined) return fail("invalid_input");
    categories.set(category.id, category);
  }
  const information = snapshot.information;
  if (!information || !text(information.controller,200) || !text(information.contact,300)) return fail("invalid_input");
  const infoLabels = { purposes:"Varför uppgifterna används", recipients:"Mottagare", retention:"Lagring", sources:"Uppgifternas källor", rights:"Dina rättigheter", automatedProcessing:"Automatiserad behandling" } as const;
  if (Object.keys(information).sort().join()!==["controller","contact",...Object.keys(infoLabels)].sort().join()) return fail("invalid_input");
  for (const key of Object.keys(infoLabels) as (keyof typeof infoLabels)[]) if (!Array.isArray(information[key]) || !information[key].length || information[key].length > 30 || information[key].some(row => !text(row))) return fail("invalid_input");
  if (!Array.isArray(files) || files.length > EXPORT_LIMITS.files) return fail("too_large");
  const fileDescriptors=Object.getOwnPropertyDescriptors(files);
  if(Object.getPrototypeOf(files)!==Array.prototype || Object.getOwnPropertySymbols(files).length || Object.keys(fileDescriptors).length!==files.length+1 || Object.entries(fileDescriptors).some(([key,d])=>key!=="length"&&(!/^(0|[1-9][0-9]*)$/.test(key)||!d.enumerable||!("value"in d))))return fail("unsafe_file");
  const zip: Zippable = Object.create(null), fileIndex: {path:string|null;name:string;mimeType:string;bytes:number|null;bucketId:string;status:"included"|"unavailable"|"requires_review"}[] = [];
  let total = 0;
  const add = (path: string, bytes: Uint8Array) => { total += bytes.byteLength; if (total > EXPORT_LIMITS.totalBytes) return fail("too_large"); zip[path] = [bytes, {level:0,mtime:new Date("2000-01-01T00:00:00Z")}]; };
  for (const supplied of files) {
    if(!supplied || ![Object.prototype,null].includes(Object.getPrototypeOf(supplied)) || Object.getOwnPropertySymbols(supplied).length) return fail("unsafe_file");
    const descriptors=Object.getOwnPropertyDescriptors(supplied);
    if(Object.values(descriptors).some(d=>!d.enumerable||!("value" in d))) return fail("unsafe_file");
    const file=Object.fromEntries(Object.entries(descriptors).map(([key,d])=>[key,d.value])) as unknown as ExportFile;
    if(!["included","unavailable","requires_review"].includes(file.status) || Object.keys(descriptors).sort().join()!==(file.status==="included"?"bucketId,bytes,mimeType,name,ownerId,status":"bucketId,mimeType,name,ownerId,status"))return fail("unsafe_file");
    if (!file || file.ownerId !== snapshot.subjectId) return fail("scope_mismatch");
    if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(file.bucketId) || !Object.hasOwn(fileFolders,file.bucketId) || !inventory.buckets.some(bucket => bucket.id === file.bucketId) || categories.get("storage-content")?.status !== "included") return fail("unsafe_file");
    if (!text(file.name,150) || strToU8(file.name).byteLength>240 || file.name !== file.name.normalize("NFC") || /[\\/:<>"|?*\x00-\x1f\x7f\p{Cf}]/u.test(file.name) || /^[. ]|[. ]$/.test(file.name) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(file.name)) return fail("unsafe_file");
    const extension = file.name.split(".").at(-1)?.toLowerCase() ?? "";
    if (typeof file.mimeType!=="string" || !Object.hasOwn(mimeExtensions,file.mimeType) || !mimeExtensions[file.mimeType].includes(extension)) return fail("unsafe_file");
    if(file.status!=="included"){fileIndex.push({path:null,name:file.name,mimeType:file.mimeType,bytes:null,bucketId:file.bucketId,status:file.status});continue;}
    if (!(file.bytes instanceof Uint8Array) || Object.getPrototypeOf(file.bytes)!==Uint8Array.prototype || Object.getOwnPropertyDescriptor(file.bytes,"byteLength") || Object.getOwnPropertySymbols(file.bytes).length) return fail("unsafe_file");
    if (file.bytes.byteLength > EXPORT_LIMITS.fileBytes) return fail("too_large");
    const path = `filer/${fileFolders[file.bucketId]}/${String(fileIndex.length+1).padStart(3,"0")}-${file.name}`;
    const copy=new Uint8Array(file.bytes);if(copy.byteLength>EXPORT_LIMITS.fileBytes)return fail("too_large");
    add(path, copy); fileIndex.push({path,name:file.name,mimeType:file.mimeType,bytes:copy.byteLength,bucketId:file.bucketId,status:file.status});
  }
  const pending = EXPORT_CATEGORY_IDS.filter(id => {const c=categories.get(id)!;return c.status === "requires_review" || c.status === "unavailable";});
  const pendingFiles=fileIndex.filter(f=>f.status!=="included").length,needsCompletion=pending.length>0||pendingFiles>0;
  const manifest = {version:1,exportId:snapshot.exportId,subjectId:snapshot.subjectId,createdAt:new Date(snapshot.createdAt).toISOString(),coverage:needsCompletion ? "needs_completion" : "provided_sources_included",pendingCategories:pending,pendingFiles,categories:EXPORT_CATEGORY_IDS.map(id => {const c=categories.get(id)!;return{id,label:labels[id],status:c.status,records:c.records?.length??0};}),files:fileIndex,information};
  let jsonBytes = 0;
  const addJson = (path: string, value: unknown) => { const bytes=strToU8(JSON.stringify(value,null,2)+"\n");jsonBytes+=bytes.byteLength;if(jsonBytes>EXPORT_LIMITS.jsonBytes)return fail("too_large");add(path,bytes); };
  addJson("oversikt.json", manifest);
  const sections = EXPORT_CATEGORY_IDS.map(id => {
    const c=categories.get(id)!, path=`uppgifter/${id}.json`;
    if(c.status === "included") addJson(path,{category:id,subjectId:snapshot.subjectId,records:c.records!.map(row=>row.data)});
    if(c.status!=="included")return "";
    return `<section id="del-${id}"><h2>${escape(labels[id])}</h2><p>${statuses[c.status]}${c.status==="included"?` · ${c.records!.length} poster`:""}</p>${c.status==="included"?`<dl>${c.summary!.map(row=>`<dt>${escape(row.label)}</dt><dd><bdi>${escape(row.value)}</bdi></dd>`).join("")}</dl><a href="${href(path)}">Läs strukturerade uppgifter</a>`:""}</section>`;
  }).join("");
  const overview=`<section><h2>Delar i paketet</h2><dl class="catalog">${manifest.categories.map(c=>`<div><dt>${c.status==="included"?`<a href="#del-${c.id}">${escape(c.label)}</a>`:escape(c.label)}</dt><dd>${statuses[c.status]}</dd></div>`).join("")}</dl></section>`;
  const createdLabel=new Intl.DateTimeFormat("sv-SE",{dateStyle:"long",timeStyle:"short",timeZone:"Europe/Stockholm"}).format(new Date(manifest.createdAt));
  const html=`<!doctype html><html lang="sv"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>Dina uppgifter</title><style>body{font:16px/1.6 system-ui,sans-serif;color:#33282e;background:#fff9fb;margin:0}main{max-width:800px;margin:auto;padding:24px}section{background:white;border:1px solid #ead6df;border-radius:16px;padding:20px;margin:20px 0}h1,h2{line-height:1.25}dt,h1,h2,h3{overflow-wrap:anywhere}dt{font-weight:600}dd{margin:0 0 12px;white-space:pre-wrap;overflow-wrap:anywhere}a{color:#9c304f;overflow-wrap:anywhere}li,p{overflow-wrap:anywhere}.catalog>div{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);gap:12px;padding:10px 0;border-bottom:1px solid #ead6df;font-size:14px}.catalog dt,.catalog dd{margin:0;min-width:0}@media(max-width:480px){.catalog>div{grid-template-columns:1fr;gap:2px}.catalog dd{color:#65545d}}.notice{padding:16px;background:#fbe8f0;border-radius:12px}</style><main><h1>Dina uppgifter</h1><p>Skapad ${escape(createdLabel)} (Stockholm)</p><p class="notice">${needsCompletion?"Vissa delar behöver kompletteras. Se status för varje del nedan.":"Samtliga angivna delar ingår eller har markerats som inte tillämpliga."}</p>${overview}${sections}<section><h2>Filer</h2><ul>${fileIndex.map(f=>f.status==="included"?`<li><a download href="${href(f.path!)}">${escape(f.name)}</a> (${f.bytes} byte)</li>`:`<li>${escape(f.name)} · ${statuses[f.status]}</li>`).join("")||"<li>Inga filer ingår.</li>"}</ul></section><section><h2>Om behandlingen</h2><p>${escape(information.controller)} · ${escape(information.contact)}</p>${Object.entries(infoLabels).map(([key,label])=>`<h3>${label}</h3><ul>${information[key as keyof typeof infoLabels].map(row=>`<li>${escape(row)}</li>`).join("")}</ul>`).join("")}</section></main></html>`;
  add("LAS-MIG.html",strToU8(html));
  const bytes=zipSync(zip,{level:0});
  if(bytes.byteLength>EXPORT_LIMITS.totalBytes)return fail("too_large");
  return {bytes,manifest,fileName:`matchnwork-uppgifter-${snapshot.exportId}.zip`,mimeType:"application/zip" as const};
}
