import type { SupabaseClient } from "@supabase/supabase-js";
import { uploadedCvPath } from "./cv-document-path";

export type PdfCvStatus = "none" | "read" | "unreadable";
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_PAGES = 10;
const MAX_TEXT = 12000;

/** Server only: parse text without external URLs, PDF scripts, rendering or OCR. */
export async function extractPdfText(bytes: Uint8Array): Promise<string> {
  if (!bytes.length || bytes.length > MAX_BYTES || !new TextDecoder().decode(bytes.slice(0, 1024)).includes("%PDF-")) throw new Error("Invalid PDF");
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = getDocument({ data: bytes, isEvalSupported: false, useSystemFonts: false, disableFontFace: true });
  const timeout = setTimeout(() => { void task.destroy(); }, 8000);
  try {
    const pdf = await task.promise;
    if (pdf.numPages > MAX_PAGES) throw new Error("PDF exceeds page limit");
    const pages: string[] = [];
    for (let pageIndex = 1; pageIndex <= pdf.numPages; pageIndex++) {
      const page = await pdf.getPage(pageIndex);
      const { items } = await page.getTextContent();
      pages.push(items.flatMap((item) => "str" in item ? [item.str + (item.hasEOL ? "\n" : " ")] : []).join(""));
      page.cleanup();
    }
    const text = pages.join("\n").replace(/[\t ]+/g, " ").trim();
    if (text.length > MAX_TEXT) throw new Error("PDF exceeds text limit");
    return text;
  } finally {
    clearTimeout(timeout);
    await task.destroy();
  }
}

export async function pdfCvSource(client: SupabaseClient, documents: unknown, userId: string): Promise<{ text: string; status: PdfCvStatus }> {
  const path = uploadedCvPath(documents, userId);
  if (!path) return { text: "", status: Array.isArray(documents) && documents.some((item) => item?.type === "cv") ? "unreadable" : "none" };
  try {
    const { data, error } = await client.storage.from("youth-documents").download(path);
    if (error || !data || data.size > MAX_BYTES) return { text: "", status: "unreadable" };
    const text = await extractPdfText(new Uint8Array(await data.arrayBuffer()));
    return { text, status: text.length >= 8 ? "read" : "unreadable" };
  } catch { return { text: "", status: "unreadable" }; }
}
