export const CONSENT_VERSION = "launch-2026-11-02";
export type Audience = "youth" | "company";
export type SignupInput = { role: Audience; name: string; email: string; companyName: string; consent: true };

export function validateSignup(value: unknown): SignupInput | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  if (input.role !== "youth" && input.role !== "company") return null;
  if (input.consent !== true || typeof input.name !== "string" || typeof input.email !== "string") return null;
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const companyName = typeof input.companyName === "string" ? input.companyName.trim() : "";
  if (name.length < 2 || name.length > 100 || /[\r\n\x00-\x1f]/.test(name)) return null;
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  if (companyName.length > 150 || /[\r\n\x00-\x1f]/.test(companyName) || (input.role === "company" && companyName.length < 2)) return null;
  return { role: input.role, name, email, companyName: input.role === "company" ? companyName : "", consent: true };
}

export function csvCell(value: unknown): string {
  let text = String(value ?? "");
  if (/^[\s]*[=+@\-\t\r\n]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}
