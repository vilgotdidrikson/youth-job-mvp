"use client";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getJobById } from "@/lib/jobs";
import { useSession } from "@/hooks/use-session";
import { useCvCompletion } from "@/hooks/use-cv-completion";
import { getSupabaseClient } from "@/lib/supabase";
import { saveApplicationDraft, setJobSaved } from "@/lib/youth-job-flow";
import { prepareApplication } from "@/lib/application-completions";
import type { JobPost } from "@/lib/types";
import { ReportDialog } from "@/components/report-dialog";
import { UiIcon } from "@/components/ui-icon";
import styles from "./job-detail.module.css";

const listItems = (value: string) => value.split(/[,\n]+/).map(item => item.trim()).filter(Boolean);
function ageRequirement(job: JobPost) {
  if (job.min_age == null && job.max_age == null) return null;
  if (job.min_age != null && job.max_age != null) return `${job.min_age}–${job.max_age} år`;
  return job.min_age != null ? `Minst ${job.min_age} år` : `Högst ${job.max_age} år`;
}

export default function JobDetailPage() {
  const cvDialog = useRef<HTMLDialogElement>(null);
  const params = useParams<{ jobId: string }>();
  const { user, profile } = useSession();
  const { cvCompleted, cvLoading } = useCvCompletion(user?.id, profile?.role === "youth");
  const [job, setJob] = useState<JobPost | null>(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [alreadyApplied, setAlreadyApplied] = useState(false), [needsCompletion, setNeedsCompletion] = useState(false);
  const [saved, setSaved] = useState(false), [showCvPrompt, setShowCvPrompt] = useState(false), [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false), [loadedJobId, setLoadedJobId] = useState("");
  useEffect(() => {
    let active = true;
    void getJobById(params.jobId).then(result => { if (active) setJob(result); }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : "Kunde inte hämta annonsen."); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [params.jobId]);
  useEffect(() => {
    if (!user || profile?.role !== "youth") return;
    let active = true;
    void Promise.all([
      getSupabaseClient().from("swipe_actions").select("decision").eq("youth_user_id", user.id).eq("job_id", params.jobId).eq("decision", "interested").maybeSingle(),
      getSupabaseClient().from("application_completions").select("status").eq("youth_user_id", user.id).eq("job_id", params.jobId).maybeSingle(),
      getSupabaseClient().from("youth_saved_jobs").select("id").eq("youth_user_id", user.id).eq("job_id", params.jobId).maybeSingle(),
    ]).then(([application, completion, bookmark]) => {
      if (!active) return;
      if (application.error || completion.error || bookmark.error) { setActionError("Kunde inte läsa din ansökningsstatus. Ladda om sidan för att försöka igen."); return; }
      setAlreadyApplied(Boolean(application.data) || completion.data?.status === "submitted");
      setNeedsCompletion(completion.data?.status === "needs_completion"); setSaved(Boolean(bookmark.data)); setLoadedJobId(params.jobId);
    });
    return () => { active = false; };
  }, [params.jobId, profile?.role, user]);
  useEffect(() => {
    const dialog = cvDialog.current;
    if (!dialog) return;
    if (showCvPrompt && !dialog.open) dialog.showModal();
    else if (!showCvPrompt && dialog.open) dialog.close();
  }, [showCvPrompt]);
  if (loading || (!error && job && job.id !== params.jobId)) return <main className={styles.page}><div className={styles.loading} role="status">Hämtar annonsen…</div></main>;
  if (error || !job) return <main className={styles.page}><section className={styles.panel}><h1>Jobbet kunde inte visas</h1><p>{error || "Annonsen hittades inte."}</p><Link href="/swipe" className={styles.back}>Tillbaka till Upptäck</Link></section></main>;
  const acceptsApplications = job.status === "active" && job.is_active !== false;
  const requirements = [ageRequirement(job), ...listItems(job.requirements)].filter((item): item is string => Boolean(item));
  const benefits = listItems(job.benefits), address = [job.address, job.postal_code, job.city].filter(Boolean).join(", ");
  const image = job.image_url?.split(",")[0]?.trim();
  const toggleSaved = async () => {
    if (busy) return;
    setBusy(true); setActionError("");
    try { await setJobSaved(job.id, !saved); setSaved(!saved); }
    catch (reason) { setActionError(reason instanceof Error ? reason.message : "Kunde inte spara jobbet."); }
    finally { setBusy(false); }
  };
  const startApplication = async () => {
    if (busy || cvLoading || loadedJobId !== params.jobId) return;
    setBusy(true); setActionError("");
    try {
      if (!acceptsApplications) throw new Error("Den här annonsen tar inte emot nya ansökningar.");
      if (cvCompleted) { const application = await prepareApplication(job.id); setAlreadyApplied(application.status === "submitted"); setNeedsCompletion(application.status === "needs_completion"); }
      else { await saveApplicationDraft(job.id); setShowCvPrompt(true); }
    } catch (reason) {
      const latestJob = await getJobById(job.id).catch(() => null); if (latestJob) setJob(latestJob);
      setActionError(reason instanceof Error ? reason.message : "Kunde inte påbörja ansökan.");
    } finally { setBusy(false); }
  };
  const action = alreadyApplied ? <p className={styles.status}><UiIcon name="check"/>Ditt intresse är skickat</p> : needsCompletion ? <Link href="/applications" className={styles.primary}>Komplettera din ansökan <UiIcon name="arrow"/></Link> : acceptsApplications ? <button type="button" className={styles.primary} disabled={busy || cvLoading || loadedJobId !== params.jobId} onClick={() => void startApplication()}><UiIcon name="heart"/>{busy ? "Sparar…" : "Jag är intresserad"}</button> : <p className={styles.status}>Nya ansökningar är stängda</p>;
  return <main className={styles.page}>
    <Link href="/swipe" className={styles.back}><UiIcon name="arrow"/>Tillbaka till Upptäck</Link>
    <div className={styles.layout}><article className={styles.article}>
      <div className={styles.hero}>{image ? <Image src={image} alt="" fill sizes="(max-width: 720px) 100vw, 700px" priority className={styles.heroImage}/> : <div className={styles.fallback}><UiIcon name="briefcase" width="52" height="52"/></div>}<div className={styles.shade}/><p>{job.company_name || "Arbetsgivare"}</p>{profile?.role === "youth" && <button type="button" className={styles.heroSave} disabled={busy || loadedJobId !== params.jobId} aria-label={saved ? "Ta bort sparat jobb" : "Spara jobbet"} aria-pressed={saved} onClick={() => void toggleSaved()}><UiIcon name="bookmark" fill={saved ? "currentColor" : "none"}/></button>}</div>
      <header className={styles.heading}><h1>{job.title}</h1><p>{[job.city, job.employment_type].filter(Boolean).join(" · ")}</p>{!acceptsApplications && <p className={styles.notice} role="status">{job.status === "closed" ? "Den här annonsen är stängd." : "Den här annonsen är tillfälligt pausad."}</p>}</header>
      <section className={styles.textSection}><h2>Om jobbet</h2><p>{job.description || "Ingen beskrivning angiven."}</p></section>
      {requirements.length > 0 && <section className={styles.textSection}><h2>Det här behöver du</h2><ul>{requirements.map((item,index) => <li key={index}><UiIcon name="check"/><span>{item}</span></li>)}</ul></section>}
      {benefits.length > 0 && <section className={styles.textSection}><h2>Det här får du</h2><ul>{benefits.map((item,index) => <li key={index}><UiIcon name="check"/><span>{item}</span></li>)}</ul></section>}
      {profile?.role === "youth" && <div className={styles.report}><ReportDialog targetType="job" targetId={job.id} label="Anmäl annons"/></div>}
    </article><aside className={styles.aside}><section className={styles.panel}><h2 className={styles.eyebrow}>Snabb överblick</h2><dl className={styles.facts}><div><dt>Lön</dt><dd>{job.salary_per_hour || "Enligt överenskommelse"}</dd></div><div><dt>Arbetstid</dt><dd>{job.employment_type || "Enligt överenskommelse"}</dd></div><div><dt>Plats</dt><dd>{address || "Meddelas av arbetsgivaren"}</dd></div>{job.category && <div><dt>Kategori</dt><dd>{job.category}</dd></div>}</dl>{profile?.role === "youth" && <div className={styles.desktopAction}>{action}<p className={styles.actionNote}>{!cvCompleted && !alreadyApplied ? "Ditt intresse sparas tills CV:t är klart." : "Följ din ansökan under Aktivitet."}</p><button type="button" className={styles.secondary} disabled={busy || loadedJobId !== params.jobId} onClick={() => void toggleSaved()}><UiIcon name="bookmark"/>{saved ? "Jobbet är sparat" : "Spara jobbet"}</button></div>}</section><section className={styles.employer}><span>{(job.company_name || "A").slice(0,2).toUpperCase()}</span><div><strong>{job.company_name || "Arbetsgivare"}</strong><p>{job.city}</p></div></section></aside></div>
    {actionError && <p role="alert" className={styles.error}>{actionError}</p>}
    {profile?.role === "youth" && <footer className={styles.mobileAction}>{action}<p>{!cvCompleted && !alreadyApplied ? "Ditt intresse sparas tills CV:t är klart." : "Följ din ansökan under Aktivitet."}</p></footer>}
    <dialog ref={cvDialog} className={styles.modal} onCancel={() => setShowCvPrompt(false)} aria-labelledby="detail-cv-title"><section className={styles.panel}><span className={styles.modalIcon}><UiIcon name="briefcase"/></span><h2 id="detail-cv-title">Ditt intresse är sparat</h2><p>Gör klart ditt CV så kan du gå vidare med ansökan.</p><Link className={styles.primary} href={`/youth/cv?job=${encodeURIComponent(job.id)}&title=${encodeURIComponent(job.title)}`}>Fortsätt med CV:t <UiIcon name="arrow"/></Link><button type="button" className={styles.secondary} onClick={() => setShowCvPrompt(false)}>Fortsätt utforska</button></section></dialog>
  </main>;
}
