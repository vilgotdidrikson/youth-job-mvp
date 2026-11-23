"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import styles from "./company-agreement.module.css";

type Agreement = {
  version: string;
  agreement: string;
  annex: string;
  currentVersion: string;
  acceptedAt: string | null;
  endedAt: string | null;
  representative: string | null;
  representativeRole: string | null;
  acceptedCompanyName: string | null;
  acceptedOrganizationNumber: string | null;
  companyName: string | null;
  organizationNumber: string | null;
  history: string[];
};

function downloadAgreement(document: Agreement) {
  const identity = [
    document.acceptedCompanyName, document.acceptedOrganizationNumber,
    document.representative, document.representativeRole, document.acceptedAt,
  ].filter(Boolean);
  const text = [`Version ${document.version}`, ...identity, "", document.agreement, "", document.annex].join("\n");
  const download = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
  const link = window.document.createElement("a");
  link.href = download;
  link.download = "matchnwork-foretagsavtal.txt";
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(download), 1000);
}

export function CompanyAgreement({ onAccepted }: { onAccepted: () => void }) {
  const [agreement, setAgreement] = useState<Agreement | null>(null);
  const [version, setVersion] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checked, setChecked] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const busy = useRef(false);

  useEffect(() => {
    const request = new AbortController();
    getSupabaseClient().rpc("get_my_company_agreement", version ? { p_version: version } : {})
      .abortSignal(request.signal).then(({ data, error }) => {
        if (request.signal.aborted) return;
        setLoading(false);
        if (error?.code === "PGRST202") return;
        if (error) {
          setError("Företagsavtalet kunde inte hämtas. Försök igen.");
          return;
        }
        setAgreement(data as Agreement | null);
      }, () => {
        if (request.signal.aborted) return;
        setLoading(false);
        setError("Företagsavtalet kunde inte hämtas. Försök igen.");
      });
    return () => request.abort();
  }, [version, retry]);

  function load(selected?: string) {
    setChecked(false);
    setAuthorized(false);
    setError("");
    setLoading(true);
    setVersion(selected ?? null);
    setRetry(count => count + 1);
  }

  async function accept(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current || !agreement || !checked || !authorized) return;
    const fields = new FormData(event.currentTarget);
    busy.current = true;
    setSaving(true);
    setError("");
    try {
      const { data, error } = await getSupabaseClient().rpc("accept_my_company_agreement", {
        p_version: agreement.version,
        p_representative: fields.get("representative"),
        p_role: fields.get("role"),
        p_agreement: checked,
        p_authority: authorized,
      });
      if (error?.code === "40001") {
        load();
        setError("En ny avtalsversion gäller. Läs den innan du godkänner.");
        return;
      }
      if (error || data?.version !== agreement.version || !data?.acceptedAt || data?.endedAt) {
        throw new Error();
      }
      setAgreement(data as Agreement);
      onAccepted();
    } catch {
      setError("Godkännandet kunde inte bekräftas. Kontrollera att e-postadressen är verifierad och företagsuppgifterna är ifyllda.");
    } finally {
      busy.current = false;
      setSaving(false);
    }
  }

  if (!agreement && !error) return null;
  const needsAcceptance = agreement && agreement.version === agreement.currentVersion && !agreement.acceptedAt;
  return <section className={`card ${styles.panel}`} aria-label="Företagsavtal">
    <h2>Företagsavtal</h2>
    {error && <p role="alert">{error} <button type="button" className="secondary-btn" onClick={() => load(version ?? undefined)}>Läs om avtalet</button></p>}
    {loading && <p role="status">Hämtar avtal…</p>}
    {agreement && !loading && <>
      <p>{agreement.acceptedCompanyName ?? agreement.companyName} · {agreement.acceptedOrganizationNumber ?? agreement.organizationNumber}</p>
      <details open={needsAcceptance || undefined}>
        <summary>Avtal och dataskyddsbilaga · {agreement.version}</summary>
        <div className={styles.text}>{agreement.agreement}</div>
        <div className={styles.text}>{agreement.annex}</div>
      </details>
      <button type="button" className="secondary-btn" onClick={() => downloadAgreement(agreement)}>Spara avtalskopia</button>
      {agreement.acceptedAt && <p role="status">Godkänt {new Date(agreement.acceptedAt).toLocaleDateString("sv-SE")} av {agreement.representative}{agreement.endedAt ? " · Avtalet har avslutats" : ""}</p>}
      {needsAcceptance && <form key={agreement.version} className={styles.form} onSubmit={accept}>
        <label>Företrädarens namn<input name="representative" autoComplete="name" required maxLength={120} disabled={saving} /></label>
        <label>Företrädarens roll<input name="role" autoComplete="organization-title" required maxLength={120} disabled={saving} /></label>
        <label><input type="checkbox" checked={checked} disabled={saving} onChange={event => setChecked(event.target.checked)} /> Jag godkänner företagsavtalet och dataskyddsbilagan.</label>
        <label><input type="checkbox" checked={authorized} disabled={saving} onChange={event => setAuthorized(event.target.checked)} /> Jag har behörighet att företräda företaget.</label>
        <button className="cta-btn" disabled={!checked || !authorized || saving}>{saving ? "Sparar…" : "Godkänn och skicka för granskning"}</button>
      </form>}
      {version && <button type="button" className="secondary-btn" onClick={() => load()}>Visa gällande avtal</button>}
      {!version && agreement.history.filter(item => item !== agreement.version).map(item =>
        <button key={item} type="button" className="secondary-btn" onClick={() => load(item)}>Visa tidigare godkänd version {item}</button>
      )}
    </>}
  </section>;
}
