"use client";
import { JobRequirementsInsight } from "@/components/job-requirements-insight";
import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { AuthGateMessage } from "@/components/auth-gate-message";
import { ApplicationDisclosureView } from "@/components/application-disclosure-view";
import { DisclosureLoadState } from "@/components/disclosure-load-state";
import type { DisclosurePreview } from "@/lib/application-disclosure";
import { getSupabaseClient } from "@/lib/supabase";
import { prepareApplication } from "@/lib/application-completions";
import { applicationSourceInput } from "@/lib/application-evidence";
import { createLatestRead, type ReadState } from "@/lib/latest-read";
import surfaces from "@/components/application-disclosure-view.module.css";
import styles from "./preview.module.css";

type PreviewResult = { withdrawn: true } | { withdrawn: false; sent: boolean; preview: DisclosurePreview };

function Preview() {
  const jobId = useSearchParams().get("job");
  const { user, profile, status, error } = useRequireAuth();
  if (status !== "ready") return <AuthGateMessage status={status} error={error} />;
  if (profile?.role !== "youth") return <main className={styles.page}><p>Förhandsvisningen är för ungdomskonton.</p></main>;
  if (!jobId) return <main className={styles.page}><h1>Välj en ansökan</h1><Link href="/applications">Till mina ansökningar</Link></main>;
  return <DisclosurePreviewContent key={JSON.stringify([user!.id, jobId])} jobId={jobId} youthId={user!.id} />;
}

function DisclosurePreviewContent({ jobId, youthId }: { jobId: string; youthId: string }) {
  const router = useRouter();
  const [state, setState] = useState<ReadState<PreviewResult>>({ status: "loading" });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const previous = useRef<PreviewResult | null>(null);
  const ready = useRef<PreviewResult | null>(null);
  const mounted = useRef(false);
  const saveInFlight = useRef(false);
  const selection = useRef<string[] | undefined>(undefined);
  const reader = useRef<ReturnType<typeof createLatestRead<PreviewResult, string[] | undefined>> | null>(null);
  useEffect(() => {
    mounted.current = true;
    const current = createLatestRead<PreviewResult, string[] | undefined>({
      read: async (selected, signal) => {
        const client = getSupabaseClient();
        const { data: application, error: statusError } = await client.from("application_completions")
          .select("status").eq("job_id", jobId).eq("youth_user_id", youthId).abortSignal(signal).maybeSingle();
        if (statusError) throw new Error("Ansökningsstatus kunde inte hämtas");
        if (application?.status === "withdrawn") return { withdrawn: true };
        const { data, error } = await client.rpc("get_my_application_disclosure_preview", {
          p_job_id: jobId, ...(selected !== undefined ? { p_selection: selected } : {}),
        }).abortSignal(signal);
        if (error || !data || data.packet?.job_id !== jobId || data.packet?.youth_user_id !== youthId) throw new Error("Underlag saknas");
        return { withdrawn: false, sent: application?.status === "submitted", preview: data as DisclosurePreview };
      },
      update: next => {
        ready.current = next.status === "ready" ? next.value : null;
        if (next.status === "ready") previous.current = next.value;
        setState(next);
      },
      errorMessage: "Underlaget kunde inte hämtas. Kontrollera anslutningen och försök igen.",
    });
    reader.current = current;
    void current.load(selection.current);
    return () => { mounted.current = false; ready.current = null; current.stop(); reader.current = null; };
  }, [jobId, youthId]);

  const load = (selected?: string[]) => {
    if (saveInFlight.current) return;
    selection.current = selected === undefined ? undefined : [...selected];
    setSaveError("");
    void reader.current?.load(selection.current);
  };
  const save = async () => {
    if (!mounted.current || saveInFlight.current || state.status !== "ready" || state.value.withdrawn || ready.current !== state.value) return;
    const { preview, sent } = state.value;
    saveInFlight.current = true;
    setSaving(true); setSaveError("");
    try {
      if (!preview.is_saved) {
        const { error } = await getSupabaseClient().rpc("save_my_application_disclosure", {
          p_job_id: jobId, p_selection: preview.selected_keys, p_source_token: preview.source_token,
        });
        if (error) throw new Error(error.message);
      }
      // Do not start a new submission after navigating away or switching account.
      if (!mounted.current) return;
      if (!sent) await prepareApplication(jobId);
      if (!mounted.current) return;
      window.dispatchEvent(new Event("mnw-navigation-refresh"));
      router.push(`/applications?job=${encodeURIComponent(jobId)}`);
    } catch (reason) {
      if (mounted.current) setSaveError(reason instanceof Error ? reason.message : "Ändringen kunde inte sparas.");
    } finally {
      saveInFlight.current = false;
      if (mounted.current) setSaving(false);
    }
  };

  const display = state.status === "ready" ? state.value : previous.current;
  if (!display) return <main className={styles.page}>
    <Link href="/applications">Till mina ansökningar</Link><h1>Det här delar du med företaget</h1>
    <DisclosureLoadState error={state.status === "error" ? state.message : undefined} retry={() => void reader.current?.load(selection.current)} />
  </main>;
  if (display.withdrawn) return <main className={styles.page}><h1>Ansökan är återkallad</h1><p>Den skickas inte igen automatiskt. En eventuell match är avslutad och chatten är skrivskyddad.</p><Link href="/applications">Till mina ansökningar</Link></main>;
  const { preview, sent } = display;
  const selectedKeys = selection.current ?? preview.selected_keys;
  const toggleOption = (key: string, checked: boolean) => {
    const current = selection.current ?? preview.selected_keys;
    load(checked ? [...new Set([...current, key])] : current.filter(item => item !== key));
  };
  return <main className={styles.page}>
    <Link href={sent ? "/applications" : `/jobb/${encodeURIComponent(jobId)}`}>Tillbaka</Link>
    <header className={styles.heading}><h1>Det här delar du med företaget</h1><p>CV och praktiska uppgifter ingår. Välj relevanta extra uppgifter för just det här jobbet. Privata utkast och samtal delas inte. Saknad video eller okänd matchning stoppar inte ansökan.</p></header>
    {state.status === "loading" && <p role="status">Uppdaterar förhandsvisningen…</p>}
    {state.status === "error" && <DisclosureLoadState error={state.message} retry={() => void reader.current?.load(selection.current)} />}
    {saveError && <div className={`${styles.error} ${surfaces.root}`}><p role="alert">{saveError}</p><button type="button" className={surfaces.cvButton} disabled={saving} onClick={() => load(selection.current)}>Hämta aktuellt underlag</button></div>}
    <JobRequirementsInsight jobId={jobId} />
    <ApplicationDisclosureView packet={preview.packet} youthPreview />
    <div className={surfaces.root}>
      {preview.is_saved ? <section className={surfaces.panel}><h2>Sparad delning</h2><p>Detta är samma underlag som företaget får för den här ansökan. Profiländringar delas först när du väljer att uppdatera underlaget.</p><button type="button" className={surfaces.cvButton} disabled={saving} onClick={() => load([])}>Uppdatera från min profil och välj uppgifter</button></section>
        : <fieldset className={styles.options} disabled={saving} aria-busy={state.status === "loading"}><legend>Extra uppgifter att dela</legend>{preview.options.length ? preview.options.map(option => <label key={option.key} className={styles.option}>
          <input type="checkbox" checked={selectedKeys.includes(option.key)} onChange={event => toggleOption(option.key, event.target.checked)} />
          <span><strong>{option.label}</strong><span>{option.text}</span></span>
        </label>) : <p>Inga ytterligare profiluppgifter finns att välja.</p>}</fieldset>}
      <details className={styles.sources}><summary>Vilka källuppgifter används i matchningen?</summary><p>Matchningen använder ditt granskade CV, sparade profilfakta och delade ansökningssvar. Rensning sker före AI-anrop. Företaget får inte hela jobbprofilen: belägg får bara visas från det delade underlaget ovan. Detta visar källuppgifter, inget individuellt AI-betyg.</p><pre>{applicationSourceInput(preview.matching_input)}</pre></details>
    </div>
    <p className={styles.note}>Uppladdade CV delas som originalfiler. Öppna filen ovan och kontrollera kontaktuppgifter eller bostadsadress innan du skickar. En borttagen gammal CV-fil kan bli otillgänglig; en ny fil delas först när du uppdaterar underlaget.</p>
    <footer className={styles.actions}><button type="button" className="cta-btn" disabled={saving || state.status !== "ready"} aria-busy={saving} onClick={() => void save()}>{saving ? "Sparar…" : sent ? (preview.is_saved ? "Till mina ansökningar" : "Spara uppdaterad delning") : "Dela underlaget och skicka ansökan"}</button></footer>
  </main>;
}
export default function Page() { return <Suspense fallback={<main className={styles.page}><p role="status">Laddar…</p></main>}><Preview /></Suspense>; }
