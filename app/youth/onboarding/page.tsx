"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/client-api";
import { useSession } from "@/hooks/use-session";
import { OnboardingStep } from "@/lib/types";

type Language = "en" | "sv";
type Tone = "professional" | "friendly" | "confident";

interface DraftProfile {
  name: string;
  age: number | null;
  city: string;
  contactEmail: string;
  contactPhone: string;
  targetRole: string;
  interests: string[];
  skills: string[];
  availability: string;
  experience: string[];
}

interface DraftCv {
  summary: string;
  content: string;
  language: Language;
  tone: Tone;
  targetRole?: string;
  qualityScore: number;
  highlights: string[];
  suggestions: string[];
}

interface OnboardingResponse {
  done: boolean;
  completion: number;
  step: OnboardingStep | "done";
  question: string;
  validationError: string;
  recommendations: string[];
  draftProfile: DraftProfile;
  cv: DraftCv;
}

const PAGE_SIZE = 6;
const MULTI_STEPS: OnboardingStep[] = [
  "targetRole",
  "interests",
  "skills",
  "availability",
  "experience",
];

function splitCsv(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

export default function YouthOnboardingPage() {
  const router = useRouter();
  const { user, loading } = useSession("youth");

  const [error, setError] = useState("");
  const [language, setLanguage] = useState<Language>("sv");
  const [tone, setTone] = useState<Tone>("friendly");

  const [step, setStep] = useState<OnboardingStep | "done">("name");
  const [question, setQuestion] = useState("Vad heter du?");
  const [completion, setCompletion] = useState(0);
  const [validationError, setValidationError] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [recommendations, setRecommendations] = useState<string[]>([]);
  const [recommendationPage, setRecommendationPage] = useState(0);
  const [history, setHistory] = useState<Array<{ q: string; a: string }>>([]);
  const [collector, setCollector] = useState<string[]>([]);

  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [bootLoading, setBootLoading] = useState(true);

  const [draftProfile, setDraftProfile] = useState<DraftProfile>({
    name: "",
    age: null,
    city: "",
    contactEmail: "",
    contactPhone: "",
    targetRole: "",
    interests: [],
    skills: [],
    availability: "",
    experience: [],
  });
  const [draftCv, setDraftCv] = useState<DraftCv | null>(null);

  const isMultiStep = step !== "done" && MULTI_STEPS.includes(step as OnboardingStep);

  const recommendationSlice = useMemo(() => {
    const start = recommendationPage * PAGE_SIZE;
    return recommendations.slice(start, start + PAGE_SIZE);
  }, [recommendationPage, recommendations]);

  const readyToSave = useMemo(() => !!draftCv, [draftCv]);

  const hydrateCollectorForStep = useCallback(
    (nextStep: OnboardingStep | "done", nextDraft: DraftProfile) => {
      if (nextStep === "done") {
        setCollector([]);
        return;
      }
      if (nextStep === "targetRole") {
        setCollector(splitCsv(nextDraft.targetRole));
        return;
      }
      if (nextStep === "interests") {
        setCollector(nextDraft.interests);
        return;
      }
      if (nextStep === "skills") {
        setCollector(nextDraft.skills);
        return;
      }
      if (nextStep === "availability") {
        setCollector(splitCsv(nextDraft.availability));
        return;
      }
      if (nextStep === "experience") {
        setCollector(nextDraft.experience);
        return;
      }
      setCollector([]);
    },
    [],
  );

  const loadInitial = useCallback(async () => {
    if (!user) return;
    setBootLoading(true);
    try {
      const response = await apiRequest<OnboardingResponse>("/api/youth/onboarding/ai", {
        method: "POST",
        userId: user.id,
        body: JSON.stringify({
          mode: "init",
          language,
          tone,
          targetJobType: "any",
        }),
      });
      setStep(response.step);
      setQuestion(response.question);
      setCompletion(response.completion);
      setValidationError(response.validationError);
      setRecommendations(response.recommendations);
      setRecommendationPage(0);
      setDraftProfile(response.draftProfile);
      setDraftCv(response.cv);
      hydrateCollectorForStep(response.step, response.draftProfile);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Kunde inte starta onboarding.");
    } finally {
      setBootLoading(false);
    }
  }, [hydrateCollectorForStep, language, tone, user]);

  useEffect(() => {
    if (user) {
      void loadInitial();
    }
  }, [loadInitial, user]);

  const submitAnswer = async (answer: string) => {
    if (!user || step === "done" || !answer.trim()) return;
    setSending(true);
    setError("");
    try {
      const response = await apiRequest<OnboardingResponse>("/api/youth/onboarding/ai", {
        method: "POST",
        userId: user.id,
        body: JSON.stringify({
          mode: "answer",
          step,
          answer,
          draft: draftProfile,
          language,
          tone,
          targetJobType: "any",
        }),
      });
      setHistory((current) => [...current, { q: question, a: answer }].slice(-4));
      setStep(response.step);
      setQuestion(response.question);
      setCompletion(response.completion);
      setValidationError(response.validationError);
      setRecommendations(response.recommendations);
      setRecommendationPage(0);
      setDraftProfile(response.draftProfile);
      setDraftCv(response.cv);
      setInputValue("");
      hydrateCollectorForStep(response.step, response.draftProfile);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Kunde inte behandla svaret.");
    } finally {
      setSending(false);
    }
  };

  const addToCollector = (value: string) => {
    const cleaned = value.trim();
    if (!cleaned) return;
    setCollector((current) => unique([...current, cleaned]));
    setInputValue("");
  };

  const removeFromCollector = (value: string) => {
    setCollector((current) => current.filter((item) => item !== value));
  };

  const submitCollector = async () => {
    if (!isMultiStep) return;
    if (collector.length === 0) {
      setValidationError("Lägg till minst ett alternativ innan du fortsätter.");
      return;
    }
    await submitAnswer(collector.join(", "));
  };

  const handleSend = async () => {
    if (isMultiStep) {
      addToCollector(inputValue);
      return;
    }
    await submitAnswer(inputValue);
  };

  const showMoreRecommendations = () => {
    const pageCount = Math.ceil(recommendations.length / PAGE_SIZE);
    setRecommendationPage((current) => (current + 1 >= pageCount ? 0 : current + 1));
  };

  const handleFinalize = async () => {
    if (!user || !draftCv) return;
    setSaving(true);
    setError("");
    try {
      await apiRequest("/api/youth/profile", {
        method: "PUT",
        userId: user.id,
        body: JSON.stringify({
          name: draftProfile.name,
          age: draftProfile.age,
          city: draftProfile.city,
          contactEmail: draftProfile.contactEmail,
          contactPhone: draftProfile.contactPhone,
          targetRole: draftProfile.targetRole,
          skills: draftProfile.skills,
          interests: draftProfile.interests,
          experience: draftProfile.experience,
          availability: draftProfile.availability,
          cv: {
            summary: draftCv.summary,
            content: draftCv.content,
            language: draftCv.language,
            tone: draftCv.tone,
            targetRole: draftCv.targetRole || draftProfile.targetRole,
            qualityScore: draftCv.qualityScore,
            highlights: draftCv.highlights,
            suggestions: draftCv.suggestions,
            updatedAt: new Date().toISOString(),
          },
        }),
      });
      router.push("/youth");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Kunde inte spara profilen.");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !user || bootLoading) {
    return <div className="mobile-shell py-10 text-sm text-[#3e648d]">Laddar...</div>;
  }

  return (
    <div className="mobile-shell space-y-3 pb-8">
      <div className="glass-card p-4">
        <p className="text-xs uppercase tracking-[0.15em] text-[#547295]">AI Profilbyggare</p>
        <h1 className="mt-1 text-2xl font-semibold text-[#123357]">En fråga i taget</h1>
        <div className="mt-3 h-2 rounded-full bg-[#e7f0ff]">
          <div
            className="h-2 rounded-full bg-gradient-to-r from-[#0e74ff] to-[#18a8ff]"
            style={{ width: `${completion}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-[#5a7a9d]">{completion}% klart</p>
      </div>

      <div className="glass-card p-4">
        <div className="grid grid-cols-2 gap-2">
          <select
            value={language}
            onChange={(event) => setLanguage(event.target.value as Language)}
            className="rounded-xl border border-[#cfe2ff] px-3 py-2 text-sm outline-none"
          >
            <option value="en">Engelska</option>
            <option value="sv">Svenska</option>
          </select>
          <select
            value={tone}
            onChange={(event) => setTone(event.target.value as Tone)}
            className="rounded-xl border border-[#cfe2ff] px-3 py-2 text-sm outline-none"
          >
            <option value="friendly">Vänlig</option>
            <option value="professional">Professionell</option>
            <option value="confident">Självsäker</option>
          </select>
        </div>
      </div>

      <div className="glass-card p-4">
        <p className="text-xs uppercase tracking-[0.12em] text-[#56769b]">Aktuell fråga</p>
        <p className="mt-2 text-lg font-semibold text-[#14365b]">{question}</p>

        {step !== "done" && (
          <>
            <div className="mt-3 flex gap-2">
              <input
                className="w-full rounded-xl border border-[#cfe2ff] px-3 py-2 text-sm outline-none"
                placeholder={isMultiStep ? "Lägg till ett alternativ..." : "Kort svar..."}
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void handleSend();
                  }
                }}
              />
              <button className="cta-btn px-4 py-2 text-sm" onClick={handleSend} disabled={sending}>
                {sending ? "..." : isMultiStep ? "Lägg till" : "Skicka"}
              </button>
            </div>

            {isMultiStep && collector.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {collector.map((item) => (
                  <button
                    key={item}
                    className="rounded-full border border-[#cfe2ff] bg-white px-3 py-1 text-xs text-[#2d567f]"
                    onClick={() => removeFromCollector(item)}
                    type="button"
                  >
                    {item} x
                  </button>
                ))}
              </div>
            )}

            {recommendationSlice.length > 0 && (
              <div className="mt-3">
                <p className="mb-2 text-xs text-[#57779d]">Förslag</p>
                <div className="flex flex-wrap gap-2">
                  {recommendationSlice.map((item) => (
                    <button
                      key={item}
                      className="rounded-full border border-[#cfe2ff] bg-[#f4f9ff] px-3 py-1 text-xs text-[#2e567f]"
                      onClick={() => (isMultiStep ? addToCollector(item) : void submitAnswer(item))}
                      type="button"
                    >
                      {item}
                    </button>
                  ))}
                </div>
                {recommendations.length > PAGE_SIZE && (
                  <button
                    className="mt-2 text-xs font-semibold text-[#2b5f98]"
                    onClick={showMoreRecommendations}
                    type="button"
                  >
                    Visa fler
                  </button>
                )}
              </div>
            )}

            {isMultiStep && (
              <button
                className="cta-btn mt-3 w-full px-4 py-3 text-sm"
                onClick={submitCollector}
                disabled={sending}
                type="button"
              >
                Jag är klar
              </button>
            )}
          </>
        )}

        {validationError && (
          <p className="mt-3 rounded-xl bg-[#ffe9e6] px-3 py-2 text-xs text-[#953c2e]">
            {validationError}
          </p>
        )}
      </div>

      {history.length > 0 && (
        <div className="glass-card p-4">
          <p className="text-xs uppercase tracking-[0.12em] text-[#5b7898]">Senaste svar</p>
          <div className="mt-2 space-y-2">
            {history.map((entry, index) => (
              <div key={`${entry.q}-${index}`} className="rounded-xl bg-[#f5f9ff] px-3 py-2">
                <p className="text-xs text-[#58789b]">{entry.q}</p>
                <p className="text-sm text-[#244c75]">{entry.a}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {draftCv && (
        <div className="glass-card p-4">
          <p className="text-xs uppercase tracking-[0.12em] text-[#58779d]">AI CV-utkast</p>
          <p className="mt-1 text-sm text-[#2d537d]">
            Kvalitet: <strong>{draftCv.qualityScore}/100</strong>
          </p>
          <textarea
            className="mt-2 min-h-20 w-full rounded-xl border border-[#cfe2ff] p-3 text-sm outline-none"
            value={draftCv.summary}
            onChange={(event) =>
              setDraftCv((current) => (current ? { ...current, summary: event.target.value } : current))
            }
          />
          <textarea
            className="mt-2 min-h-40 w-full rounded-xl border border-[#cfe2ff] p-3 text-xs outline-none"
            value={draftCv.content}
            onChange={(event) =>
              setDraftCv((current) => (current ? { ...current, content: event.target.value } : current))
            }
          />
        </div>
      )}

      {error && <p className="rounded-xl bg-[#ffe8e6] px-3 py-2 text-sm text-[#8f3a2e]">{error}</p>}

      <button className="cta-btn w-full px-4 py-3 text-sm" disabled={!readyToSave || saving} onClick={handleFinalize}>
        {saving ? "Sparar..." : "Spara profil och fortsätt"}
      </button>
    </div>
  );
}

