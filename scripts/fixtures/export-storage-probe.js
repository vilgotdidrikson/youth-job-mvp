// Temporary DevStaging-only deployment used to verify a fixed fictitious ZIP.
// Replace with the final cleanup entrypoint immediately after verification.
// This fixture is NEVER part of the final deployed cleanup worker.
import { createClient } from "@supabase/supabase-js";
import { createPersonalDataExportCleanupHandler } from "../../lib/personal-data-export-cleanup-handler.ts";
const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };
const url = "https://vwcfjvwfeatvuisojwrh.supabase.co";
const bucket = "personal-data-exports";
// A valid tiny ZIP generated locally from QA.txt containing only fictitious text.
const payload = "UEsDBBQAAAAIAAAAYV1e1rU4PAAAADkAAAAGAAAAUUEudHh0c8vMLsksK1HwTSxJzsgLzy/K1i1JLS7RU/DMS09USMwrO7wkLyWxqLSgID0zrSS1SE/hcOvhJYe36QEAUEsBAhQDFAAAAAgAAABhXV7WtTg8AAAAOQAAAAYAAAAAAAAAAAAAAIABAAAAAFFBLnR4dFBLBQYAAAAAAQABADQAAABgAAAAAAA=";
const subjectId = "17f9153c-bb7c-4d03-a1f8-5fe7cbc2c12e", id = "42e7b437-ebcf-4193-a482-b54228dc7c28", path = `${subjectId}/${id}.zip`;
const service = () => createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), { auth: { persistSession: false, autoRefreshToken: false } });
const cleanup = createPersonalDataExportCleanupHandler(service);
Deno.serve(async request => {
  if (!new URL(request.url).pathname.endsWith("/qa-fixture")) return cleanup(request);
  if (!["POST", "GET"].includes(request.method)) return new Response(null, { status: 405, headers });
  const token = request.headers.get("authorization")?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
  if (!token || Deno.env.get("SUPABASE_URL") !== url) return new Response(null, { status: 401, headers });
  const active = AbortSignal.timeout(50000);
  const client = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: "no-store", signal: active }) },
  });
  const { data: valid, error } = await client.rpc("validate_personal_data_export_cleanup_token", { p_token: token });
  if (error || valid !== true) return new Response(null, { status: 401, headers });
  if (request.method === "GET") {
    const result = await client.storage.from(bucket).download(path, { cacheNonce: crypto.randomUUID() }, { signal: active });
    const removed = !!result.error && [400, 404].includes(Number(result.error.statusCode));
    return Response.json({ ok: removed, removed }, { status: removed ? 200 : 503, headers });
  }
  const bytes = Uint8Array.from(atob(payload), c => c.charCodeAt(0));
  const sha256 = async value => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", value)), n => n.toString(16).padStart(2, "0")).join("");
  let uploaded = false;
  try {
    const result = await client.storage.from(bucket).upload(path, bytes, { contentType: "application/zip", cacheControl: "0", upsert: false });
    if (result.error) throw Error("Upload failed");
    uploaded = true;
    const download = await client.storage.from(bucket).download(path, { cacheNonce: crypto.randomUUID() }, { signal: active });
    if (download.error || !download.data) throw Error("Download failed");
    const actual = new Uint8Array(await download.data.arrayBuffer());
    if (actual.length !== bytes.length || await sha256(actual) !== await sha256(bytes)) throw Error("Bytes changed");
    const publicResponse = await fetch(`${url}/storage/v1/object/public/${bucket}/${path}`, { cache: "no-store", signal: active });
    const anonymousResponse = await fetch(`${url}/storage/v1/object/${bucket}/${path}`, { headers: { apikey: Deno.env.get("SUPABASE_ANON_KEY"), Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}` }, cache: "no-store", signal: active });
    if (publicResponse.ok || anonymousResponse.ok) throw Error("Private file exposed");
    // Keep only this known QA file for the REAL cleanup worker to delete next.
    return Response.json({ ok: true, id, subjectId, path, size: bytes.length, sha256: await sha256(bytes), publicStatus: publicResponse.status, anonymousStatus: anonymousResponse.status }, { headers });
  } catch {
    if (uploaded) await client.storage.from(bucket).remove([path]);
    return Response.json({ ok: false, id, subjectId, path }, { status: 503, headers });
  }
});
