"use client";

import { useEffect, useRef, useState } from "react";
import { getCurrentUser } from "@/lib/auth";
import { getSupabaseClient } from "@/lib/supabase";
import { manageApplicationVideo, readApplicationVideo, uploadVideo } from "@/lib/video-client";
import { VideoPicker, VideoPreview, type SelectedVideo } from "./video-picker";
import { VideoRecorder } from "./video-recorder";
import { VideoPlayer } from "./video-player";
import { ModalDialog } from "./modal-dialog";

export const applicationVideoEnabled = process.env.NEXT_PUBLIC_APPLICATION_VIDEO_ENABLED === "true";

export function ApplicationVideo({ jobId, candidateId, readOnly = false }: { jobId: string; candidateId?: string; readOnly?: boolean }) {
  const [row, setRow] = useState<Awaited<ReturnType<typeof readApplicationVideo>>>(null);
  const [opened, setOpened] = useState(false);
  const [selected, setSelected] = useState<SelectedVideo | null>(null);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [retry, setRetry] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const pending = useRef<{ videoId: string; owner: string } | null>(null);
  const operation = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    if (applicationVideoEnabled) void readApplicationVideo(jobId, candidateId, AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]))
      .then(value => { if (!controller.signal.aborted) setRow(value); }).catch(() => {});
    return () => { controller.abort(); operation.current?.abort(); };
  }, [jobId, candidateId]);

  async function update(action: "send" | "revoke") {
    if (operation.current || (action === "send" && !selected && !pending.current)) return;
    const controller = new AbortController();
    operation.current = controller;
    setBusy(true);
    setNote("");
    setRetry(false);
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(90000)]);
    try {
      const owner = (await getCurrentUser())?.id;
      if (!owner || (pending.current && pending.current.owner !== owner)) throw new Error("Logga in igen med rätt konto.");
      if (action === "send" && !pending.current && selected) {
        const videoId = crypto.randomUUID();
        await uploadVideo(selected.file, selected.duration, owner, "", signal, { jobId, videoId });
        pending.current = { videoId, owner };
      }
      const id = action === "send" ? pending.current?.videoId : row?.videoId;
      if (!id) return;
      await manageApplicationVideo(jobId, id, action, signal);
      setRow(previous => previous ? { ...previous, videoId: action === "send" ? id : null } : previous);
      pending.current = null;
      setSelected(null);
      setOpened(false);
      setConfirming(false);
      setNote(action === "send" ? "Videon är skickad." : "Videon har tagits bort från ansökan.");
    } catch (reason) {
      if (!controller.signal.aborted) {
        setRetry(true);
        setNote(reason instanceof Error ? reason.message : "Försök igen.");
      }
    } finally {
      if (operation.current === controller) operation.current = null;
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  if (!applicationVideoEnabled || !row || (!row.prompt && !row.videoId)) return null;
  if (candidateId) return row.videoId ? <VideoPlayer key={row.videoId} videoId={row.videoId} label="Video till den här ansökan" /> : null;
  return <section aria-label="Frivillig videokomplettering">
    {row.videoId ? <>
      <VideoPlayer key={row.videoId} videoId={row.videoId} label="Din skickade video" />
      {confirming ? <><button type="button" className="secondary-btn" disabled={busy} onClick={() => void update("revoke")}>Bekräfta borttagning</button>{" "}<button type="button" className="secondary-btn" disabled={busy} onClick={() => setConfirming(false)}>Avbryt</button></>
      : <button type="button" className="secondary-btn" onClick={() => setConfirming(true)}>Ta bort videon</button>}
    </> : !readOnly && row.prompt && <>
      {!opened && <button type="button" className="secondary-btn" onClick={() => setOpened(true)}>Frivillig videokomplettering</button>}
      {opened && <div>
        <h3>Företagets videoförfrågan</h3>
        <p>{row.prompt}</p>
        <p>Din ansökan är redan skickad. Om du väljer att skicka en video kan företaget se den i 14 dagar.</p>
        {pending.current && selected ? <VideoPreview value={selected} /> : <>
          <VideoPicker value={selected} onChange={setSelected} disabled={busy || recording} />
          {!selected && <VideoRecorder disabled={busy} onBusy={setRecording} onRecorded={(file, duration) => setSelected({ file, duration })} />}
        </>}
        <button className="cta-btn" type="button" disabled={busy || (!selected && !pending.current)} onClick={() => void update("send")}>{busy ? "Skickar…" : retry ? "Försök skicka igen" : "Skicka videon till företaget"}</button>{" "}
        <button className="secondary-btn" type="button" disabled={busy} onClick={() => { if (!pending.current) setSelected(null); setOpened(false); setNote(""); }}>Avstå</button>
      </div>}
    </>}
    {note && <p role={retry ? "alert" : "status"}>{note}</p>}
  </section>;
}

export function ApplicationVideoPromptEditor({ jobId, owner, onClose }: { jobId: string; owner: string; onClose: () => void }) {
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    const signal = new AbortController();
    void Promise.resolve(getSupabaseClient().from("jobs").select("application_video_prompt").eq("id", jobId).eq("company_user_id", owner).abortSignal(signal.signal).single())
      .then(({ data, error }) => {
        if (signal.signal.aborted) return;
        if (error) { setError("Kunde inte hämta instruktionen."); return; }
        setValue(data.application_video_prompt ?? "");
        setLoading(false);
      }).catch(() => { if (!signal.signal.aborted) setError("Kunde inte hämta instruktionen."); });
    return () => signal.abort();
  }, [jobId, owner]);

  return <ModalDialog label="Frivillig videoförfrågan" busy={saving} onClose={onClose}>
    <form onSubmit={async event => {
      event.preventDefault();
      if (saving || loading) return;
      setSaving(true);
      setError("");
      try {
        const prompt = value.trim() || null;
        const { data, error } = await getSupabaseClient().from("jobs").update({ application_video_prompt: prompt })
          .eq("id", jobId).eq("company_user_id", owner).select("id").abortSignal(AbortSignal.timeout(12000)).single();
        if (error || data.id !== jobId) throw new Error("Kunde inte spara instruktionen.");
        onClose();
      } catch {
        setError("Kunde inte bekräfta sparningen. Kontrollera instruktionen igen.");
        setSaving(false);
      }
    }}>
      <label htmlFor="application-video-prompt">Vad vill ni att den sökande berättar om?</label>
      <p>Sökande ser frågan efter att ansökan har skickats. Lämna fältet tomt om ni inte vill fråga.</p>
      <textarea id="application-video-prompt" rows={4} maxLength={300} value={value} onChange={event => setValue(event.target.value)} disabled={loading || saving} />
      {error && <p role="alert">{error}</p>}
      <button className="cta-btn" type="submit" disabled={loading || saving}>Spara</button>
    </form>
  </ModalDialog>;
}
