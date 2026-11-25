/** Presentation only. The database remains responsible for publication. */
export function jobPublicationAction(verificationStatus: unknown) {
  if (verificationStatus === "verified") return {
    label: "Publicera annons", busyLabel: "Publicerar…", previewHeading: "Inför publicering",
    description: "Företaget är godkänt. När du publicerar blir den aktiva annonsen synlig för ungdomar.",
    previewNote: "Förhandsvisningen visar ditt utkast. Annonsen publiceras först när du väljer Publicera annons.",
  };
  const correction = verificationStatus === "rejected" ? "Företagsuppgifterna behöver kompletteras. " : "";
  return {
    label: "Spara inför publicering", busyLabel: "Sparar annons…", previewHeading: "Inför publicering och verifiering",
    description: `${correction}Annonsen sparas hos MatchnWork men syns inte för ungdomar innan företaget är godkänt. Aktiva annonser publiceras automatiskt vid godkännande. Pausade och stängda annonser förblir dolda.`,
    previewNote: "Detta är en förhandsvisning, inte en publicerad annons. Spara inför publicering skickar annonsen till MatchnWork. Den blir synlig först efter företagsgodkännande och om den är aktiv. Spara utkast behåller den bara på den här enheten.",
  };
}

interface PublicationFields { publication_status?: unknown; status?: unknown; is_active?: unknown }
export function jobPublicationState(job: PublicationFields) {
  if (job.status === "closed") return "closed";
  if (job.status === "paused" || job.is_active === false) return "paused";
  if (job.publication_status === "pending_verification") return "waiting";
  if (job.publication_status === "published" && job.status === "active" && job.is_active === true) return "published";
  return "unknown";
}
export function jobPublicationLabel(job: PublicationFields): string {
  return { published: "Publicerad", waiting: "Inväntar företagsverifiering", paused: "Pausad", closed: "Stängd", unknown: "Publiceringsstatus behöver kontrolleras" }[jobPublicationState(job)];
}
/** Always derive confirmation from the returned job, never a cached company profile. */
export function jobPublicationReceipt(job: PublicationFields): string {
  switch (jobPublicationState(job)) {
    case "published": return "Annonsen är publicerad och synlig för ungdomar.";
    case "waiting": return "Annonsen är sparad hos MatchnWork och väntar på företagsverifiering. Den syns inte för ungdomar ännu. Om annonsen är aktiv publiceras den automatiskt när företaget godkänns; du kan pausa den innan dess.";
    case "paused": return "Annonsen är sparad men pausad. Den syns inte för ungdomar. Ett företagsgodkännande återaktiverar inte en pausad annons.";
    case "closed": return "Annonsen är sparad men stängd. Den syns inte för ungdomar.";
    default: return "Annonsen är skapad, men publiceringsstatus kunde inte bekräftas. Kontrollera statusen i annonsöversikten innan du delar den.";
  }
}
