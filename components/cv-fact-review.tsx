"use client";

import { useEffect, useRef, useState } from "react";
import { authenticatedHeaders } from "@/lib/api-client";
import type { StructuredCvData } from "@/lib/structured-cv";
import { cvFactFields, updateCvFact, cvReviewSnapshot, isCvTextAligned } from "@/lib/cv-fact-review";

export function CvFactReview({ cv, sourceText, approved, onApprove, onChange, disabled = false, text, onSync, manual = false }: {
  manual?: boolean; cv: StructuredCvData; sourceText: string; approved: boolean; onApprove: (approved: boolean) => void;
  onChange: (cv: StructuredCvData) => void; disabled?: boolean; text?: string; onSync?: (cv: StructuredCvData) => void;
}) {
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState("");
  const current = useRef("");
  const requestController = useRef<AbortController | null>(null);
  current.current = cvReviewSnapshot(text ?? "", cv);
  useEffect(() => () => requestController.current?.abort(), []);
  const aligned = text === undefined || isCvTextAligned(text, cv);
  const locked = disabled || syncing || !aligned;
  async function syncFacts() {
    if (manual || !onSync || !text?.trim() || syncing) return;
    const snapshot = current.current;
    const controller = new AbortController(); requestController.current = controller;
    setSyncing(true); setSyncError(""); onApprove(false);
    try {
      const response = await fetch("/api/youth/cv/sync", { method: "POST", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(55_000)]),
        headers: { "Content-Type": "application/json", ...(await authenticatedHeaders()) }, body: JSON.stringify({ text }) });
      const result = await response.json() as { structured?: StructuredCvData; error?: string };
      if (!response.ok || !result.structured || result.structured.textBasis !== text) throw new Error(result.error ?? "Kunde inte uppdatera uppgifterna.");
      // Never overwrite a newer text/generation with an older network result.
      if (snapshot === current.current) onSync(result.structured);
    } catch (reason) { if (!controller.signal.aborted && snapshot === current.current) setSyncError(reason instanceof Error ? reason.message : "Kunde inte uppdatera uppgifterna."); }
    finally { if (!controller.signal.aborted) setSyncing(false); }
  }
  const fields = cvFactFields(cv).filter((field) => field.value.trim() || ["role", "startDate", "endDate", "level", "duration"].includes(field.path.at(-1) ?? ""));
  return <section className="card" style={{ padding: "1rem", margin: "1rem 0", display: "grid", gap: ".8rem" }} aria-label="Granska CV-fakta">
    <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Kontrollera dina uppgifter</h2>
    <p style={{ margin: 0 }}>{manual ? "Kontrollera att uppgifterna stämmer. De sparas i din profil och används vid matchning." : "AI kan misstolka dina svar. Kolla särskilt datum, roller och språknivåer. Uppgifterna sparas i din profil och används vid matchning."}</p>
    {text !== undefined && <p style={{margin:0}}>{text.trim().split(/\s+/).filter(Boolean).length} ord. Sikta på ett tydligt CV på ungefär en sida, upp till två när innehållet behövs. Texten kapas inte automatiskt; du kan korta och välja själv.</p>}
    {!aligned && <div role="status"><p>Du har ändrat CV-texten. Uppdatera uppgifterna innan du godkänner.</p>
      <button type="button" className="secondary-btn" disabled={manual || disabled || syncing || !text?.trim()} onClick={() => void syncFacts()}>{syncing ? "Uppdaterar uppgifterna…" : "Uppdatera uppgifterna från texten"}</button>
    </div>}
    {syncError && <p role="alert">{syncError}</p>}
    <details><summary>Dina ursprungliga svar</summary><pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", font: "inherit", fontSize: ".85rem" }}>{sourceText}</pre></details>
    <details open><summary>Dina uppgifter ({fields.length})</summary>
      <p style={{ margin: ".6rem 0 0", fontSize: ".85rem" }}>Rättar du ett fält skrivs CV-texten om utifrån uppgifterna.</p>
      <div style={{ display: "grid", gap: ".65rem", marginTop: ".8rem" }}>{fields.map(({ path, label, value }) => <label key={path.join(".")} style={{ display: "grid", gap: ".25rem", fontSize: ".85rem" }}>
        <span>{label}</span>
        {path.at(-1) === "level" ? <select aria-label={label} disabled={locked} value={value} onChange={(event) => onChange(updateCvFact(cv, path, event.target.value))}>
          {["", "Modersmål", "Flytande", "Mycket god", "God", "Grundläggande"].map((level) => <option key={level} value={level}>{level || "Ingen nivå angiven"}</option>)}
        </select> : path.at(-1) === "category" ? <select aria-label={label} disabled={locked} value={value} onChange={(event) => onChange(updateCvFact(cv, path, event.target.value))}>
          {["technical", "digital", "language", "other"].map((category) => <option key={category} value={category}>{({ technical: "Teknisk", digital: "Digital", language: "Språk", other: "Övrigt" })[category]}</option>)}
        </select> : <textarea aria-label={label} disabled={locked} value={value} rows={value.length > 100 ? 3 : 1} onChange={(event) => onChange(updateCvFact(cv, path, event.target.value))} style={{ width: "100%", boxSizing: "border-box", font: "inherit", padding: ".5rem", border: "1px solid var(--color-border)", borderRadius: 8 }} />}
      </label>)}</div>
    </details>
    <label style={{ display: "flex", alignItems: "flex-start", gap: ".6rem" }}>
      <input type="checkbox" checked={approved && aligned} disabled={locked} onChange={(event) => onApprove(event.target.checked)} style={{ marginTop: ".25rem", flexShrink: 0 }} />
      <span>Jag har granskat CV:t och uppgifterna och godkänner att de sparas och används för matchning.</span>
    </label>
    {!approved && <p style={{ margin: 0, fontSize: ".85rem" }}>Godkänn för att spara. Varje ändring kräver nytt godkännande.</p>}
  </section>;
}
