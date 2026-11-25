"use client";

import { useEffect, useState, type FormEvent } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import styles from "./company-agreement.module.css";

const fields = [
  ["purpose", "Vilka uppgifter ni använder och varför"],
  ["basis", "Rättslig grund"],
  ["recipients", "Vem som får uppgifterna"],
  ["transfers", "Eventuell behandling utanför EU/EES"],
  ["retention", "Hur länge uppgifterna sparas"],
  ["rights", "Sökandens rättigheter och hur de används"],
  ["officer", "Dataskyddsombud, om ni har ett"],
] as const;

type Details = Partial<Record<(typeof fields)[number][0], string>>;
type Notice = {
  company?: string;
  organizationNumber?: string;
  contact: string;
  link: string | null;
  details: Details | null;
};

export function CompanyRecruitmentNotice({ email }: { email?: string | null }) {
  const [notice, setNotice] = useState<Notice | null>(null);
  const [available, setAvailable] = useState(false);
  const [mode, setMode] = useState<"template" | "link">("template");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    getSupabaseClient().rpc("get_my_company_recruitment_notice").abortSignal(controller.signal).then(({ data, error }) => {
      if (controller.signal.aborted || error?.code === "PGRST202") return;
      if (error) { setFailed(true); return; }
      const record = data as Notice | null;
      setNotice(record);
      setMode(record?.link ? "link" : "template");
      setAvailable(true);
    }, () => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const form = new FormData(event.currentTarget);
    const contact = String(form.get("contact") ?? "").trim();
    const link = mode === "link" ? String(form.get("link") ?? "").trim() : null;
    const details = mode === "template" ? Object.fromEntries(fields.map(([key]) => [key, String(form.get(key) ?? "").trim()])) : null;
    setSaving(true);
    setMessage("");
    setFailed(false);
    try {
      const { error } = await getSupabaseClient().rpc("save_my_company_recruitment_notice", {
        p_contact: contact, p_link: link, p_details: details,
      });
      if (error) throw new Error();
      setNotice({ contact, link, details });
      setMessage("Rekryteringsinformationen är sparad.");
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  }

  if (!available && !failed) return null;
  return <details className={`card ${styles.panel}`}>
    <summary>Dataskydd vid rekrytering</summary>
    <p>Uppgifterna visas för arbetssökande innan de söker. Ange en kontaktadress som ni vill att sökande använder.</p>
    {failed && <p role="alert">Informationen kunde inte bekräftas. Försök igen eller ladda om sidan.</p>}
    {message && <p role="status">{message}</p>}
    {available && <form className={styles.form} onSubmit={save}>
      <label>Kontaktmejl för dataskydd<input name="contact" type="email" maxLength={254} defaultValue={notice?.contact ?? email ?? ""} required disabled={saving} /></label>
      <label>Hur lämnar ni informationen
        <select value={mode} disabled={saving} onChange={event => setMode(event.target.value === "link" ? "link" : "template")}>
          <option value="template">Fyll i mallen</option><option value="link">Länka till er rekryteringsinformation</option>
        </select>
      </label>
      {mode === "link" ? <label>HTTPS-länk till rekryteringsinformationen<input name="link" type="url" maxLength={2048} defaultValue={notice?.link ?? ""} required disabled={saving} /></label>
        : fields.map(([key, label]) => <label key={key}>{label}<textarea name={key} maxLength={2500} defaultValue={notice?.details?.[key] ?? ""} required={key !== "officer"} disabled={saving} /></label>)}
      <button type="submit" className="cta-btn" disabled={saving}>{saving ? "Sparar…" : "Spara rekryteringsinformation"}</button>
    </form>}
  </details>;
}

export function CandidateRecruitmentNotice({ jobId }: { jobId: string }) {
  const [notice, setNotice] = useState<Notice | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    getSupabaseClient().rpc("get_job_recruitment_notice", { p_job: jobId }).abortSignal(controller.signal).then(({ data, error }) => {
      if (!controller.signal.aborted && !error) setNotice(data as Notice | null);
    }, () => {});
    return () => controller.abort();
  }, [jobId]);

  if (!notice) return null;
  return <details className={styles.recruitmentNotice}>
    <summary>Så hanterar {notice.company || "arbetsgivaren"} din ansökan</summary>
    <p>{notice.company}{notice.organizationNumber ? ` · ${notice.organizationNumber}` : ""}</p>
    <p>Dataskyddsfrågor <a href={`mailto:${encodeURIComponent(notice.contact).replace("%40", "@")}`}>{notice.contact}</a></p>
    {notice.link && <p><a href={notice.link} target="_blank" rel="noopener noreferrer">Läs arbetsgivarens rekryteringsinformation</a></p>}
    {notice.details && <dl>{fields.filter(([key]) => notice.details?.[key]).map(([key, label]) => (
      <div key={key}><dt><strong>{label}</strong></dt><dd className={styles.text}>{notice.details?.[key]}</dd></div>
    ))}</dl>}
  </details>;
}
