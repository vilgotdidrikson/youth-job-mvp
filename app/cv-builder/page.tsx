"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { LanguageToggle } from "@/components/language-toggle";
import { useLanguage } from "@/hooks/use-language";
import { useSession } from "@/hooks/use-session";
import { getJobs } from "@/lib/jobs";
import { createCvPdfFile } from "@/lib/cv-pdf";
import { uploadYouthDocument } from "@/lib/storage";
import {
  addOnboardingMessage,
  buildGeneratedCvData,
  completeOnboardingSession,
  getOnboardingMessages,
  getOnboardingQuestionPrompts,
  getOrCreateOnboardingSession,
  getYouthProfile,
  saveGeneratedCvToProfile,
} from "@/lib/onboarding";

interface ChatTurn {
  id: string;
  role: "assistant" | "user";
  text: string;
}

export default function CvBuilderPage() {
  const router = useRouter();
  const { language, toggleLanguage } = useLanguage();
  const { user, profile, loading } = useSession();

  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [answers, setAnswers] = useState<string[]>([]);
  const [fullName, setFullName] = useState("");
  const [age, setAge] = useState("");
  const [city, setCity] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [targetRoles, setTargetRoles] = useState<string[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [workingTime, setWorkingTime] = useState<string[]>([]);
  const [experience, setExperience] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [error, setError] = useState("");

  const questions = useMemo(() => getOnboardingQuestionPrompts(), []);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
      return;
    }

    if (!loading && user && profile?.role === "youth") {
      void (async () => {
        try {
          const [existingProfile, jobs, session] = await Promise.all([
            getYouthProfile(user.id),
            getJobs(),
            getOrCreateOnboardingSession(),
          ]);

          setSessionId(session.id);
          setAvailableRoles([...new Set(jobs.map((job) => job.title))].slice(0, 12));

          if (existingProfile) {
            setFullName((existingProfile.full_name as string) || user.email?.split("@")[0] || "");
            setAge(existingProfile.age ? String(existingProfile.age) : "");
            setCity((existingProfile.city as string) || "");
            setSkills((existingProfile.strengths as string[]) || []);
            setTargetRoles((existingProfile.desired_roles as string[]) || []);
            setInterests((existingProfile.merits as string[]) || []);
            setWorkingTime((existingProfile.employment_preferences as string[]) || []);
            setExperience(((existingProfile.work_experience as string[]) || []).join(", "));
          } else {
            setFullName(user.email?.split("@")[0] ?? "");
          }

          const existingMessages = await getOnboardingMessages(session.id);

          if (!existingMessages.length) {
            await addOnboardingMessage(session.id, "assistant", questions[0]);
            setTurns([{ id: "q-0", role: "assistant", text: questions[0] }]);
            setAnswers([]);
            return;
          }

          setTurns(
            existingMessages.map((message) => ({
              id: message.id,
              role: message.sender,
              text: message.message_text,
            })),
          );
          setAnswers(existingMessages.filter((message) => message.sender === "user").map((message) => message.message_text));
        } catch (loadError) {
          console.error("Failed to initialize onboarding flow.", loadError);
          setError(loadError instanceof Error ? loadError.message : "Unable to load onboarding.");
        }
      })();
    }
  }, [loading, profile?.role, questions, router, user]);

  const t =
    language === "sv"
      ? {
          home: "Startsida",
          title: "AI CV-chat",
          subtitle: "Svara kort på frågorna. Vi bygger CV + ansökan automatiskt.",
          loading: "Laddar...",
          youthOnly: "Detta steg gäller ungdomskonton.",
          send: "Skicka",
          skills: "Kompetenser",
          city: "Stad",
          fullName: "Namn",
          age: "Ålder",
          targetRoles: "Intressanta jobb",
          interests: "Intressen",
          workingTime: "När kan du jobba",
          experience: "Erfarenhet",
          save: "Spara CV och fortsätt",
          saved: "CV sparat i din profil.",
          openProfile: "Öppna profil",
          failed: "Kunde inte ladda onboarding-flödet.",
        }
      : {
          home: "Home",
          title: "AI CV chat",
          subtitle: "Answer short interview questions. We generate your CV + application.",
          loading: "Loading...",
          youthOnly: "This step is for youth accounts.",
          send: "Send",
          skills: "Skills",
          city: "City",
          fullName: "Full name",
          age: "Age",
          targetRoles: "Preferred jobs",
          interests: "Interests",
          workingTime: "When you can work",
          experience: "Experience",
          save: "Save CV and continue",
          saved: "CV saved to your profile.",
          openProfile: "Open profile",
          failed: "Unable to load onboarding.",
        };

  const currentQuestion = questions[answers.length];
  const chatDone = answers.length >= questions.length;

  const onSubmitAnswer = async (event: FormEvent) => {
    event.preventDefault();
    const answer = input.trim();
    if (!answer || chatDone || !sessionId) return;

    try {
      await addOnboardingMessage(sessionId, "user", answer);
      const nextAnswers = [...answers, answer];
      const nextTurns: ChatTurn[] = [...turns, { id: `u-${nextAnswers.length}`, role: "user", text: answer }];

      if (nextAnswers.length < questions.length) {
        const nextQuestion = questions[nextAnswers.length];
        await addOnboardingMessage(sessionId, "assistant", nextQuestion);
        nextTurns.push({ id: `q-${nextAnswers.length}`, role: "assistant", text: nextQuestion });
      }

      setAnswers(nextAnswers);
      setTurns(nextTurns);
      setInput("");

      if (nextAnswers.length >= 3 && !experience) {
        setExperience(nextAnswers[2]);
      }
    } catch (messageError) {
      console.error("Failed to save onboarding message.", messageError);
      setError(messageError instanceof Error ? messageError.message : "Unable to save onboarding.");
    }
  };

  const toggleChip = (list: string[], setList: (values: string[]) => void, value: string) => {
    setList(list.includes(value) ? list.filter((item) => item !== value) : [...list, value]);
  };

  const handleSave = async () => {
    setSaving(true);

    try {
      const generatedProfile = buildGeneratedCvData({
        fullName,
        age,
        city,
        skills,
        targetRoles,
        interests,
        workingTime,
        experience,
        answers,
      });
      const pdfFile = await createCvPdfFile(generatedProfile.cv_text ?? "", fullName);
      const pdfUrl = await uploadYouthDocument(pdfFile);
      const existingProfile = await getYouthProfile(user?.id);

      await saveGeneratedCvToProfile({
        ...generatedProfile,
        documents: [
          ...((existingProfile?.documents ?? []).filter((document) => document.type !== "generated_cv")),
          { name: pdfFile.name, url: pdfUrl, type: "generated_cv" },
        ],
      });

      if (sessionId) {
        await completeOnboardingSession(sessionId);
      }

      setSavedMsg(t.saved);
      setError("");
    } catch (saveError) {
      console.error("Failed to save generated CV data.", saveError);
      setError(saveError instanceof Error ? saveError.message : "Unable to save onboarding.");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !user) {
    return (
      <main className="mobile-shell flex flex-col justify-center">
        <div className="glass-card p-6 text-sm text-[#2d4f72]">{t.loading}</div>
      </main>
    );
  }

  if (profile?.role !== "youth") {
    return (
      <main className="mobile-shell pb-8">
        <div className="mb-4 flex items-center justify-between gap-2">
          <Link href="/" className="secondary-btn px-3 py-2 text-xs">
            {t.home}
          </Link>
          <LanguageToggle language={language} onToggle={toggleLanguage} />
        </div>
        <div className="glass-card p-5 text-sm text-[#3f5f82]">{t.youthOnly}</div>
      </main>
    );
  }

  return (
    <main className="mobile-shell pb-8">
      <div className="mb-4 flex items-center justify-between gap-2">
        <Link href="/" className="secondary-btn px-3 py-2 text-xs">
          {t.home}
        </Link>
        <LanguageToggle language={language} onToggle={toggleLanguage} />
      </div>

      <section className="glass-card p-5">
        <h1 className="text-2xl font-semibold text-[#132742]">{t.title}</h1>
        <p className="mt-2 text-sm text-[#3f5f82]">{t.subtitle}</p>

        <div className="mt-4 space-y-2 rounded-2xl bg-[#f7fbff] p-3">
          {turns.map((turn) => (
            <div
              key={turn.id}
              className={`max-w-[90%] rounded-2xl px-3 py-2 text-sm ${
                turn.role === "assistant"
                  ? "bg-white text-[#2e4f75]"
                  : "ml-auto bg-[#e7f1ff] text-[#113f72]"
              }`}
            >
              {turn.text}
            </div>
          ))}

          {!chatDone && currentQuestion && (
            <form className="mt-2 flex gap-2" onSubmit={(event) => void onSubmitAnswer(event)}>
              <input
                className="h-11 flex-1 rounded-xl border border-[#cfe2ff] bg-white px-3 text-sm outline-none focus:border-[#1474ff]"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Skriv ditt svar..."
              />
              <button type="submit" className="cta-btn min-h-11 px-4 text-sm">
                {t.send}
              </button>
            </form>
          )}
        </div>
      </section>

      <section className="mt-3 glass-card space-y-3 p-4">
        <div className="grid grid-cols-2 gap-2">
          <input
            className="h-11 rounded-xl border border-[#cfe2ff] px-3 text-sm"
            placeholder={t.fullName}
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
          />
          <input
            className="h-11 rounded-xl border border-[#cfe2ff] px-3 text-sm"
            placeholder={t.age}
            value={age}
            onChange={(event) => setAge(event.target.value)}
          />
        </div>
        <input
          className="h-11 w-full rounded-xl border border-[#cfe2ff] px-3 text-sm"
          placeholder={t.city}
          value={city}
          onChange={(event) => setCity(event.target.value)}
        />

        <label className="text-xs font-semibold uppercase tracking-[0.14em] text-[#4c6887]">{t.targetRoles}</label>
        <div className="profile-chip-wrap">
          {availableRoles.map((role) => (
            <button
              key={role}
              type="button"
              onClick={() => toggleChip(targetRoles, setTargetRoles, role)}
              className={`profile-chip ${
                targetRoles.includes(role) ? "profile-chip-selected" : "profile-chip-suggestion"
              }`}
            >
              {role}
            </button>
          ))}
        </div>

        <input
          className="h-11 w-full rounded-xl border border-[#cfe2ff] px-3 text-sm"
          placeholder={`${t.skills} (comma separated)`}
          value={skills.join(", ")}
          onChange={(event) =>
            setSkills(
              event.target.value
                .split(",")
                .map((item) => item.trim())
                .filter(Boolean),
            )
          }
        />
        <input
          className="h-11 w-full rounded-xl border border-[#cfe2ff] px-3 text-sm"
          placeholder={`${t.interests} (comma separated)`}
          value={interests.join(", ")}
          onChange={(event) =>
            setInterests(
              event.target.value
                .split(",")
                .map((item) => item.trim())
                .filter(Boolean),
            )
          }
        />
        <input
          className="h-11 w-full rounded-xl border border-[#cfe2ff] px-3 text-sm"
          placeholder={`${t.workingTime} (comma separated)`}
          value={workingTime.join(", ")}
          onChange={(event) =>
            setWorkingTime(
              event.target.value
                .split(",")
                .map((item) => item.trim())
                .filter(Boolean),
            )
          }
        />
        <textarea
          rows={4}
          className="w-full rounded-xl border border-[#cfe2ff] px-3 py-3 text-sm"
          placeholder={t.experience}
          value={experience}
          onChange={(event) => setExperience(event.target.value)}
        />

        {error && <p className="rounded-xl bg-[#ffe7e5] px-3 py-2 text-sm text-[#9e3a2d]">{error || t.failed}</p>}

        <button type="button" className="cta-btn min-h-12 w-full px-4 py-3 text-sm" onClick={() => void handleSave()}>
          {saving ? "..." : t.save}
        </button>
        {savedMsg && <p className="rounded-xl bg-[#e8f5ec] px-3 py-2 text-sm text-[#1f6845]">{savedMsg}</p>}
        <Link href="/profile" className="secondary-btn block w-full px-4 py-3 text-center text-sm">
          {t.openProfile}
        </Link>
      </section>
    </main>
  );
}
