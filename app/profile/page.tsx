"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { LanguageToggle } from "@/components/language-toggle";
import { ProfileProgressCard } from "@/components/profile/profile-progress-card";
import { ProfileSectionCard } from "@/components/profile/profile-section-card";
import { SelectedChip } from "@/components/profile/selected-chip";
import { StickyProfileCta } from "@/components/profile/sticky-profile-cta";
import { SuggestionChip } from "@/components/profile/suggestion-chip";
import { useLanguage } from "@/hooks/use-language";
import { useSession } from "@/hooks/use-session";
import { getYouthProfile, saveYouthProfileDraft } from "@/lib/onboarding";
import type { YouthProfile } from "@/lib/types";

interface YouthProfileForm {
  name: string;
  age: string;
  city: string;
  targetRoles: string[];
  skills: string[];
  interests: string[];
  workingTime: string[];
  experience: string;
}

const initialForm: YouthProfileForm = {
  name: "",
  age: "",
  city: "",
  targetRoles: [],
  skills: [],
  interests: [],
  workingTime: [],
  experience: "",
};

const roleSuggestions = [
  "Cafe",
  "Retail",
  "Childcare",
  "Sports",
  "Events",
  "Warehouse",
  "Delivery",
  "Restaurant",
  "Customer support",
  "Admin helper",
  "Tutor",
  "Social media",
];

const skillSuggestions = [
  "Teamwork",
  "Service",
  "Communication",
  "Reliable",
  "Fast learner",
  "Problem solving",
  "Sales",
  "Cashier",
  "Swedish",
  "English",
  "Canva",
  "Microsoft 365",
];

const interestSuggestions = [
  "Sports",
  "Gaming",
  "Music",
  "Animals",
  "Content creation",
  "Tech",
  "Fitness",
  "Food",
  "Photography",
  "Design",
  "Community",
  "Outdoors",
];

const workingTimeSuggestions = [
  "Weekday afternoons",
  "Weekday evenings",
  "Weekends",
  "Summer break",
  "School holidays",
  "Flexible",
];

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function mapProfileToForm(profile: YouthProfile | null, fallbackName: string): YouthProfileForm {
  if (!profile) {
    return { ...initialForm, name: fallbackName };
  }

  const experienceList = normalizeStringArray(profile.work_experience);

  return {
    name: typeof profile.full_name === "string" && profile.full_name.trim() ? profile.full_name : fallbackName,
    age: typeof profile.age === "number" ? String(profile.age) : "",
    city: typeof profile.city === "string" ? profile.city : "",
    targetRoles: normalizeStringArray(profile.desired_roles),
    skills: normalizeStringArray(profile.strengths).length
      ? normalizeStringArray(profile.strengths)
      : normalizeStringArray(profile.skills),
    interests: normalizeStringArray(profile.merits).length
      ? normalizeStringArray(profile.merits)
      : normalizeStringArray(profile.interests),
    workingTime: normalizeStringArray(profile.employment_preferences).length
      ? normalizeStringArray(profile.employment_preferences)
      : normalizeStringArray(profile.working_time),
    experience:
      typeof profile.experience === "string" && profile.experience.trim()
        ? profile.experience
        : experienceList.join("\n"),
  };
}

function hasContent(value: string) {
  return value.trim().length > 0;
}

export default function ProfilePage() {
  const router = useRouter();
  const { language, toggleLanguage } = useLanguage();
  const { user, profile, loading, logout } = useSession();

  const [form, setForm] = useState<YouthProfileForm>(initialForm);
  const [saving, setSaving] = useState(false);
  const [savedNote, setSavedNote] = useState("");
  const [customRole, setCustomRole] = useState("");
  const [customSkill, setCustomSkill] = useState("");
  const [customInterest, setCustomInterest] = useState("");
  const [showMoreRoles, setShowMoreRoles] = useState(false);
  const [showMoreSkills, setShowMoreSkills] = useState(false);
  const [openSection, setOpenSection] = useState<string>("targetRoles");
  const [loggingOut, setLoggingOut] = useState(false);
  const [generatedCv, setGeneratedCv] = useState("");
  const [generatedApplication, setGeneratedApplication] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/auth");
      return;
    }

    if (!loading && user && profile?.role === "youth") {
      const fallbackName = user.email?.split("@")[0] ?? "";

      void (async () => {
        try {
          const youthProfile = await getYouthProfile(user.id);
          setForm(mapProfileToForm(youthProfile, fallbackName));
          setGeneratedCv(typeof youthProfile?.cv_text === "string" ? youthProfile.cv_text : "");
          setGeneratedApplication(
            typeof youthProfile?.cover_letter_template === "string" ? youthProfile.cover_letter_template : "",
          );
          setError("");
        } catch (loadError) {
          console.error("Failed to load youth profile.", loadError);
          setForm({ ...initialForm, name: fallbackName });
          setGeneratedCv("");
          setGeneratedApplication("");
          setError(loadError instanceof Error ? loadError.message : "Unable to load your profile.");
        }
      })();
    }
  }, [loading, profile?.role, router, user]);

  const t =
    language === "sv"
      ? {
          home: "Startsida",
          loading: "Laddar din profil...",
          title: "Bygg din jobbprofil",
          subtitle: "Kompletta profiler får bättre matchningar. Du kan alltid ändra senare.",
          applyReady: "Du är redo att söka",
          profileInProgress: "Bra start, fortsätt så",
          nonYouthTitle: "Denna profilvy är för ungdomskonton",
          nonYouthSubtitle: "Logga in med ett ungdomskonto för att bygga jobbsökprofil.",
          personalTitle: "Grundinfo",
          personalHelp: "Snabbt och enkelt. Detta syns för bättre matchning.",
          name: "Namn",
          age: "Ålder",
          city: "Stad",
          targetRolesTitle: "Vilka jobb letar du efter?",
          targetRolesHelp: "Välj flera. Tryck för att lägga till.",
          skillsTitle: "Vad är du bra på?",
          skillsHelp: "Färdigheter hjälper oss hitta rätt jobb snabbare.",
          workingTimeTitle: "När kan du jobba?",
          workingTimeHelp: "Markera tider som passar ditt schema.",
          experienceTitle: "Erfarenhet",
          experienceHelp: "Ingen erfarenhet ännu? Lägg till skola, hobby eller volontärarbete.",
          interestsTitle: "Intressen",
          interestsHelp: "Dina intressen förbättrar träffsäkerheten.",
          addRole: "Lägg till roll",
          addSkill: "Lägg till färdighet",
          addInterest: "Lägg till intresse",
          seeMoreRoles: "Se fler roller",
          showFewerRoles: "Visa färre roller",
          seeMoreSkills: "Visa fler skills",
          showFewerSkills: "Visa färre skills",
          selected: "Valda",
          save: "Spara och fortsätt",
          saved: "Profil sparad. Bra jobbat!",
          stickyHint: "Dessa val hjälper oss hitta bättre matchningar.",
          logout: "Logga ut",
          aiTitle: "AI CV-byggare",
          aiText: "Skapa CV och ansökan automatiskt genom en kort chat-intervju.",
          aiCta: "Starta AI-chat",
          cvPreview: "CV-förhandsvisning",
          applicationPreview: "Ansökan-förhandsvisning",
        }
      : {
          home: "Home",
          loading: "Loading your profile...",
          title: "Build your job profile",
          subtitle: "Complete profiles get better matches. You can edit this later.",
          applyReady: "You are ready to apply",
          profileInProgress: "Great start, keep going",
          nonYouthTitle: "This profile view is for youth accounts",
          nonYouthSubtitle: "Sign in with a youth account to build your job profile.",
          personalTitle: "Basics",
          personalHelp: "Quick details that improve your matches.",
          name: "Name",
          age: "Age",
          city: "City",
          targetRolesTitle: "What kind of jobs are you looking for?",
          targetRolesHelp: "Select multiple. Tap to add.",
          skillsTitle: "What are you good at?",
          skillsHelp: "Skills help us find better job matches faster.",
          workingTimeTitle: "When can you work?",
          workingTimeHelp: "Choose times that fit your schedule.",
          experienceTitle: "Experience",
          experienceHelp: "No experience yet? Add school, volunteer, or hobby experience.",
          interestsTitle: "Interests",
          interestsHelp: "These help us find better matches.",
          addRole: "Add role",
          addSkill: "Add skill",
          addInterest: "Add interest",
          seeMoreRoles: "See more roles",
          showFewerRoles: "Show fewer roles",
          seeMoreSkills: "Show more skills",
          showFewerSkills: "Show fewer skills",
          selected: "Selected",
          save: "Save and continue",
          saved: "Profile saved. Nice work!",
          stickyHint: "These choices help us find better matches.",
          logout: "Sign out",
          aiTitle: "AI CV builder",
          aiText: "Generate your CV and application automatically via a short chat interview.",
          aiCta: "Start AI chat",
          cvPreview: "CV preview",
          applicationPreview: "Application preview",
        };

  const completedSections = useMemo(() => {
    return {
      personal: hasContent(form.name) && hasContent(form.age) && hasContent(form.city),
      targetRoles: form.targetRoles.length > 0,
      skills: form.skills.length > 0,
      workingTime: form.workingTime.length > 0,
      experience: hasContent(form.experience),
      interests: form.interests.length > 0,
    };
  }, [form]);

  const completion = useMemo(() => {
    const entries = Object.values(completedSections);
    const completeCount = entries.filter(Boolean).length;
    return Math.round((completeCount / entries.length) * 100);
  }, [completedSections]);

  const statusText = completion >= 70 ? t.applyReady : t.profileInProgress;

  const toggleSelection = (field: "targetRoles" | "skills" | "interests" | "workingTime", value: string) => {
    setForm((prev) => {
      const active = prev[field].includes(value);
      return {
        ...prev,
        [field]: active ? prev[field].filter((item) => item !== value) : [...prev[field], value],
      };
    });
    setSavedNote("");
  };

  const removeSelection = (field: "targetRoles" | "skills" | "interests" | "workingTime", value: string) => {
    setForm((prev) => ({
      ...prev,
      [field]: prev[field].filter((item) => item !== value),
    }));
    setSavedNote("");
  };

  const addCustomValue = (field: "targetRoles" | "skills" | "interests", value: string, clear: () => void) => {
    const trimmed = value.trim();
    if (!trimmed) {
      return;
    }

    setForm((prev) => {
      if (prev[field].some((item) => item.toLowerCase() === trimmed.toLowerCase())) {
        return prev;
      }

      return {
        ...prev,
        [field]: [...prev[field], trimmed],
      };
    });

    clear();
    setSavedNote("");
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updatedProfile = await saveYouthProfileDraft(form);
      setGeneratedCv(typeof updatedProfile.cv_text === "string" ? updatedProfile.cv_text : generatedCv);
      setGeneratedApplication(
        typeof updatedProfile.cover_letter_template === "string"
          ? updatedProfile.cover_letter_template
          : generatedApplication,
      );
      setSavedNote(t.saved);
      setError("");
    } catch (saveError) {
      console.error("Failed to save youth profile.", saveError);
      setError(saveError instanceof Error ? saveError.message : "Unable to save your profile.");
      setSavedNote("");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    await logout();
    router.replace("/auth");
  };

  if (loading || !user) {
    return (
      <main className="mobile-shell flex flex-col justify-center">
        <div className="mb-4 flex items-center justify-between gap-2">
          <Link href="/" className="secondary-btn px-3 py-2 text-xs">
            {t.home}
          </Link>
          <LanguageToggle language={language} onToggle={toggleLanguage} />
        </div>
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
        <div className="glass-card p-5">
          <h1 className="text-xl font-semibold text-[#132742]">{t.nonYouthTitle}</h1>
          <p className="mt-2 text-sm text-[#3f5f82]">{t.nonYouthSubtitle}</p>
        </div>
      </main>
    );
  }

  const roleList = showMoreRoles ? roleSuggestions : roleSuggestions.slice(0, 8);
  const skillList = showMoreSkills ? skillSuggestions : skillSuggestions.slice(0, 8);

  return (
    <main className="mobile-shell pb-40">
      <div className="mb-4 flex items-center justify-between gap-2">
        <Link href="/" className="secondary-btn px-3 py-2 text-xs">
          {t.home}
        </Link>
        <LanguageToggle language={language} onToggle={toggleLanguage} />
      </div>

      <ProfileProgressCard completion={completion} statusText={statusText} title={t.title} subtitle={t.subtitle} />

      <section className="mt-3 glass-card p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#4c6887]">{t.aiTitle}</p>
        <p className="mt-1 text-sm text-[#3f5f82]">{t.aiText}</p>
        <Link href="/cv-builder" className="cta-btn mt-3 inline-block min-h-11 px-4 py-3 text-sm">
          {t.aiCta}
        </Link>
      </section>

      {error && <p className="mt-3 rounded-xl bg-[#ffe7e5] px-3 py-2 text-sm text-[#9e3a2d]">{error}</p>}

      {(generatedCv || generatedApplication) && (
        <section className="mt-3 glass-card space-y-3 p-4">
          {generatedCv && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#4c6887]">{t.cvPreview}</p>
              <pre className="mt-2 max-h-36 overflow-auto rounded-xl bg-[#f7fbff] p-3 text-xs whitespace-pre-wrap text-[#2f4663]">
                {generatedCv}
              </pre>
            </div>
          )}

          {generatedApplication && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#4c6887]">
                {t.applicationPreview}
              </p>
              <pre className="mt-2 max-h-36 overflow-auto rounded-xl bg-[#f7fbff] p-3 text-xs whitespace-pre-wrap text-[#2f4663]">
                {generatedApplication}
              </pre>
            </div>
          )}
        </section>
      )}

      <div className="mt-4 space-y-3">
        <ProfileSectionCard
          id="section-target-roles"
          title={t.targetRolesTitle}
          helperText={t.targetRolesHelp}
          completed={completedSections.targetRoles}
          open={openSection === "targetRoles"}
          onToggle={() => setOpenSection((current) => (current === "targetRoles" ? "" : "targetRoles"))}
        >
          <div className="profile-chip-wrap">
            {roleList.map((role) => (
              <SuggestionChip
                key={role}
                label={role}
                selected={form.targetRoles.includes(role)}
                onClick={() => toggleSelection("targetRoles", role)}
              />
            ))}
          </div>

          <button
            type="button"
            className="mt-3 text-xs font-semibold text-[#23588f]"
            onClick={() => setShowMoreRoles((current) => !current)}
          >
            {showMoreRoles ? t.showFewerRoles : t.seeMoreRoles}
          </button>

          <div className="mt-3 flex gap-2">
            <input
              value={customRole}
              onChange={(event) => setCustomRole(event.target.value)}
              placeholder={t.addRole}
              className="h-11 flex-1 rounded-xl border border-[#cfe2ff] bg-white px-3 text-sm outline-none focus:border-[#1474ff]"
            />
            <button
              type="button"
              className="secondary-btn min-h-11 px-3 text-xs"
              onClick={() => addCustomValue("targetRoles", customRole, () => setCustomRole(""))}
            >
              +
            </button>
          </div>

          {form.targetRoles.length > 0 && (
            <div className="mt-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#4c6887]">{t.selected}</p>
              <div className="profile-chip-wrap">
                {form.targetRoles.map((role) => (
                  <SelectedChip key={role} label={role} onRemove={() => removeSelection("targetRoles", role)} />
                ))}
              </div>
            </div>
          )}
        </ProfileSectionCard>

        <ProfileSectionCard
          id="section-location"
          title={t.personalTitle}
          helperText={t.personalHelp}
          completed={completedSections.personal}
          open={openSection === "personal"}
          onToggle={() => setOpenSection((current) => (current === "personal" ? "" : "personal"))}
        >
          <div className="space-y-2.5">
            <input
              value={form.name}
              onChange={(event) => {
                setForm((prev) => ({ ...prev, name: event.target.value }));
                setSavedNote("");
              }}
              placeholder={t.name}
              className="h-12 w-full rounded-xl border border-[#cfe2ff] bg-white px-3 text-sm outline-none focus:border-[#1474ff]"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                value={form.age}
                onChange={(event) => {
                  setForm((prev) => ({ ...prev, age: event.target.value }));
                  setSavedNote("");
                }}
                inputMode="numeric"
                placeholder={t.age}
                className="h-12 w-full rounded-xl border border-[#cfe2ff] bg-white px-3 text-sm outline-none focus:border-[#1474ff]"
              />
              <input
                value={form.city}
                onChange={(event) => {
                  setForm((prev) => ({ ...prev, city: event.target.value }));
                  setSavedNote("");
                }}
                placeholder={t.city}
                className="h-12 w-full rounded-xl border border-[#cfe2ff] bg-white px-3 text-sm outline-none focus:border-[#1474ff]"
              />
            </div>
          </div>
        </ProfileSectionCard>

        <ProfileSectionCard
          id="section-working-time"
          title={t.workingTimeTitle}
          helperText={t.workingTimeHelp}
          completed={completedSections.workingTime}
          open={openSection === "workingTime"}
          onToggle={() => setOpenSection((current) => (current === "workingTime" ? "" : "workingTime"))}
        >
          <div className="profile-chip-wrap">
            {workingTimeSuggestions.map((slot) => (
              <SuggestionChip
                key={slot}
                label={slot}
                selected={form.workingTime.includes(slot)}
                onClick={() => toggleSelection("workingTime", slot)}
              />
            ))}
          </div>

          {form.workingTime.length > 0 && (
            <div className="mt-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#4c6887]">{t.selected}</p>
              <div className="profile-chip-wrap">
                {form.workingTime.map((slot) => (
                  <SelectedChip key={slot} label={slot} onRemove={() => removeSelection("workingTime", slot)} />
                ))}
              </div>
            </div>
          )}
        </ProfileSectionCard>

        <ProfileSectionCard
          id="section-skills"
          title={t.skillsTitle}
          helperText={t.skillsHelp}
          completed={completedSections.skills}
          open={openSection === "skills"}
          onToggle={() => setOpenSection((current) => (current === "skills" ? "" : "skills"))}
        >
          <div className="profile-chip-wrap">
            {skillList.map((skill) => (
              <SuggestionChip
                key={skill}
                label={skill}
                selected={form.skills.includes(skill)}
                onClick={() => toggleSelection("skills", skill)}
              />
            ))}
          </div>

          <button
            type="button"
            className="mt-3 text-xs font-semibold text-[#23588f]"
            onClick={() => setShowMoreSkills((current) => !current)}
          >
            {showMoreSkills ? t.showFewerSkills : t.seeMoreSkills}
          </button>

          <div className="mt-3 flex gap-2">
            <input
              value={customSkill}
              onChange={(event) => setCustomSkill(event.target.value)}
              placeholder={t.addSkill}
              className="h-11 flex-1 rounded-xl border border-[#cfe2ff] bg-white px-3 text-sm outline-none focus:border-[#1474ff]"
            />
            <button
              type="button"
              className="secondary-btn min-h-11 px-3 text-xs"
              onClick={() => addCustomValue("skills", customSkill, () => setCustomSkill(""))}
            >
              +
            </button>
          </div>

          {form.skills.length > 0 && (
            <div className="mt-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#4c6887]">{t.selected}</p>
              <div className="profile-chip-wrap">
                {form.skills.map((skill) => (
                  <SelectedChip key={skill} label={skill} onRemove={() => removeSelection("skills", skill)} />
                ))}
              </div>
            </div>
          )}
        </ProfileSectionCard>

        <ProfileSectionCard
          id="section-experience"
          title={t.experienceTitle}
          helperText={t.experienceHelp}
          completed={completedSections.experience}
          open={openSection === "experience"}
          onToggle={() => setOpenSection((current) => (current === "experience" ? "" : "experience"))}
        >
          <textarea
            value={form.experience}
            onChange={(event) => {
              setForm((prev) => ({ ...prev, experience: event.target.value }));
              setSavedNote("");
            }}
            rows={4}
            placeholder="School projects, volunteer work, sports team responsibility, hobby projects..."
            className="w-full rounded-xl border border-[#cfe2ff] bg-white px-3 py-3 text-sm outline-none focus:border-[#1474ff]"
          />
        </ProfileSectionCard>

        <ProfileSectionCard
          id="section-interests"
          title={t.interestsTitle}
          helperText={t.interestsHelp}
          completed={completedSections.interests}
          open={openSection === "interests"}
          onToggle={() => setOpenSection((current) => (current === "interests" ? "" : "interests"))}
        >
          <div className="profile-chip-wrap">
            {interestSuggestions.map((interest) => (
              <SuggestionChip
                key={interest}
                label={interest}
                selected={form.interests.includes(interest)}
                onClick={() => toggleSelection("interests", interest)}
              />
            ))}
          </div>

          <div className="mt-3 flex gap-2">
            <input
              value={customInterest}
              onChange={(event) => setCustomInterest(event.target.value)}
              placeholder={t.addInterest}
              className="h-11 flex-1 rounded-xl border border-[#cfe2ff] bg-white px-3 text-sm outline-none focus:border-[#1474ff]"
            />
            <button
              type="button"
              className="secondary-btn min-h-11 px-3 text-xs"
              onClick={() => addCustomValue("interests", customInterest, () => setCustomInterest(""))}
            >
              +
            </button>
          </div>

          {form.interests.length > 0 && (
            <div className="mt-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#4c6887]">{t.selected}</p>
              <div className="profile-chip-wrap">
                {form.interests.map((interest) => (
                  <SelectedChip key={interest} label={interest} onRemove={() => removeSelection("interests", interest)} />
                ))}
              </div>
            </div>
          )}
        </ProfileSectionCard>
      </div>

      {savedNote && <p className="mt-3 rounded-xl bg-[#e8f5ec] px-3 py-2 text-sm text-[#1f6845]">{savedNote}</p>}

      <button
        type="button"
        className="mt-4 w-full rounded-xl border border-[#ffd9d2] bg-white px-4 py-3 text-sm font-semibold text-[#9b3c2f]"
        onClick={() => void handleLogout()}
        disabled={loggingOut}
      >
        {loggingOut ? "..." : t.logout}
      </button>

      <StickyProfileCta
        completion={completion}
        saving={saving}
        onSave={() => void handleSave()}
        primaryLabel={t.save}
        helperLabel={t.stickyHint}
      />
    </main>
  );
}
