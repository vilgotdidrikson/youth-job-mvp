import { isUuid } from "./privacy-cases";

export const MAX_CASE_PDF_BYTES = 1048576;
export const MAX_CASE_PDF_BASE64 = 4 * Math.ceil(MAX_CASE_PDF_BYTES / 3);
export type CaseAttachmentInput =
  | { action: "list"; id: string; revision: string }
  | { action: "upload"; id: string; revision: string; attachmentId: string; content: string }
  | { action: "download" | "publish" | "revoke"; id: string; revision: string; attachmentId: string };

export type CaseAttachment = { id: string; size: number; createdAt: string };

export function isCasePdfBase64(value: unknown): value is string {
  return typeof value === "string" && value.length <= MAX_CASE_PDF_BASE64 && value.length % 4 === 0 &&
    value.startsWith("JVBERi") && /^[a-z0-9+/]+={0,2}$/i.test(value);
}

export function parseCaseAttachmentReceipt(value: unknown, input: CaseAttachmentInput) {
  const response = value as { caseId?: unknown; revision?: unknown; id?: unknown; files?: unknown; content?: unknown } | null;
  if (response?.caseId !== input.id.toLowerCase() || response.revision !== input.revision.toLowerCase()) throw Error("Fel ärendeversion.");
  if (input.action === "list") {
    if (!Array.isArray(response.files) || response.files.length > 8) throw Error("Ogiltig fillista.");
    const files = response.files.map(row => {
      if (!isUuid(row?.id) || !Number.isInteger(row.size) || row.size < 5 || row.size > MAX_CASE_PDF_BYTES ||
        typeof row.createdAt !== "string" || !Number.isFinite(Date.parse(row.createdAt))) throw Error("Ogiltig filpost.");
      return { id: row.id, size: row.size, createdAt: row.createdAt } as CaseAttachment;
    });
    if (new Set(files.map(file => file.id)).size !== files.length) throw Error("Dubbla filposter.");
    return { files };
  }
  if (response.id !== input.attachmentId.toLowerCase()) throw Error("Fel bilaga.");
  if (input.action === "upload" || input.action === "publish" || input.action === "revoke") return { uploaded: true as const };
  if (!isCasePdfBase64(response.content)) throw Error("Ogiltigt filinnehåll.");
  return { content: response.content };
}
