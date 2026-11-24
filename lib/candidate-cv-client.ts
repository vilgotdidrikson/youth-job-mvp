import { authenticatedHeaders } from "@/lib/api-client";

export type CandidateCv = { kind: "pdf"; file: Blob } | { kind: "text"; text: string };

export async function readCandidateCv(jobId: string, youthUserId: string, signal: AbortSignal): Promise<CandidateCv> {
  const response = await fetch("/api/company/candidate-cv", {
    method: "POST", signal, cache: "no-store",
    headers: { "Content-Type": "application/json", ...await authenticatedHeaders() },
    body: JSON.stringify({ jobId, youthUserId }),
  });
  if (!response.ok) throw new Error("CV:t kunde inte hämtas.");
  if (response.headers.get("content-type") === "application/pdf") return { kind: "pdf", file: await response.blob() };
  const data = await response.json();
  if (data.kind === "text" && typeof data.text === "string") return { kind: "text", text: data.text };
  throw new Error("Ogiltigt CV-svar.");
}
