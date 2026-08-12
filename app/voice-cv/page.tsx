"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/hooks/use-session";
import { getYouthProfile, saveVoiceCvToProfile } from "@/lib/onboarding";
import { createEmptyStructuredCv, type StructuredCvData } from "@/lib/structured-cv";
import type { CvInterviewArea } from "@/lib/cv-interview";

const VOICE_CV_STORAGE_KEY = "employo-voice-cv-answers";
const VOICE_CV_STRUCTURED_KEY = "employo-voice-cv-structured";
const VOICE_CV_DRAFT_KEY = "employo-voice-cv-draft";
type VoiceArea = "strengths" | "languages" | "work_experience" | "education" | "certificates";
type VoiceAnswers = Partial<Record<VoiceArea, string>>;
interface VoiceInterviewState {
  currentArea: CvInterviewArea;
  answerCounts: Partial<Record<CvInterviewArea, number>>;
  askedQuestionIds: string[];
  lastQuestion?: string;
  structuredCv: StructuredCvData;
}
const VOICE_BUTTON_COLOR = "#ec4899";

export default function VoiceCvPage() {
  const router = useRouter();
  const { user, profile, loading } = useSession();
  const microphone = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const recordedChunks = useRef<Blob[]>([]);
  const responseAudio = useRef<HTMLAudioElement | null>(null);
  const finishResponseAudio = useRef<(() => void) | null>(null);
  const answers = useRef<VoiceAnswers>({});
  const interviewState = useRef<VoiceInterviewState>({ currentArea: "personalInfo", answerCounts: {}, askedQuestionIds: [], structuredCv: createEmptyStructuredCv() });
  const endingCall = useRef(false);
  const pausingCall = useRef(false);
  const discardNextRecording = useRef(false);
  const retryTurn = useRef<FormData | null>(null);
  const requestController = useRef<AbortController | null>(null);
  const silenceMonitor = useRef<number | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const [status, setStatus] = useState<"idle" | "connecting" | "speaking" | "recording" | "processing" | "paused" | "complete">("idle");
  const [question, setQuestion] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
    if (!loading && user && profile && profile.role !== "youth") router.replace("/company?view=swipe");
  }, [loading, profile, router, user]);

  useEffect(() => {
    try {
      const draft = JSON.parse(sessionStorage.getItem(VOICE_CV_DRAFT_KEY) ?? "null") as { answers?: VoiceAnswers; state?: VoiceInterviewState; question?: string } | null;
      if (!draft?.answers || !draft.state) return;
      if (!draft.state.structuredCv || !Array.isArray(draft.state.askedQuestionIds)) {
        sessionStorage.removeItem(VOICE_CV_DRAFT_KEY);
        return;
      }
      answers.current = draft.answers;
      interviewState.current = draft.state;
      setQuestion(draft.question ?? "");
      setStatus("paused");
    } catch {
      sessionStorage.removeItem(VOICE_CV_DRAFT_KEY);
    }
  }, []);

  const saveDraft = (currentQuestion = question) => {
    sessionStorage.setItem(VOICE_CV_DRAFT_KEY, JSON.stringify({ answers: answers.current, state: interviewState.current, question: currentQuestion }));
  };

  const stopSilenceMonitor = () => {
    if (silenceMonitor.current !== null) window.clearInterval(silenceMonitor.current);
    silenceMonitor.current = null;
    void audioContext.current?.close();
    audioContext.current = null;
  };

  const stopCall = () => {
    endingCall.current = true;
    requestController.current?.abort();
    requestController.current = null;
    stopSilenceMonitor();
    if (recorder.current?.state === "recording") recorder.current.stop();
    recorder.current = null;
    microphone.current?.getTracks().forEach((track) => track.stop());
    microphone.current = null;
    responseAudio.current?.pause();
    window.speechSynthesis.cancel();
    finishResponseAudio.current?.();
    responseAudio.current = null;
    answers.current = {};
    interviewState.current = { currentArea: "personalInfo", answerCounts: {}, askedQuestionIds: [], structuredCv: createEmptyStructuredCv() };
    retryTurn.current = null;
    setQuestion("");
    setStatus((current) => current === "complete" ? current : "idle");
  };
  useEffect(() => () => {
    endingCall.current = true;
    requestController.current?.abort();
    if (silenceMonitor.current !== null) window.clearInterval(silenceMonitor.current);
    void audioContext.current?.close();
    if (recorder.current?.state === "recording") recorder.current.stop();
    microphone.current?.getTracks().forEach((track) => track.stop());
    responseAudio.current?.pause();
    window.speechSynthesis.cancel();
    finishResponseAudio.current?.();
  }, []);

  const playResponse = async (text: string, audioBase64?: string) => {
    setStatus("speaking");
    if (!audioBase64) {
      await new Promise<void>((resolve) => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "sv-SE";
        utterance.rate = 1.04;
        const finish = () => { finishResponseAudio.current = null; resolve(); };
        finishResponseAudio.current = finish;
        utterance.onend = finish;
        utterance.onerror = finish;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
      });
      return;
    }
    const audio = new Audio(`data:audio/mpeg;base64,${audioBase64}`);
    responseAudio.current?.pause();
    responseAudio.current = audio;
    await new Promise<void>((resolve) => {
      const finish = () => { finishResponseAudio.current = null; resolve(); };
      finishResponseAudio.current = finish;
      audio.onended = finish;
      audio.onerror = finish;
      void audio.play().catch(finish);
    });
  };

  const submitTurn = async (formData: FormData) => {
    retryTurn.current = formData;
    setStatus("processing");
    const controller = new AbortController();
    requestController.current?.abort();
    requestController.current = controller;
    try {
      const response = await fetch("/api/voice/turn", { method: "POST", body: formData, signal: controller.signal });
      const result = await response.json() as { answers?: VoiceAnswers; state?: VoiceInterviewState; structured?: StructuredCvData; complete?: boolean; nextQuestion?: string; audioBase64?: string; error?: string };
      if (!response.ok || !result.answers || !result.state || !result.nextQuestion) throw new Error(result.error ?? "Kunde inte behandla ditt svar.");
      answers.current = result.answers;
      interviewState.current = result.state;
      const nextQuestion = result.nextQuestion ?? "";
      setQuestion(nextQuestion);
      saveDraft(nextQuestion);
      if (result.complete) {
        await saveVoiceCvToProfile(result.structured ?? result.state.structuredCv);
        sessionStorage.setItem(VOICE_CV_STORAGE_KEY, JSON.stringify(result.answers));
        sessionStorage.setItem(VOICE_CV_STRUCTURED_KEY, JSON.stringify(result.structured ?? result.state.structuredCv));
        sessionStorage.removeItem(VOICE_CV_DRAFT_KEY);
        retryTurn.current = null;
        await playResponse(nextQuestion, result.audioBase64);
        if (!endingCall.current) setStatus("complete");
        return;
      }
      retryTurn.current = null;
      await playResponse(nextQuestion, result.audioBase64);
      if (!endingCall.current && !pausingCall.current) startRecording();
    } catch (turnError) {
      if (controller.signal.aborted) return;
      setError(turnError instanceof Error ? turnError.message : "Kunde inte behandla ditt svar.");
      if (!endingCall.current) setStatus("paused");
    } finally {
      if (requestController.current === controller) requestController.current = null;
    }
  };

  const startCall = async () => {
    if (!user) return;
    setError(""); setQuestion(""); setStatus("connecting"); endingCall.current = false; pausingCall.current = false; answers.current = {};
    try {
      const youthProfile = await getYouthProfile(user.id);
      const initialCv = createEmptyStructuredCv({ name: youthProfile?.full_name ?? undefined, city: youthProfile?.city ?? undefined });
      interviewState.current = { currentArea: "personalInfo", answerCounts: {}, askedQuestionIds: [], structuredCv: initialCv };
      microphone.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      const formData = new FormData();
      formData.set("start", "true");
      formData.set("structuredCv", JSON.stringify(initialCv));
      await submitTurn(formData);
    } catch (callError) {
      stopCall();
      setError(callError instanceof Error ? callError.message : "Mikrofonen eller röstsamtalet kunde inte startas.");
    }
  };

  const startRecording = () => {
    if (!microphone.current) return;
    setError("");
    recordedChunks.current = [];
    const currentRecorder = new MediaRecorder(microphone.current);
    recorder.current = currentRecorder;
    currentRecorder.ondataavailable = (event) => { if (event.data.size) recordedChunks.current.push(event.data); };
    currentRecorder.onstop = () => {
      stopSilenceMonitor();
      const discardRecording = discardNextRecording.current;
      discardNextRecording.current = false;
      if (endingCall.current || pausingCall.current || discardRecording) return;
      const recording = new Blob(recordedChunks.current, { type: currentRecorder.mimeType || "audio/webm" });
      if (!recording.size) { setError("Ingen inspelning kunde tas emot."); setStatus("idle"); return; }
      const formData = new FormData();
      formData.set("audio", recording, "answer.webm");
      formData.set("answers", JSON.stringify(answers.current));
      formData.set("state", JSON.stringify(interviewState.current));
      void submitTurn(formData);
    };
    currentRecorder.start();
    setStatus("recording");
    const context = new AudioContext();
    const source = context.createMediaStreamSource(microphone.current);
    const analyser = context.createAnalyser();
    analyser.fftSize = 1024;
    source.connect(analyser);
    audioContext.current = context;
    const samples = new Uint8Array(analyser.fftSize);
    let heardSpeech = false;
    let silentSince: number | null = null;
    silenceMonitor.current = window.setInterval(() => {
      analyser.getByteTimeDomainData(samples);
      const level = samples.reduce((total, sample) => total + Math.abs(sample - 128), 0) / samples.length / 128;
      if (level > 0.018) {
        heardSpeech = true;
        silentSince = null;
        return;
      }
      if (!heardSpeech) return;
      const now = Date.now();
      silentSince ??= now;
      if (now - silentSince >= 1800 && currentRecorder.state === "recording") currentRecorder.stop();
    }, 100);
  };

  const stopRecording = () => {
    if (recorder.current?.state === "recording") recorder.current.stop();
  };

  const skipQuestion = async () => {
    setError("");
    discardNextRecording.current = true;
    if (recorder.current?.state === "recording") recorder.current.stop();
    try {
      if (!microphone.current) microphone.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      pausingCall.current = false;
      const formData = new FormData();
      formData.set("skip", "true");
      formData.set("answers", JSON.stringify(answers.current));
      formData.set("state", JSON.stringify(interviewState.current));
      await submitTurn(formData);
    } catch (skipError) {
      setError(skipError instanceof Error ? skipError.message : "Kunde inte hoppa över frågan.");
      setStatus("paused");
    }
  };

  const pauseCall = () => {
    pausingCall.current = true;
    saveDraft();
    stopSilenceMonitor();
    if (recorder.current?.state === "recording") recorder.current.stop();
    responseAudio.current?.pause();
    finishResponseAudio.current?.();
    microphone.current?.getTracks().forEach((track) => track.stop());
    microphone.current = null;
    setStatus("paused");
  };

  const resumeCall = async () => {
    setError("");
    endingCall.current = false;
    pausingCall.current = false;
    if (retryTurn.current) {
      await submitTurn(retryTurn.current);
      return;
    }
    try {
      microphone.current = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      startRecording();
    } catch (callError) {
      setError(callError instanceof Error ? callError.message : "Mikrofonen kunde inte startas.");
      setStatus("paused");
    }
  };

  const abortCall = () => {
    sessionStorage.removeItem(VOICE_CV_DRAFT_KEY);
    stopCall();
    setError("");
    setStatus("idle");
  };

  const goBack = () => {
    sessionStorage.removeItem(VOICE_CV_DRAFT_KEY);
    stopCall();
    router.push("/youth/cv");
  };

  if (loading || !user || !profile) return <main className="mobile-shell" style={{ display: "grid", placeItems: "center" }}><p>Laddar...</p></main>;
  return <main className="mobile-shell voice-cv-page" style={{ minHeight: "100svh" }}>
    <button type="button" onClick={goBack} aria-label="Tillbaka till CV-val" title="Tillbaka till CV-val" className="voice-cv-back">←</button>
    <section className="card" style={{ display: "grid", gap: "1.1rem", padding: "1.35rem", textAlign: "center" }}>
      <p style={{ margin: 0, color: "var(--accent)", fontSize: ".72rem", fontWeight: 800, letterSpacing: ".1em", textTransform: "uppercase" }}>Röstsamtal</p>
      <h1 style={{ margin: "-.6rem 0 0", color: "var(--text-primary)", fontSize: "1.9rem", letterSpacing: "-.05em" }}>Prata fram ditt CV</h1>
      <p style={{ margin: "-.5rem 0 0", color: "var(--text-secondary)", fontSize: ".9rem", lineHeight: 1.55 }}>AI:n frågar, du svarar. Samtalet går vidare när du har pratat klart.</p>
      <div style={{ display: "grid", width: "5.5rem", height: "5.5rem", margin: ".4rem auto", placeItems: "center", borderRadius: "50%", color: "var(--color-on-brand)", background: status === "recording" ? VOICE_BUTTON_COLOR : "var(--color-surface-soft)", fontSize: "1.6rem" }} aria-hidden="true">{status === "recording" ? "●" : "◌"}</div>
      {question && <p style={{ margin: 0, color: "var(--text-primary)", fontSize: ".95rem", lineHeight: 1.5 }}>{question}</p>}
      <p aria-live="polite" style={{ minHeight: "1.4rem", margin: 0, color: "var(--text-secondary)", fontSize: ".85rem" }}>{status === "connecting" ? "AI:n förbereder första frågan..." : status === "speaking" ? "AI:n pratar..." : status === "recording" ? "AI:n lyssnar på ditt svar..." : status === "processing" ? "AI:n bearbetar ditt svar..." : status === "paused" ? error ? "Svaret sparades inte. Försök igen utan att börja om." : "Samtalet är pausat." : status === "complete" ? "Samtalet är klart." : "Tryck på Starta så börjar AI:n."}</p>
      {error && <p style={{ margin: 0, color: "var(--color-danger)", fontSize: ".84rem" }}>{error}</p>}
      <button type="button" onClick={status === "idle" ? () => void startCall() : status === "recording" ? stopRecording : status === "paused" ? () => void resumeCall() : status === "complete" ? () => { stopCall(); router.push("/youth/cv/create?voice=finalize"); } : undefined} disabled={status === "connecting" || status === "speaking" || status === "processing"} className="cta-btn" style={{ minHeight: "3.35rem", borderColor: VOICE_BUTTON_COLOR, background: VOICE_BUTTON_COLOR, fontSize: "1rem", opacity: status === "connecting" || status === "speaking" || status === "processing" ? .65 : 1 }}>{status === "connecting" ? "AI:n förbereder..." : status === "speaking" ? "AI:n pratar..." : status === "recording" ? "Jag har pratat klart" : status === "processing" ? "AI:n bearbetar..." : status === "paused" ? error ? "Försök igen" : "Fortsätt samtalet" : status === "complete" ? "Fortsätt" : "Starta"}</button>
      {(status === "recording" || status === "paused") && <button type="button" onClick={() => void skipQuestion()} style={{ justifySelf: "center", padding: ".25rem", border: 0, color: "var(--text-secondary)", background: "transparent", font: "inherit", fontSize: ".82rem", fontWeight: 700, cursor: "pointer" }}>Hoppa över frågan</button>}
      {status !== "idle" && status !== "complete" && <div style={{ display: "flex", justifyContent: "center", gap: "1rem" }}>{(status === "recording" || status === "speaking") && <button type="button" onClick={pauseCall} style={{ padding: ".35rem", border: 0, color: "var(--text-secondary)", background: "transparent", font: "inherit", fontSize: ".82rem", fontWeight: 700, cursor: "pointer" }}>Pausa</button>}<button type="button" onClick={abortCall} style={{ padding: ".35rem", border: 0, color: "var(--color-danger)", background: "transparent", font: "inherit", fontSize: ".82rem", fontWeight: 700, cursor: "pointer" }}>Avbryt samtalet</button></div>}
      <p style={{ margin: 0, color: "var(--text-tertiary)", fontSize: ".72rem", lineHeight: 1.45 }}>Ljudet transkriberas och behandlas av OpenAI. Inga ljudinspelningar sparas av Employo.</p>
    </section>
  </main>;
}
