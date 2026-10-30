import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { EXPORT_STORAGE_BUCKET } from "../personal-data-export-cleanup";

export class TemporaryExportError extends Error {
  constructor(public readonly code: "busy" | "unavailable" | "invalid_package") { super("Exportpaketet är inte tillgängligt. Försök skapa ett nytt paket."); this.name = "TemporaryExportError"; }
}
export interface TemporaryExportHandle { readonly id: string; readonly subjectId: string; readonly path: string; readonly expiresAt: string }
const uuid = (v: unknown): v is string => typeof v === "string" && /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(v);
const MAX_BYTES = 64 * 1024 * 1024;
function fail(code: TemporaryExportError["code"]): never { throw new TemporaryExportError(code); }
function handle(value: TemporaryExportHandle) {
  if (!value || !uuid(value.id) || !uuid(value.subjectId) || value.path !== `${value.subjectId}/${value.id}.zip` || !Number.isFinite(Date.parse(value.expiresAt)) || Date.parse(value.expiresAt) <= Date.now()) fail("unavailable");
}
function digest(bytes: Uint8Array) { return createHash("sha256").update(bytes).digest("hex"); }
const check = (signal?: AbortSignal) => { if (signal?.aborted) fail("unavailable"); };

/** Includes upload, whose installed SDK API has no per-call AbortSignal option. */
export function createTemporaryExportStorageClient(url: string, serviceKey: string, signal?: AbortSignal) {
  const deadline = AbortSignal.timeout(120000), active = signal ? AbortSignal.any([signal, deadline]) : deadline;
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store", signal: init?.signal ? AbortSignal.any([active, init.signal]) : active }) },
  });
}

/** Caller must verify the current account/session AND new authentication before
 * creating/uploading, and verify again before releasing downloaded bytes. This
 * module receives a server-created service client, NEVER user request JSON.
 * Construct it with a bounded, abortable fetch (including upload transport).
 */
export async function beginTemporaryPersonalDataExport(client: SupabaseClient, subjectId: string, exportId: string, signal?: AbortSignal): Promise<TemporaryExportHandle> {
  if (!uuid(subjectId) || !uuid(exportId)) fail("unavailable");
  check(signal);
  try {
    const { data, error } = await client.rpc("begin_personal_data_export", { p_subject_id: subjectId, p_export_id: exportId });
    check(signal);
    if (!error && data?.status === "busy") fail("busy");
    if (error || data?.status !== "building" || data.id !== exportId || data.subjectId !== subjectId) fail("unavailable");
    const result = { id: data.id, subjectId: data.subjectId, path: data.path, expiresAt: data.expiresAt };
    handle(result); return Object.freeze(result);
  } catch (error) { if (error instanceof TemporaryExportError) throw error; return fail("unavailable"); }
}

export async function storeTemporaryPersonalDataExport(client: SupabaseClient, job: TemporaryExportHandle, input: Uint8Array, signal?: AbortSignal) {
  handle(job); check(signal);
  if (!(input instanceof Uint8Array) || Object.getPrototypeOf(input) !== Uint8Array.prototype || ["buffer", "byteLength", "byteOffset", "length"].some(key => Object.hasOwn(input, key)) || Object.getOwnPropertySymbols(input).length) fail("invalid_package");
  if (!(input.buffer instanceof ArrayBuffer) || input.length < 4 || input.length > MAX_BYTES || input[0] !== 80 || input[1] !== 75) fail("invalid_package");
  const bytes = new Uint8Array(input), sha256 = digest(bytes);
  try {
    const { error } = await client.storage.from(EXPORT_STORAGE_BUCKET).upload(job.path, bytes, { contentType: "application/zip", cacheControl: "0", upsert: false });
    check(signal); handle(job);
    if (error) fail("unavailable");
    const { data: ready, error: finishError } = await client.rpc("finish_personal_data_export", { p_subject_id: job.subjectId, p_export_id: job.id, p_success: true, p_size_bytes: bytes.length, p_content_sha256: sha256 });
    check(signal);
    if (finishError || ready !== true) fail("unavailable");
  } catch {
    // Do not reuse a cancelled client's fetch for recovery. The database also
    // reclaims abandoned builders after ten minutes, then reconciles late writes.
    if (!signal?.aborted) {
      try { await client.rpc("finish_personal_data_export", { p_subject_id: job.subjectId, p_export_id: job.id, p_success: false }); } catch { /* Worker remains responsible for physical cleanup. */ }
    }
    fail("unavailable");
  }
}

export async function readTemporaryPersonalDataExport(client: SupabaseClient, subjectId: string, exportId: string, signal?: AbortSignal): Promise<Uint8Array> {
  if (!uuid(subjectId) || !uuid(exportId)) fail("unavailable");
  async function metadata() {
    check(signal);
    const { data, error } = await client.rpc("read_personal_data_export", { p_subject_id: subjectId, p_export_id: exportId });
    check(signal);
    if (error || data?.status !== "ready" || data.subjectId !== subjectId || data.id !== exportId || !Number.isSafeInteger(data.sizeBytes) || data.sizeBytes < 1 || data.sizeBytes > MAX_BYTES || typeof data.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(data.sha256)) fail("unavailable");
    handle(data); return data as TemporaryExportHandle & { sizeBytes: number; sha256: string };
  }
  try {
    const before = await metadata();
    const { data: blob, error } = await client.storage.from(EXPORT_STORAGE_BUCKET).download(before.path, { cacheNonce: randomUUID() }, { signal });
    check(signal);
    if (error || !blob || blob.size !== before.sizeBytes || blob.size > MAX_BYTES) fail("unavailable");
    const bytes = new Uint8Array(await blob.arrayBuffer());
    check(signal);
    if (bytes.length !== before.sizeBytes || digest(bytes) !== before.sha256) fail("unavailable");
    const after = await metadata();
    if (after.path !== before.path || after.expiresAt !== before.expiresAt || after.sizeBytes !== before.sizeBytes || after.sha256 !== before.sha256) fail("unavailable");
    return bytes;
  } catch { return fail("unavailable"); }
}
