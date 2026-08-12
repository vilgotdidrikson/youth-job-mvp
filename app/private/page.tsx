"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "@/hooks/use-session";
import { getCandidatesForJob } from "@/lib/feeds";
import { createJob, getCompanyJobs, updateJob } from "@/lib/jobs";
import { reviewCandidate } from "@/lib/matching";
import { getSupabaseClient } from "@/lib/supabase";
import type { CandidateFeedItem, JobPost, SwipeDecision } from "@/lib/types";

const initialForm = { title: "", description: "", city: "", address: "", pay: "" };

export default function PrivateTasksPage() {
  const router = useRouter();
  const { user, profile, loading } = useSession();
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
    if (!loading && !user) router.replace("/login");
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

  if (loading || !user || profile?.role !== "private") return <main className="mobile-shell"><p>Laddar...</p></main>;

  return <main className="mobile-shell" style={{ paddingBottom: "6rem" }}>
    <header style={{ padding: "0.75rem 0 1.25rem" }}><p style={{ margin: 0, color: "#737373", fontSize: ".82rem" }}>Privatperson</p><h1 style={{ margin: ".2rem 0", color: "#111", fontSize: "1.65rem" }}>Mina uppdrag</h1><p style={{ margin: 0, color: "#737373", fontSize: ".88rem" }}>Hitta hjälp för enstaka uppgifter och matcha tryggt.</p></header>
    {error && <p style={{ color: "#b42318", background: "#fff1f0", padding: ".75rem", borderRadius: 8 }}>{error}</p>}
    <form className="card" onSubmit={submit} style={{ padding: "1rem", marginBottom: "1rem" }}>
      <h2 style={{ marginTop: 0, fontSize: "1.1rem" }}>Nytt engångsjobb</h2>
      <label>Vad behöver du hjälp med?<input className="input-field" required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="T.ex. Hjälp att bära flyttkartonger" /></label>
      <label>Beskriv uppgiften<textarea className="input-field" required rows={4} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label>
      <label>Ort<input className="input-field" required value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} /></label>
      <label>Adress<input className="input-field" required value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></label>
      <label>Ersättning (valfritt)<input className="input-field" value={form.pay} onChange={(event) => setForm({ ...form, pay: event.target.value })} placeholder="T.ex. 150 kr/tim" /></label>
      <button className="cta-btn" type="submit" disabled={busy} style={{ marginTop: ".8rem", width: "100%" }}>{busy ? "Sparar..." : "Publicera uppdrag"}</button>
    </form>
    {tasks.map((task) => <section className="card" key={task.id} style={{ padding: "1rem", marginBottom: ".75rem" }}>
      <p style={{ margin: 0, color: "#737373", fontSize: ".75rem" }}>{task.status === "closed" ? "Avslutat" : "Aktivt uppdrag"}</p><h2 style={{ margin: ".2rem 0", fontSize: "1.05rem" }}>{task.title}</h2><p style={{ color: "#555", fontSize: ".86rem" }}>{task.city} · {task.description}</p>
      {(candidates[task.id] ?? []).map((candidate) => <div key={candidate.youthUserId} style={{ borderTop: "1px solid #eee", paddingTop: ".7rem", marginTop: ".7rem" }}><strong>{candidate.profile?.full_name || "Kandidat"}</strong><p style={{ margin: ".25rem 0", fontSize: ".82rem", color: "#737373" }}>{candidate.profile?.city || ""}</p><button type="button" className="secondary-btn" disabled={busy} onClick={() => void decide(task, candidate, "skip")}>Avvisa</button><button type="button" className="cta-btn" disabled={busy} onClick={() => void decide(task, candidate, "interested")} style={{ marginLeft: ".5rem" }}>Matcha</button></div>)}
      {task.status !== "closed" && <button type="button" className="secondary-btn" disabled={busy} onClick={() => void closeTask(task)} style={{ marginTop: ".8rem" }}>Avsluta uppdrag</button>}
    </section>)}
    {tasks.length === 0 && <p style={{ textAlign: "center", color: "#737373" }}>Du har inga uppdrag ännu.</p>}
    <Link href="/chats" className="secondary-btn" style={{ display: "block", textAlign: "center", textDecoration: "none" }}>Öppna matchningar och chattar</Link>
  </main>;
}
