"use client";

import type { StructuredCvData } from "@/lib/structured-cv";
import { cvFactFields, updateCvFact } from "@/lib/cv-fact-review";

export function CvFactReview({ cv, sourceText, approved, onApprove, onChange, disabled = false }: {
  cv: StructuredCvData; sourceText: string; approved: boolean; onApprove: (approved: boolean) => void;
  onChange: (cv: StructuredCvData) => void; disabled?: boolean;
}) {
  const fields = cvFactFields(cv).filter((field) => field.value.trim() || ["role", "startDate", "endDate", "level", "duration"].includes(field.path.at(-1) ?? ""));
  return <section className="card" style={{ padding: "1rem", margin: "1rem 0", display: "grid", gap: ".8rem" }} aria-label="Granska CV-fakta">
    <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Kontrollera dina uppgifter</h2>
    <p style={{ margin: 0 }}>AI kan misstolka dina svar. Kontrollera särskilt datum, roller och språknivåer. Uppgifterna nedan sparas i din profil och används vid matchning. Rätta fel här innan du godkänner. När du rättar ett profilfält uppdateras hela CV-texten från profilfakta; granska därför texten igen efteråt.</p>
    <details><summary>Dina svar före bearbetningen</summary><pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", font: "inherit", fontSize: ".85rem" }}>{sourceText}</pre></details>
    <details open><summary>Granska och rätta profilfakta ({fields.length} uppgifter)</summary>
      <div style={{ display: "grid", gap: ".65rem", marginTop: ".8rem" }}>{fields.map(({ path, label, value }) => <label key={path.join(".")} style={{ display: "grid", gap: ".25rem", fontSize: ".85rem" }}>
        <span>{label}</span>
        {path.at(-1) === "level" ? <select aria-label={label} disabled={disabled} value={value} onChange={(event) => onChange(updateCvFact(cv, path, event.target.value))}>
          {["", "Modersmål", "Flytande", "Mycket god", "God", "Grundläggande"].map((level) => <option key={level} value={level}>{level || "Ingen nivå angiven"}</option>)}
        </select> : path.at(-1) === "category" ? <select aria-label={label} disabled={disabled} value={value} onChange={(event) => onChange(updateCvFact(cv, path, event.target.value))}>
          {["technical", "digital", "language", "other"].map((category) => <option key={category} value={category}>{({ technical: "Teknisk", digital: "Digital", language: "Språk", other: "Övrigt" })[category]}</option>)}
        </select> : <textarea aria-label={label} disabled={disabled} value={value} rows={value.length > 100 ? 3 : 1} onChange={(event) => onChange(updateCvFact(cv, path, event.target.value))} style={{ width: "100%", boxSizing: "border-box", font: "inherit", padding: ".5rem", border: "1px solid var(--color-border)", borderRadius: 8 }} />}
      </label>)}</div>
    </details>
    <label style={{ display: "flex", alignItems: "flex-start", gap: ".6rem" }}>
      <input type="checkbox" checked={approved} disabled={disabled} onChange={(event) => onApprove(event.target.checked)} style={{ marginTop: ".25rem", flexShrink: 0 }} />
      <span>Jag har granskat CV-texten och profilfakta ovan och godkänner att dessa uppgifter sparas och används för matchning.</span>
    </label>
    {!approved && <p style={{ margin: 0, fontSize: ".85rem" }}>Godkänn uppgifterna för att kunna spara. En ändring eller ny AI-version kräver nytt godkännande.</p>}
  </section>;
}
