import { COMPANY_ROUTES } from "./company-navigation";
import type { Role } from "./types";

export const CONTACT_EMAIL = "info@matchnwork.se";
export function applicationCountLabel(count: number) {
  return `${count} ${count === 1 ? "ansökan" : "ansökningar"}`;
}
export function jobReturnLink(role?: Role | null) {
  if (role === "company") return { href: COMPANY_ROUTES.listings, label: "Tillbaka till Mina annonser" };
  if (role === "private") return { href: "/private", label: "Tillbaka till Dina uppdrag" };
  return { href: "/swipe", label: "Tillbaka till Upptäck" };
}
