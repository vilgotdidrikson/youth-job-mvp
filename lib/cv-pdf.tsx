"use client";

import { getSupabaseClient } from "@/lib/supabase";
import { getVerifiedExperience } from "@/lib/recruitment";
import { withVerifiedExperience } from "@/lib/recruitment-types";

// React-PDF owns one font store per browser. Serialize exports so refreshing
// its font data cannot affect another document being rendered concurrently.
let renderQueue: Promise<void> = Promise.resolve();
function renderInOrder<T>(render: () => Promise<T>): Promise<T> {
  const result = renderQueue.then(render);
  renderQueue = result.then(() => undefined, () => undefined);
  return result;
}

function safeFilename(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9ÅÄÖåäö_-]+/g, "-").replace(/^-+|-+$/g, "") || "mitt-cv";
}

export async function createCvPdfFile(cvText: string, fullName: string): Promise<File> {
  if (!cvText.trim()) throw new Error("Skriv eller skapa ditt CV innan du exporterar det.");
  const { data: { user }, error } = await getSupabaseClient().auth.getUser();
  if (error || !user) throw new Error("Logga in igen innan du skapar ditt CV.");
  const experiences = await getVerifiedExperience(user.id);
  const [{ pdf }, { CvPdfDocument, registerCvPdfFonts }] = await Promise.all([import("@react-pdf/renderer"), import("./cv-pdf-document")]);
  const blob = await renderInOrder(async () => {
    await registerCvPdfFonts();
    return pdf(<CvPdfDocument cvText={withVerifiedExperience(cvText, experiences)} fullName={fullName} />).toBlob();
  });
  return new File([blob], `${safeFilename(fullName || "mitt-cv")}-matchnwork-cv.pdf`, { type: "application/pdf" });
}

export function downloadPdfFile(file: File): void {
  const url = URL.createObjectURL(file);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
