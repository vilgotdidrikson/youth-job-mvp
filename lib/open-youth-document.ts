"use client";
import { getCurrentUser } from "./auth";
import { getYouthDocumentSignedUrl } from "./storage";
import { openCvDocument } from "./open-cv-document";

/** The profile opens only its own private file, never a stored external URL.
 * Reserve the popup synchronously, then verify identity around URL resolution.
 */
export async function openYouthDocument({ subjectId, path, signal, openWindow }: {
  subjectId: string; path: string; signal: AbortSignal;
  openWindow: Parameters<typeof openCvDocument>[0]["openWindow"];
}) {
  signal.throwIfAborted();
  if (!subjectId || !path.startsWith(`${subjectId}/`) || path.includes("\\") || /[?#%\x00-\x1f]/.test(path) || path.split("/").some(part => part === "." || part === "..")) throw new Error("Dokumentet saknar en giltig privat filreferens. Ladda upp det igen.");
  return openCvDocument({ signal, openWindow, resolveUrl: async () => {
    if ((await getCurrentUser())?.id !== subjectId) throw new Error("Kontot har ändrats. Öppna profilen igen.");
    signal.throwIfAborted();
    const url = await getYouthDocumentSignedUrl(path);
    signal.throwIfAborted();
    if ((await getCurrentUser())?.id !== subjectId) throw new Error("Kontot har ändrats. Öppna profilen igen.");
    signal.throwIfAborted();
    try {
      const target = new URL(url), configured = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
      if (target.protocol !== "https:" || target.origin !== configured.origin || decodeURIComponent(target.pathname) !== `/storage/v1/object/sign/youth-documents/${path}`) throw new Error();
    } catch { throw new Error("Dokumentets privata länk kunde inte verifieras. Försök igen."); }
    return url;
  } });
}
