"use client";

import {
  FormEvent,
  PointerEvent,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { ApiError, apiRequest } from "@/lib/client-api";
import { useLanguage } from "@/hooks/use-language";
import { useSession } from "@/hooks/use-session";
import { recommendationSet } from "@/lib/recommendations";

type ViewKey = "feed" | "matches" | "cv" | "profile" | "alerts";

interface YouthProfileView {
  name: string;
  age: number | null;
  city: string;
  targetRole: string;
  skills: string[];
  interests: string[];
  experience: string[];
  availability: string;
  premiumBadge: boolean;
  cv: {
    summary: string;
    content: string;
    qualityScore?: number;
    updatedAt: string;
  } | null;
}

interface JobsResponse {
  jobs: Array<{
    id: string;
    title: string;
    description: string;
    location: string;
    jobType: "part-time" | "temporary" | "summer";
    companyName: string;
    decision: "interested" | "skip" | null;
  }>;
}

interface MatchesResponse {
  matches: Array<{
    id: string;
    jobTitle: string;
    companyName: string;
    location: string;
    jobType: string;
  }>;
}

interface NotificationsResponse {
  notifications: Array<{
    id: string;
    message: string;
    createdAt: string;
    read: boolean;
  }>;
  unreadCount: number;
}

const SUGGESTIONS_PER_PAGE = 6;

function splitCsv(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function pageItems(values: string[], page: number): string[] {
  const start = page * SUGGESTIONS_PER_PAGE;
  return values.slice(start, start + SUGGESTIONS_PER_PAGE);
}

function nextSuggestionPage(page: number, total: number): number {
  const maxPage = Math.max(1, Math.ceil(total / SUGGESTIONS_PER_PAGE));
  return page + 1 >= maxPage ? 0 : page + 1;
}

function SectionCard({ children }: { children: ReactNode }) {
  return <div className="glass-card min-h-[120px] w-full p-4">{children}</div>;
}

function SuggestionRow(props: {
  title: string;
  values: string[];
  page: number;
  onMore: () => void;
  onPick: (value: string) => void;
  moreLabel: string;
}) {
  const visible = pageItems(props.values, props.page);
  return (
    <div className="rounded-xl bg-[#f4f9ff] p-2">
      <div className="mb-1 flex items-center justify-between">
        <p className="text-xs text-[#5d7a98]">{props.title}</p>
        <button
          type="button"
          className="text-xs font-semibold text-[#2c6098]"
          onClick={props.onMore}
        >
          {props.moreLabel}
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {visible.map((value) => (
          <button
            key={value}
            type="button"
            className="rounded-full border border-[#cfe2ff] bg-white px-2.5 py-1 text-xs text-[#315b86]"
            onClick={() => props.onPick(value)}
          >
            {value}
          </button>
        ))}
      </div>
    </div>
  );
}

function MultiAddField(props: {
  title: string;
  values: string[];
  onChange: (values: string[]) => void;
  suggestions: string[];
  page: number;
  onMore: () => void;
  placeholder: string;
  addLabel: string;
  suggestionsLabel: string;
  helperText: string;
  moreLabel: string;
}) {
  const [draft, setDraft] = useState("");

  const addItem = useCallback(
    (raw: string) => {
      const value = raw.trim();
      if (!value) return;
      props.onChange(unique([...props.values, value]));
      setDraft("");
    },
    [props],
  );

  const removeItem = useCallback(
    (value: string) => {
      props.onChange(props.values.filter((entry) => entry !== value));
    },
    [props],
  );

  return (
    <div className="space-y-2 rounded-xl border border-[#d7e7ff] bg-white p-3">
      <p className="text-sm font-medium text-[#23486f]">{props.title}</p>
      <div className="flex gap-2">
        <input
          className="w-full rounded-xl border border-[#cfe2ff] px-3 py-2 text-sm outline-none"
          placeholder={props.placeholder}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              addItem(draft);
            }
          }}
        />
        <button
          type="button"
          className="secondary-btn px-3 py-2 text-xs"
          onClick={() => addItem(draft)}
        >
          {props.addLabel}
        </button>
      </div>

      {props.values.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {props.values.map((value) => (
            <button
              key={value}
              type="button"
              className="rounded-full border border-[#cfe2ff] bg-[#f6faff] px-2.5 py-1 text-xs text-[#335b84]"
              onClick={() => removeItem(value)}
            >
              {value} x
            </button>
          ))}
        </div>
      )}

      <SuggestionRow
        title={props.suggestionsLabel}
        values={props.suggestions}
        page={props.page}
        onMore={props.onMore}
        onPick={addItem}
        moreLabel={props.moreLabel}
      />
      <p className="text-xs text-[#6683a2]">{props.helperText}</p>
    </div>
  );
}

export default function YouthPage() {
  const { user, loading, logout } = useSession("youth");
  const { language } = useLanguage();
  const [view, setView] = useState<ViewKey>("feed");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [profile, setProfile] = useState<YouthProfileView | null>(null);
  const [profileStrength, setProfileStrength] = useState(0);
  const [jobs, setJobs] = useState<JobsResponse["jobs"]>([]);
  const [matches, setMatches] = useState<MatchesResponse["matches"]>([]);
  const [notifications, setNotifications] = useState<NotificationsResponse["notifications"]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [saving, setSaving] = useState(false);

  const [dragStartX, setDragStartX] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState<null | "left" | "right">(null);

  const [cvPrompt, setCvPrompt] = useState("");
  const [cvTargetRole, setCvTargetRole] = useState("");
  const [cvLanguage, setCvLanguage] = useState<"en" | "sv">("en");
  const [cvTone, setCvTone] = useState<"professional" | "friendly" | "confident">(
    "professional",
  );
  const [cvTargetJobType, setCvTargetJobType] = useState<
    "any" | "part-time" | "temporary" | "summer"
  >("any");

  const [cityPage, setCityPage] = useState(0);
  const [rolePage, setRolePage] = useState(0);
  const [skillPage, setSkillPage] = useState(0);
  const [interestPage, setInterestPage] = useState(0);
  const [availabilityPage, setAvailabilityPage] = useState(0);
  const [experiencePage, setExperiencePage] = useState(0);

  const feedJobs = useMemo(() => jobs.filter((job) => !job.decision), [jobs]);
  const currentJob = feedJobs[0];
  const t =
    language === "sv"
      ? {
          more: "Fler",
          add: "Lägg till",
          suggestions: "Förslag",
          helperText: "Lägg till en i taget och fortsätt sedan.",
          confirmLogout: "Är du säker på att du vill logga ut?",
          loading: "Laddar...",
          interested: "Intresserad",
          skip: "Hoppa över",
          left: "kvar",
          noJobs: "Inga jobb kvar i ditt flöde just nu.",
          refreshFeed: "Uppdatera flöde",
          noMatches: "Inga matchningar ännu.",
          match: "Matchning",
          english: "Engelska",
          swedish: "Svenska",
          professional: "Professionell",
          friendly: "Vänlig",
          confident: "Självsäker",
          targetRole: "Målroll",
          anyType: "Alla typer",
          partTime: "Deltid",
          temporary: "Tillfälligt",
          summer: "Sommar",
          cvPrompt: "Extra detaljer för AI-CV (valfritt)",
          generateCv: "Generera CV",
          quality: "Kvalitet",
          saveCv: "Spara CV",
          profile: "Profil",
          sweden: "Sverige",
          profileStrength: "Profilstyrka",
          name: "Namn",
          age: "Ålder",
          city: "Stad",
          citySuggestions: "Stadsförslag",
          targetRoles: "Målroller",
          skills: "Kompetenser",
          interests: "Intressen",
          workingTime: "Arbetstid",
          experience: "Erfarenhet",
          addOneRole: "Lägg till en roll",
          addOneSkill: "Lägg till en kompetens",
          addOneInterest: "Lägg till ett intresse",
          addOneAvailability: "Lägg till en tidsönskan",
          addOneExperience: "Lägg till en erfarenhet",
          saveProfile: "Spara profil",
          saving: "Sparar...",
          logout: "Logga ut",
          markAllRead: "Markera alla som lästa",
          noNotifications: "Inga notiser.",
          feed: "Flöde",
          matches: "Matchningar",
          alerts: "Notiser",
        }
      : {
          more: "More",
          add: "Add",
          suggestions: "Suggestions",
          helperText: "Add one item at a time, then continue.",
          confirmLogout: "Are you sure you want to log out?",
          loading: "Loading...",
          interested: "Interested",
          skip: "Skip",
          left: "left",
          noJobs: "No jobs left in your feed right now.",
          refreshFeed: "Refresh feed",
          noMatches: "No matches yet.",
          match: "Match",
          english: "English",
          swedish: "Swedish",
          professional: "Professional",
          friendly: "Friendly",
          confident: "Confident",
          targetRole: "Target role",
          anyType: "Any type",
          partTime: "Part-time",
          temporary: "Temporary",
          summer: "Summer",
          cvPrompt: "Extra details for AI CV (optional)",
          generateCv: "Generate CV",
          quality: "Quality",
          saveCv: "Save CV",
          profile: "Profile",
          sweden: "Sweden",
          profileStrength: "Profile strength",
          name: "Name",
          age: "Age",
          city: "City",
          citySuggestions: "City suggestions",
          targetRoles: "Target roles",
          skills: "Skills",
          interests: "Interests",
          workingTime: "Working time",
          experience: "Experience",
          addOneRole: "Add one role",
          addOneSkill: "Add one skill",
          addOneInterest: "Add one interest",
          addOneAvailability: "Add one time preference",
          addOneExperience: "Add one experience",
          saveProfile: "Save profile",
          saving: "Saving...",
          logout: "Log out",
          markAllRead: "Mark all as read",
          noNotifications: "No notifications.",
          feed: "Feed",
          matches: "Matches",
          alerts: "Alerts",
        };
        const suggestionSet = recommendationSet(language);
        const cityRecommendations = suggestionSet.cities;
        const roleRecommendations = suggestionSet.roles;
        const skillRecommendations = suggestionSet.skills;
        const interestRecommendations = suggestionSet.interests;
        const availabilityRecommendations = suggestionSet.availability;
        const experienceRecommendations = suggestionSet.experience;

  const formatJobType = (jobType: string) => {
    if (jobType === "part-time") return t.partTime;
    if (jobType === "temporary") return t.temporary;
    if (jobType === "summer") return t.summer;
    return jobType;
  };
  const roleValues = useMemo(() => splitCsv(profile?.targetRole || ""), [profile?.targetRole]);
  const availabilityValues = useMemo(
    () => splitCsv(profile?.availability || ""),
    [profile?.availability],
  );

  const load = useCallback(async () => {
    if (!user) return;
    setBusy(true);
    setError("");
    try {
      const [profileResponse, jobsResponse, matchesResponse, notificationsResponse] =
        await Promise.all([
          apiRequest<{ profile: YouthProfileView; profileStrength: number }>(
            "/api/youth/profile",
            { userId: user.id },
          ),
          apiRequest<JobsResponse>("/api/jobs", { userId: user.id }),
          apiRequest<MatchesResponse>("/api/matches", { userId: user.id }),
          apiRequest<NotificationsResponse>("/api/notifications", { userId: user.id }),
        ]);

      setProfile(profileResponse.profile);
      setProfileStrength(profileResponse.profileStrength);
      setJobs(jobsResponse.jobs);
      setMatches(matchesResponse.matches);
      setNotifications(notificationsResponse.notifications);
      setUnreadCount(notificationsResponse.unreadCount);
      setCvTargetRole(profileResponse.profile.targetRole || "");
    } catch (loadError) {
      if (loadError instanceof ApiError && loadError.status === 401) {
        return;
      }
      setError(loadError instanceof Error ? loadError.message : "Kunde inte ladda dashboarden.");
    } finally {
      setBusy(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      void load();
    }
  }, [load, user]);

  const saveProfile = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!user || !profile) return;
      setSaving(true);
      setError("");
      try {
        await apiRequest("/api/youth/profile", {
          method: "PUT",
          userId: user.id,
          body: JSON.stringify(profile),
        });
        await load();
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : "Kunde inte spara profilen.");
      } finally {
        setSaving(false);
      }
    },
    [load, profile, user],
  );

  const generateCv = useCallback(async () => {
    if (!user) return;
    setSaving(true);
    setError("");
    try {
      await apiRequest("/api/youth/cv", {
        method: "POST",
        userId: user.id,
        body: JSON.stringify({
          prompt: cvPrompt,
          targetRole: cvTargetRole || profile?.targetRole || "",
          targetJobType: cvTargetJobType,
          language: cvLanguage,
          tone: cvTone,
        }),
      });
      setCvPrompt("");
      await load();
    } catch (cvError) {
      setError(cvError instanceof Error ? cvError.message : "Kunde inte generera CV.");
    } finally {
      setSaving(false);
    }
  }, [cvLanguage, cvPrompt, cvTargetJobType, cvTargetRole, cvTone, load, profile?.targetRole, user]);

  const saveCv = useCallback(async () => {
    if (!user || !profile?.cv) return;
    setSaving(true);
    setError("");
    try {
      await apiRequest("/api/youth/profile", {
        method: "PUT",
        userId: user.id,
        body: JSON.stringify({ cv: profile.cv }),
      });
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Kunde inte spara CV.");
    } finally {
      setSaving(false);
    }
  }, [load, profile?.cv, user]);

  const markAllRead = useCallback(async () => {
    if (!user) return;
    await apiRequest("/api/notifications", {
      method: "PATCH",
      userId: user.id,
      body: JSON.stringify({ markAllRead: true }),
    });
    await load();
  }, [load, user]);

  const handleLogout = useCallback(() => {
    if (!window.confirm(t.confirmLogout)) {
      return;
    }
    logout();
  }, [logout, t.confirmLogout]);

  const saveJobAction = useCallback(
    async (jobId: string, action: "interested" | "skip") => {
      if (!user) return;
      setJobs((current) =>
        current.map((job) => (job.id === jobId ? { ...job, decision: action } : job)),
      );
      try {
        await apiRequest(`/api/jobs/${jobId}/action`, {
          method: "POST",
          userId: user.id,
          body: JSON.stringify({ action }),
        });
      } catch (actionError) {
        setJobs((current) =>
          current.map((job) => (job.id === jobId ? { ...job, decision: null } : job)),
        );
        setError(actionError instanceof Error ? actionError.message : "Kunde inte spara åtgärden.");
      }
      await load();
    },
    [load, user],
  );

  const commitSwipe = useCallback(
    (direction: "left" | "right") => {
      if (!currentJob) return;
      setSwipeDirection(direction);
      setTimeout(() => {
        setDragX(0);
        setSwipeDirection(null);
        void saveJobAction(currentJob.id, direction === "right" ? "interested" : "skip");
      }, 130);
    },
    [currentJob, saveJobAction],
  );

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!currentJob) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
    setDragStartX(event.clientX);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragging || !currentJob) return;
    event.preventDefault();
    const delta = event.clientX - dragStartX;
    setDragX(delta);
  };

  const onPointerUp = () => {
    if (!currentJob) return;
    setDragging(false);
    if (dragX > 110) {
      commitSwipe("right");
      return;
    }
    if (dragX < -110) {
      commitSwipe("left");
      return;
    }
    setDragX(0);
  };

  if (loading || !user || (busy && !profile)) {
    return <div className="mobile-shell py-10 text-sm text-[#3e648d]">{t.loading}</div>;
  }

  const likedOpacity = Math.max(0, Math.min(1, dragX / 120));
  const skippedOpacity = Math.max(0, Math.min(1, -dragX / 120));
  const cardTransform =
    swipeDirection === "right"
      ? "translateX(180px) rotate(14deg)"
      : swipeDirection === "left"
        ? "translateX(-180px) rotate(-14deg)"
        : `translateX(${dragX}px) rotate(${dragX * 0.06}deg)`;

  return (
    <div className="relative mx-auto min-h-screen max-w-[430px] bg-gradient-to-b from-[#eaf5ff] via-[#f4f9ff] to-[#dbeeff] pb-24">
      <main className={`${view === "feed" ? "px-3 pt-3" : "space-y-3 px-4 pt-4"} min-h-[calc(100vh-92px)]`}>
        {error && (
          <p className="rounded-xl bg-[#ffe8e6] px-3 py-2 text-sm text-[#983a2d]">{error}</p>
        )}

        {view === "feed" && (
          <section className="h-[calc(100vh-106px)] select-none">
            {currentJob ? (
              <div className="relative h-full w-full">
                <div
                  className="pointer-events-none absolute left-4 top-4 z-20 rounded-xl border-2 border-[#2ca98d] bg-white px-3 py-1 text-lg font-semibold text-[#2ca98d]"
                  style={{ opacity: likedOpacity }}
                >
                  {t.interested.toUpperCase()}
                </div>
                <div
                  className="pointer-events-none absolute right-4 top-4 z-20 rounded-xl border-2 border-[#ff6f5e] bg-white px-3 py-1 text-lg font-semibold text-[#ff6f5e]"
                  style={{ opacity: skippedOpacity }}
                >
                  {t.skip.toUpperCase()}
                </div>

                <article
                  className="absolute inset-x-0 top-0 flex h-[82%] touch-none flex-col rounded-[32px] border border-[#b8d8ff] bg-gradient-to-br from-white via-[#f6faff] to-[#ebf4ff] p-5 shadow-[0_30px_60px_-28px_rgba(20,70,130,0.5)] transition-transform duration-150 select-none"
                  style={{ transform: cardTransform, userSelect: "none", WebkitUserSelect: "none" }}
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerUp}
                  onDragStart={(event) => event.preventDefault()}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <span className="rounded-full bg-[#e2f0ff] px-3 py-1 text-xs font-semibold text-[#24527f]">
                      {formatJobType(currentJob.jobType)}
                    </span>
                    <span className="text-xs text-[#4e6f92]">{feedJobs.length} {t.left}</span>
                  </div>
                  <h2 className="text-3xl font-semibold text-[#123359]">{currentJob.title}</h2>
                  <p className="mt-2 text-sm text-[#365f88]">{currentJob.companyName}</p>
                  <p className="text-sm text-[#365f88]">{currentJob.location}</p>
                  <p className="mt-5 rounded-2xl bg-white/80 p-4 text-sm leading-relaxed text-[#2c4f74]">
                    {currentJob.description}
                  </p>
                </article>

                <div className="absolute bottom-0 grid w-full grid-cols-2 gap-3">
                  <button
                    className="rounded-2xl border border-[#ffd3cd] bg-[#fff2f0] px-4 py-3 text-sm font-semibold text-[#c45243]"
                    onClick={() => commitSwipe("left")}
                    type="button"
                  >
                    {t.skip}
                  </button>
                  <button
                    className="rounded-2xl bg-gradient-to-r from-[#0f8a79] to-[#25b4a2] px-4 py-3 text-sm font-semibold text-white"
                    onClick={() => commitSwipe("right")}
                    type="button"
                  >
                    {t.interested}
                  </button>
                </div>
              </div>
            ) : (
              <SectionCard>
                <p className="text-sm text-[#375f89]">{t.noJobs}</p>
                <button
                  className="cta-btn mt-3 w-full px-4 py-3 text-sm"
                  onClick={() => void load()}
                  type="button"
                >
                  {t.refreshFeed}
                </button>
              </SectionCard>
            )}
          </section>
        )}

        {view === "matches" && (
          <section className="space-y-3">
            {matches.length === 0 && <SectionCard>{t.noMatches}</SectionCard>}
            {matches.map((match) => (
              <SectionCard key={match.id}>
                <p className="text-xs uppercase tracking-[0.12em] text-[#55739a]">{t.match}</p>
                <h2 className="mt-1 text-lg font-semibold text-[#123358]">{match.jobTitle}</h2>
                <p className="text-sm text-[#3d6288]">{match.companyName}</p>
                <p className="text-sm text-[#3d6288]">
                  {match.location} - {formatJobType(match.jobType)}
                </p>
              </SectionCard>
            ))}
          </section>
        )}

        {view === "cv" && (
          <section className="space-y-3">
            <SectionCard>
              <div className="grid grid-cols-2 gap-2">
                <select
                  className="rounded-xl border border-[#cfe2ff] px-3 py-2 text-sm outline-none"
                  value={cvLanguage}
                  onChange={(event) => setCvLanguage(event.target.value as "en" | "sv")}
                >
                  <option value="en">{t.english}</option>
                  <option value="sv">{t.swedish}</option>
                </select>
                <select
                  className="rounded-xl border border-[#cfe2ff] px-3 py-2 text-sm outline-none"
                  value={cvTone}
                  onChange={(event) =>
                    setCvTone(event.target.value as "professional" | "friendly" | "confident")
                  }
                >
                  <option value="professional">{t.professional}</option>
                  <option value="friendly">{t.friendly}</option>
                  <option value="confident">{t.confident}</option>
                </select>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <input
                  className="rounded-xl border border-[#cfe2ff] px-3 py-2 text-sm outline-none"
                  placeholder={t.targetRole}
                  value={cvTargetRole}
                  onChange={(event) => setCvTargetRole(event.target.value)}
                />
                <select
                  className="rounded-xl border border-[#cfe2ff] px-3 py-2 text-sm outline-none"
                  value={cvTargetJobType}
                  onChange={(event) =>
                    setCvTargetJobType(
                      event.target.value as "any" | "part-time" | "temporary" | "summer",
                    )
                  }
                >
                  <option value="any">{t.anyType}</option>
                  <option value="part-time">{t.partTime}</option>
                  <option value="temporary">{t.temporary}</option>
                  <option value="summer">{t.summer}</option>
                </select>
              </div>
              <textarea
                className="mt-3 min-h-24 w-full rounded-xl border border-[#cfe2ff] p-3 text-sm outline-none"
                placeholder={t.cvPrompt}
                value={cvPrompt}
                onChange={(event) => setCvPrompt(event.target.value)}
              />
              <button
                className="cta-btn mt-3 w-full px-4 py-3 text-sm"
                onClick={() => void generateCv()}
                type="button"
                disabled={saving}
              >
                {t.generateCv}
              </button>
            </SectionCard>

            {profile?.cv && (
              <SectionCard>
                <p className="text-sm text-[#284f77]">
                  {t.quality}: <strong>{profile.cv.qualityScore || 0}/100</strong>
                </p>
                <textarea
                  className="mt-2 min-h-24 w-full rounded-xl border border-[#cfe2ff] p-3 text-sm outline-none"
                  value={profile.cv.summary}
                  onChange={(event) =>
                    setProfile((current) =>
                      current && current.cv
                        ? { ...current, cv: { ...current.cv, summary: event.target.value } }
                        : current,
                    )
                  }
                />
                <textarea
                  className="mt-2 min-h-52 w-full rounded-xl border border-[#cfe2ff] p-3 text-xs outline-none"
                  value={profile.cv.content}
                  onChange={(event) =>
                    setProfile((current) =>
                      current && current.cv
                        ? { ...current, cv: { ...current.cv, content: event.target.value } }
                        : current,
                    )
                  }
                />
                <button
                  className="cta-btn mt-3 w-full px-4 py-3 text-sm"
                  onClick={() => void saveCv()}
                  type="button"
                  disabled={saving}
                >
                  {t.saveCv}
                </button>
              </SectionCard>
            )}
          </section>
        )}

        {view === "profile" && profile && (
          <section className="space-y-3">
            <SectionCard>
              <p className="text-xs uppercase tracking-[0.15em] text-[#547298]">{t.profile}</p>
              <h1 className="mt-1 text-2xl font-semibold text-[#123257]">
                {profile.name || t.profile}
              </h1>
              <p className="text-sm text-[#3e6289]">{profile.city || t.sweden}</p>
              <p className="mt-2 text-sm text-[#365b82]">
                {t.profileStrength}: <strong>{profileStrength}%</strong>
              </p>
            </SectionCard>

            <form className="glass-card w-full space-y-3 p-4" onSubmit={saveProfile}>
              <input
                className="w-full rounded-xl border border-[#cfe2ff] px-3 py-2 text-sm outline-none"
                value={profile.name}
                placeholder={t.name}
                onChange={(event) =>
                  setProfile((current) =>
                    current ? { ...current, name: event.target.value } : current,
                  )
                }
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  min={12}
                  max={20}
                  className="w-full rounded-xl border border-[#cfe2ff] px-3 py-2 text-sm outline-none"
                  value={profile.age ?? ""}
                  placeholder={t.age}
                  onChange={(event) =>
                    setProfile((current) =>
                      current
                        ? {
                            ...current,
                            age: Number(event.target.value) > 0 ? Number(event.target.value) : null,
                          }
                        : current,
                    )
                  }
                />
                <input
                  className="w-full rounded-xl border border-[#cfe2ff] px-3 py-2 text-sm outline-none"
                  value={profile.city}
                  placeholder={t.city}
                  onChange={(event) =>
                    setProfile((current) =>
                      current ? { ...current, city: event.target.value } : current,
                    )
                  }
                />
              </div>
              <SuggestionRow
                title={t.citySuggestions}
                values={cityRecommendations}
                page={cityPage}
                onMore={() =>
                  setCityPage((page) => nextSuggestionPage(page, cityRecommendations.length))
                }
                onPick={(value) =>
                  setProfile((current) => (current ? { ...current, city: value } : current))
                }
                moreLabel={t.more}
              />

              <MultiAddField
                title={t.targetRoles}
                values={roleValues}
                onChange={(values) =>
                  setProfile((current) =>
                    current ? { ...current, targetRole: values.join(", ") } : current,
                  )
                }
                suggestions={roleRecommendations}
                page={rolePage}
                onMore={() =>
                  setRolePage((page) => nextSuggestionPage(page, roleRecommendations.length))
                }
                placeholder={t.addOneRole}
                addLabel={t.add}
                suggestionsLabel={t.suggestions}
                helperText={t.helperText}
                moreLabel={t.more}
              />

              <MultiAddField
                title={t.skills}
                values={profile.skills}
                onChange={(values) =>
                  setProfile((current) => (current ? { ...current, skills: values } : current))
                }
                suggestions={skillRecommendations}
                page={skillPage}
                onMore={() =>
                  setSkillPage((page) => nextSuggestionPage(page, skillRecommendations.length))
                }
                placeholder={t.addOneSkill}
                addLabel={t.add}
                suggestionsLabel={t.suggestions}
                helperText={t.helperText}
                moreLabel={t.more}
              />

              <MultiAddField
                title={t.interests}
                values={profile.interests}
                onChange={(values) =>
                  setProfile((current) => (current ? { ...current, interests: values } : current))
                }
                suggestions={interestRecommendations}
                page={interestPage}
                onMore={() =>
                  setInterestPage((page) =>
                    nextSuggestionPage(page, interestRecommendations.length),
                  )
                }
                placeholder={t.addOneInterest}
                addLabel={t.add}
                suggestionsLabel={t.suggestions}
                helperText={t.helperText}
                moreLabel={t.more}
              />

              <MultiAddField
                title={t.workingTime}
                values={availabilityValues}
                onChange={(values) =>
                  setProfile((current) =>
                    current ? { ...current, availability: values.join(", ") } : current,
                  )
                }
                suggestions={availabilityRecommendations}
                page={availabilityPage}
                onMore={() =>
                  setAvailabilityPage((page) =>
                    nextSuggestionPage(page, availabilityRecommendations.length),
                  )
                }
                placeholder={t.addOneAvailability}
                addLabel={t.add}
                suggestionsLabel={t.suggestions}
                helperText={t.helperText}
                moreLabel={t.more}
              />

              <MultiAddField
                title={t.experience}
                values={profile.experience}
                onChange={(values) =>
                  setProfile((current) => (current ? { ...current, experience: values } : current))
                }
                suggestions={experienceRecommendations}
                page={experiencePage}
                onMore={() =>
                  setExperiencePage((page) =>
                    nextSuggestionPage(page, experienceRecommendations.length),
                  )
                }
                placeholder={t.addOneExperience}
                addLabel={t.add}
                suggestionsLabel={t.suggestions}
                helperText={t.helperText}
                moreLabel={t.more}
              />

              <button className="cta-btn w-full px-4 py-3 text-sm" disabled={saving}>
                {saving ? t.saving : t.saveProfile}
              </button>

              <button
                className="w-full rounded-xl border border-[#ffcfcf] bg-[#ffe8e8] px-4 py-3 text-sm font-semibold text-[#b42323]"
                onClick={handleLogout}
                type="button"
              >
                {t.logout}
              </button>
            </form>
          </section>
        )}

        {view === "alerts" && (
          <section className="space-y-3">
            <SectionCard>
              <button
                className="secondary-btn w-full px-4 py-3 text-sm"
                onClick={() => void markAllRead()}
                type="button"
              >
                {t.markAllRead}
              </button>
            </SectionCard>
            {notifications.length === 0 && <SectionCard>{t.noNotifications}</SectionCard>}
            {notifications.map((notification) => (
              <SectionCard key={notification.id}>
                <p className="text-sm text-[#2f5074]">{notification.message}</p>
                <p className="mt-1 text-xs text-[#5b7694]">
                  {new Date(notification.createdAt).toLocaleString(
                    language === "sv" ? "sv-SE" : "en-US",
                  )}
                </p>
              </SectionCard>
            ))}
          </section>
        )}
      </main>

      <footer className="fixed bottom-0 left-1/2 z-50 w-full max-w-[430px] -translate-x-1/2 border-t border-[#cfe2ff] bg-white/95 px-3 py-2 backdrop-blur">
        <div className="grid grid-cols-5 gap-2">
          {[
            { key: "feed", label: t.feed },
            { key: "matches", label: t.matches },
            { key: "cv", label: "CV" },
            { key: "profile", label: t.profile },
            { key: "alerts", label: `${t.alerts}${unreadCount ? ` (${unreadCount})` : ""}` },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setView(item.key as ViewKey)}
              className={`rounded-xl px-2 py-2 text-xs font-semibold ${
                view === item.key
                  ? "bg-[#1474ff] text-white"
                  : "border border-[#d4e6ff] bg-[#f9fcff] text-[#3d638a]"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </footer>
    </div>
  );
}
