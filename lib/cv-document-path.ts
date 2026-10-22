/** Accept only a stored PDF path inside the candidate's own private folder. */
export function uploadedCvPath(documents: unknown, userId: string): string | null {
  if (!Array.isArray(documents)) return null;
  for (const item of documents) {
    const path = item?.type === "cv" && typeof item.url === "string" ? item.url : "";
    if (path.startsWith(`${userId}/`) && path.toLowerCase().endsWith(".pdf") &&
        !path.includes("\\") && !path.split("/").some((part: string) => part === "." || part === "..")) return path;
  }
  return null;
}
