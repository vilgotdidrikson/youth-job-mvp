"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { AuthGateMessage } from "@/components/auth-gate-message";
import { PageLoading } from "@/components/page-loading";
import { getCandidatesForJob } from "@/lib/feeds";
import { createJob, getCompanyJobs, updateJob } from "@/lib/jobs";
import { reviewCandidate } from "@/lib/matching";
import { getSupabaseClient } from "@/lib/supabase";
import type { CandidateFeedItem, JobPost, SwipeDecision } from "@/lib/types";
import "./private-design.css";

const initialForm = { title: "", description: "", city: "", address: "", pay: "" };

export default function PrivateTasksPage() {
  const router = useRouter();
  const { user, profile, loading, status, error: sessionError } = useRequireAuth();
  const [form, setForm] = useState(initialForm);
  const [tasks, setTasks] = useState<JobPost[]>([]);
  const [candidates, setCandidates] = useState<Record<string, CandidateFeedItem[]>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    const ownedTasks = (await getCompanyJobs()).filter((job) => job.job_kind === "private_task");
    setTasks(ownedTasks);
    const entries = await Promise.all(ownedTasks.map(async (task) => [task.id, await getCandidatesForJob(task.id)] as const));
    setCandidates(Object.fromEntries(entries));
  };

  useEffect(() => {
    if (!loading && profile && profile.role !== "private") router.replace("/dashboard");
    if (!loading && user && profile?.role === "private") void load().catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Kunde inte ladda uppdrag."));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, profile?.role, router, user]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { data: privateProfile } = await getSupabaseClient().from("private_profiles").select("display_name").eq("user_id", user?.id ?? "").maybeSingle();
      await createJob({
        title: form.title, description: form.description, city: form.city, address: form.address,
        salary_per_hour: form.pay, employment_type: "Engångsjobb", category: "Privatuppdrag",
        company_name: privateProfile?.display_name || "Privat uppdragsgivare", job_kind: "private_task", open_positions: 1,
      });
      setForm(initialForm);
      await load();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Kunde inte publicera uppdraget.");
    } finally {
      setBusy(false);
    }
  };

  const decide = async (task: JobPost, candidate: CandidateFeedItem, decision: SwipeDecision) => {
    setBusy(true);
    try {
      await reviewCandidate(task.id, candidate.youthUserId, decision);
      await load();
    } catch (decisionError) {
      setError(decisionError instanceof Error ? decisionError.message : "Kunde inte spara beslutet.");
    } finally {
      setBusy(false);
    }
  };

  const closeTask = async (task: JobPost) => {
    setBusy(true);
    try {
      await updateJob(task.id, { status: "closed" });
      await load();
    } catch (closeError) {
      setError(closeError instanceof Error ? closeError.message : "Kunde inte avsluta uppdraget.");
    } finally {
      setBusy(false);
    }
  };

  if (status !== "ready") return <AuthGateMessage status={status} error={sessionError} />;
  if (profile?.role !== "private") return <PageLoading label="Hämtar innehåll..." />;

  return <main className="mobile-shell mnw-private-workspace">
    <header><p>Privatperson</p><h1>Mina uppdrag</h1><p>Hitta hjälp för enstaka uppgifter och matcha tryggt.</p></header>
    {error && <p role="alert" className="private-error">{error}</p>}
    <form className="card" onSubmit={submit}>
      <h2>Nytt engångsjobb</h2>
      <label>Vad behöver du hjälp med?<input className="input-field" required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="T.ex. Hjälp att bära flyttkartonger" /></label>
      <label>Beskriv uppgiften<textarea className="input-field" required rows={4} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
      <label>Ort<input className="input-field" required value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} /></label>
      <label>Adress<input className="input-field" required value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></label>
      <label>Ersättning (valfritt)<input className="input-field" value={form.pay} onChange={(event) => setForm({ ...form, pay: event.target.value })} placeholder="T.ex. 150 kr/tim" /></label>
      <button className="cta-btn" type="submit" disabled={busy}>{busy ? "Sparar..." : "Publicera uppdrag"}</button>
    </form>
    {tasks.map((task) => <section className="card private-task" key={task.id}>
      <p className="private-task-status" data-status={task.status === "closed" ? "closed" : "active"}>{task.status === "closed" ? "Avslutat" : "Aktivt uppdrag"}</p><h2>{task.title}</h2><p className="private-task-meta">{task.city} · {task.description}</p>
      {(candidates[task.id] ?? []).map((candidate) => <div key={candidate.youthUserId} className="private-candidate"><div><strong>{candidate.profile?.full_name || "Kandidat"}</strong><p>{candidate.profile?.city || ""}</p></div><div className="private-candidate-actions"><button type="button" className="secondary-btn" disabled={busy} onClick={() => void decide(task, candidate, "skip")}>Avvisa</button><button type="button" className="cta-btn" disabled={busy} onClick={() => void decide(task, candidate, "interested")}>Matcha</button></div></div>)}
      {task.status !== "closed" && <button type="button" className="secondary-btn private-task-close" disabled={busy} onClick={() => void closeTask(task)}>Avsluta uppdrag</button>}
    </section>)}
    {tasks.length === 0 && <p className="private-empty">Du har inga uppdrag ännu.</p>}
    <Link href="/chats" className="secondary-btn private-chats-link">Öppna matchningar och chattar</Link>
  </main>;
}
