"use client";

import { FormEvent, PointerEvent, useCallback, useEffect, useMemo, useState } from "react";
import { ApiError, apiRequest } from "@/lib/client-api";
import { useLanguage } from "@/hooks/use-language";
import { useSession } from "@/hooks/use-session";

type ViewKey = "feed" | "matches" | "cv" | "profile" | "alerts";

interface YouthProfileView {
  name: string;
  age: number | null;
  city: string;
  contactEmail: string;
  contactPhone: string;
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

interface MatchItem {
  id: string;
  jobTitle: string;
  companyName: string;
  location: string;
  jobType: string;
  youthId: string;
  companyId: string;
  companyUserEmail: string;
  candidateName?: string;
  candidateUserEmail?: string;
}

interface MatchesResponse {
  matches: MatchItem[];
}

interface MatchMessage {
  id: string;
  matchId: string;
  senderId: string;
  message: string;
  createdAt: string;
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

function splitCsv(value: string): string[] {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function toCsv(values: string): string[] {
  return splitCsv(values);
}

function fromCsv(values: string[]): string {
  return values.join(", ");
}

function toSwedishJobText(value: string): string {
  return value
    .replace("Summer Store Assistant", "Sommarjobb i butik")
    .replace("Weekend Cashier Helper", "Kassahjälp på helger")
    .replace("Junior Barista", "Junior barista")
    .replace("Cafe Summer Staff", "Sommarpersonal på café")
    .replace("Festival Crew Assistant", "Festivalmedarbetare")
    .replace("Event Setup Helper", "Eventhjälp vid uppsättning")
    .replace("Package Sorting Assistant", "Paketsorterare")
    .replace("Summer Warehouse Helper", "Sommarhjälp på lager")
    .replace("After-School Activity Helper", "Hjälp i fritidsaktiviteter")
    .replace("Weekend Babysitting Support", "Barnpassningshjälp på helger")
    .replace("Coding Workshop Helper", "Hjälp i kodworkshop")
    .replace("Content Assistant (Tech)", "Innehållsassistent (tech)")
    .replace("Help customers, restock shelves, and support checkout flow.", "Hjälp kunder, fyll på varor och stötta kassan.")
    .replace("Support senior cashier and greet customers during peak hours.", "Stötta huvudkassan och välkomna kunder under rusningstid.")
    .replace("Prepare drinks, handle counter orders, and keep cafe area clean.", "Förbered drycker, ta beställningar och håll caféytan ren.")
    .replace("Support kitchen prep, customer service, and table service.", "Hjälp till med köksförberedelser, kundservice och servering.")
    .replace("Help with visitor guidance, wristband checks, and queue flow.", "Hjälp till med besökarservice, armband och köflöde.")
    .replace("Assist in setup and teardown for youth sports events.", "Hjälp till vid upp- och nedmontering på ungdomsevenemang.")
    .replace("Sort and label parcels with team leads in evening shifts.", "Sortera och märk paket tillsammans med teamet på kvällspass.")
    .replace("Support inbound and outbound package handling.", "Hjälp till med inkommande och utgående paket.")
    .replace("Support group activities and check-in for younger students.", "Stötta gruppaktiviteter och incheckning för yngre elever.")
    .replace("Assist families with playful, safe childcare sessions.", "Hjälp familjer med trygg och lekfull barnpassning.")
    .replace("Help younger students during beginner coding sessions.", "Stötta yngre elever under nybörjarkurser i kodning.")
    .replace("Create short social posts and event photos for workshop days.", "Skapa sociala inlägg och eventfoton under workshopdagar.");
}

export default function YouthPage() {
  const { user, loading, logout } = useSession("youth");
  const { language } = useLanguage();

  const [view, setView] = useState<ViewKey>("feed");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

  const [profile, setProfile] = useState<YouthProfileView | null>(null);
  const [jobs, setJobs] = useState<JobsResponse["jobs"]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState<string>("");
  const [messagesByMatch, setMessagesByMatch] = useState<Record<string, MatchMessage[]>>({});
  const [chatDraft, setChatDraft] = useState("");
  const [notifications, setNotifications] = useState<NotificationsResponse["notifications"]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [authFailed, setAuthFailed] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState<null | "left" | "right">(null);

  const [cvPrompt, setCvPrompt] = useState("");
  const [cvTargetRole, setCvTargetRole] = useState("");
  const [cvLanguage, setCvLanguage] = useState<"en" | "sv">("sv");
  const [cvTone, setCvTone] = useState<"professional" | "friendly" | "confident">("friendly");

  const t =
    language === "sv"
      ? {
          loading: "Laddar...",
          noJobs: "Inga jobb finns i ditt flöde just nu.",
          searchPlaceholder: "Sök jobb (t.ex. Café barista)",
          search: "Sök",
          clear: "Rensa",
          recommendations: "Rekommenderade jobb (från publicerade annonser)",
          noSearchResults:
            "Inga jobb av den typen är tillgängliga just nu. De visas när de kommer in.",
          interested: "Intresserad",
          skip: "Hoppa över",
          noMatches: "Inga matchningar ännu.",
          chatWith: "Chat med",
          writeMessage: "Skriv meddelande...",
          send: "Skicka",
          markAllRead: "Markera alla som lästa",
          noNotifications: "Inga notiser.",
          save: "Spara",
          saving: "Sparar...",
          profile: "Profil",
          feed: "Jobb",
          matches: "Matchningar",
          alerts: "Notiser",
          targetRole: "Målroll",
          cvPrompt: "Extra detaljer till CV (valfritt)",
          generateCv: "Generera CV",
          quality: "Kvalitet",
          saveCv: "Spara CV",
          english: "Engelska",
          swedish: "Svenska",
          professional: "Professionell",
          friendly: "Vänlig",
          confident: "Självsäker",
          name: "Namn",
          age: "Ålder",
          city: "Stad",
          contactEmail: "Kontakt e-post",
          contactPhone: "Kontakt telefon",
          skills: "Färdigheter (kommaseparerat)",
          interests: "Intressen (kommaseparerat)",
          experience: "Erfarenhet (kommaseparerat)",
          availability: "När kan du jobba",
          logout: "Logga ut",
        }
      : {
          loading: "Loading...",
          noJobs: "No jobs in your feed right now.",
          searchPlaceholder: "Search jobs (e.g. Cafe barista)",
          search: "Search",
          clear: "Clear",
          recommendations: "Recommended jobs (from posted listings)",
          noSearchResults:
            "No jobs like that are available right now. They will appear when posted.",
          interested: "Interested",
          skip: "Skip",
          noMatches: "No matches yet.",
          chatWith: "Chat with",
          writeMessage: "Write a message...",
          send: "Send",
          markAllRead: "Mark all as read",
          noNotifications: "No notifications.",
          save: "Save",
          saving: "Saving...",
          profile: "Profile",
          feed: "Jobs",
          matches: "Matches",
          alerts: "Alerts",
          targetRole: "Target role",
          cvPrompt: "Extra details for CV (optional)",
          generateCv: "Generate CV",
          quality: "Quality",
          saveCv: "Save CV",
          english: "English",
          swedish: "Swedish",
          professional: "Professional",
          friendly: "Friendly",
          confident: "Confident",
          name: "Name",
          age: "Age",
          city: "City",
          contactEmail: "Contact email",
          contactPhone: "Contact phone",
          skills: "Skills (comma separated)",
          interests: "Interests (comma separated)",
          experience: "Experience (comma separated)",
          availability: "Availability",
          logout: "Log out",
        };

  const feedJobs = useMemo(() => jobs.filter((job) => !job.decision), [jobs]);
  const currentJob = feedJobs[0];

  const load = useCallback(
    async (query?: string) => {
      if (!user || authFailed) return;
      setBusy(true);
      setError("");
      try {
        const encodedQuery = encodeURIComponent(query ?? searchQuery);
        const [profileResponse, jobsResponse, notificationsResponse] =
          await Promise.all([
            apiRequest<{ profile: YouthProfileView }>("/api/youth/profile", { userId: user.id }),
            apiRequest<JobsResponse>(`/api/jobs${encodedQuery ? `?q=${encodedQuery}` : ""}`, {
              userId: user.id,
            }),
            apiRequest<NotificationsResponse>("/api/notifications", { userId: user.id }),
          ]);

        setProfile(profileResponse.profile);
        setJobs(jobsResponse.jobs);
        setNotifications(notificationsResponse.notifications);
        setUnreadCount(notificationsResponse.unreadCount);
        setCvTargetRole(profileResponse.profile.targetRole || "");
      } catch (loadError) {
        if (loadError instanceof ApiError && loadError.status === 401) {
          setAuthFailed(true);
          return;
        }
        setError(loadError instanceof Error ? loadError.message : "Kunde inte ladda dashboarden.");
      } finally {
        setBusy(false);
      }
    },
    [authFailed, searchQuery, user],
  );

  const loadMatches = useCallback(async () => {
    if (!user || authFailed) return;
    try {
      const matchesResponse = await apiRequest<MatchesResponse>("/api/matches", {
        userId: user.id,
      });
      setMatches(matchesResponse.matches);
      if (!selectedMatchId && matchesResponse.matches.length > 0) {
        setSelectedMatchId(matchesResponse.matches[0].id);
      }
    } catch (loadError) {
      if (loadError instanceof ApiError && loadError.status === 401) {
        setMatches([]);
        return;
      }
      setError(loadError instanceof Error ? loadError.message : "Kunde inte ladda matchningar.");
    }
  }, [authFailed, selectedMatchId, user]);

  const loadChat = useCallback(
    async (matchId: string) => {
      if (!user || !matchId) return;
      try {
        const response = await apiRequest<{ messages: MatchMessage[] }>(`/api/matches/${matchId}/chat`, {
          userId: user.id,
        });
        setMessagesByMatch((current) => ({ ...current, [matchId]: response.messages }));
      } catch (chatError) {
        setError(chatError instanceof Error ? chatError.message : "Kunde inte ladda chatten.");
      }
    },
    [user],
  );

  useEffect(() => {
    if (user && !authFailed) {
      void load();
    }
  }, [authFailed, load, user]);

  useEffect(() => {
    if (selectedMatchId) {
      void loadChat(selectedMatchId);
    }
  }, [loadChat, selectedMatchId]);

  useEffect(() => {
    if (view === "matches") {
      void loadMatches();
    }
  }, [loadMatches, view]);

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
          targetJobType: "any",
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
  }, [cvLanguage, cvPrompt, cvTargetRole, cvTone, load, profile?.targetRole, user]);

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

  const sendAction = useCallback(
    async (jobId: string, action: "interested" | "skip") => {
      if (!user) return;
      try {
        await apiRequest(`/api/jobs/${jobId}/action`, {
          method: "POST",
          userId: user.id,
          body: JSON.stringify({ action }),
        });
        await load();
      } catch (actionError) {
        setError(actionError instanceof Error ? actionError.message : "Kunde inte spara valet.");
      }
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
        void sendAction(currentJob.id, direction === "right" ? "interested" : "skip");
      }, 130);
    },
    [currentJob, sendAction],
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
    setDragX(event.clientX - dragStartX);
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

  const onSearchSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSearchQuery(searchInput.trim());
    await load(searchInput.trim());
  };

  const onClearSearch = async () => {
    setSearchInput("");
    setSearchQuery("");
    await load("");
  };

  const sendChatMessage = useCallback(async () => {
    if (!user || !selectedMatchId || !chatDraft.trim()) return;
    try {
      await apiRequest(`/api/matches/${selectedMatchId}/chat`, {
        method: "POST",
        userId: user.id,
        body: JSON.stringify({ message: chatDraft.trim() }),
      });
      setChatDraft("");
      await loadChat(selectedMatchId);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Kunde inte skicka meddelande.");
    }
  }, [chatDraft, loadChat, selectedMatchId, user]);

  const markAllRead = useCallback(async () => {
    if (!user) return;
    await apiRequest("/api/notifications", {
      method: "PATCH",
      userId: user.id,
      body: JSON.stringify({ markAllRead: true }),
    });
    await load();
  }, [load, user]);

  if (loading || !user || (busy && !profile)) {
    return <div className="mobile-shell py-10 text-sm text-[#3e648d]">{t.loading}</div>;
  }

  const selectedMatch = matches.find((match) => match.id === selectedMatchId) || null;
  const selectedMessages = messagesByMatch[selectedMatchId] || [];
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
      <main className="space-y-3 px-4 pt-4">
        {error && <p className="rounded-xl bg-[#ffe8e6] px-3 py-2 text-sm text-[#983a2d]">{error}</p>}

        {view === "feed" && (
          <section className="space-y-3">
            <form className="glass-card p-3" onSubmit={onSearchSubmit}>
              <div className="flex gap-2">
                <input
                  className="w-full rounded-xl border border-[#cfe2ff] px-3 py-2 text-sm outline-none"
                  placeholder={t.searchPlaceholder}
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                />
                <button className="cta-btn px-3 py-2 text-sm" type="submit">
                  {t.search}
                </button>
              </div>
              {searchQuery && (
                <button className="secondary-btn mt-2 w-full px-3 py-2 text-xs" type="button" onClick={onClearSearch}>
                  {t.clear}
                </button>
              )}
            </form>

            {searchQuery && jobs.length === 0 && (
              <div className="glass-card p-4 text-sm text-[#3d6288]">{t.noSearchResults}</div>
            )}

            {!searchQuery && jobs.length === 0 && (
              <div className="glass-card p-4 text-sm text-[#3d6288]">{t.noJobs}</div>
            )}

            {currentJob && (
              <div className="relative h-[62vh] select-none">
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
                      {currentJob.jobType}
                    </span>
                    <span className="text-xs text-[#4e6f92]">{feedJobs.length} kvar</span>
                  </div>
                  <h2 className="text-3xl font-semibold text-[#123359]">
                    {language === "sv" ? toSwedishJobText(currentJob.title) : currentJob.title}
                  </h2>
                  <p className="mt-2 text-sm text-[#365f88]">{currentJob.companyName}</p>
                  <p className="text-sm text-[#365f88]">{currentJob.location}</p>
                  <p className="mt-5 rounded-2xl bg-white/80 p-4 text-sm leading-relaxed text-[#2c4f74]">
                    {language === "sv"
                      ? toSwedishJobText(currentJob.description)
                      : currentJob.description}
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
            )}
          </section>
        )}

        {view === "matches" && (
          <section className="space-y-3">
            {matches.length === 0 && <div className="glass-card p-4 text-sm text-[#3d6288]">{t.noMatches}</div>}
            {matches.length > 0 && (
              <>
                <div className="glass-card space-y-2 p-3">
                  {matches.map((match) => (
                    <button
                      key={match.id}
                      className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${
                        selectedMatchId === match.id
                          ? "border-[#1474ff] bg-[#eaf2ff] text-[#0f3f7a]"
                          : "border-[#d7e8ff] bg-white text-[#365f88]"
                      }`}
                      type="button"
                      onClick={() => setSelectedMatchId(match.id)}
                    >
                      <div className="font-semibold">{match.jobTitle}</div>
                      <div>{match.companyName}</div>
                    </button>
                  ))}
                </div>

                {selectedMatch && (
                  <div className="glass-card p-3">
                    <p className="text-xs uppercase tracking-[0.12em] text-[#55739a]">{t.chatWith}</p>
                    <h3 className="text-base font-semibold text-[#123358]">{selectedMatch.companyName}</h3>
                    <div className="mt-2 max-h-72 space-y-2 overflow-y-auto rounded-xl bg-[#f7fbff] p-2">
                      {selectedMessages.map((message) => (
                        <div
                          key={message.id}
                          className={`rounded-xl px-3 py-2 text-sm ${
                            message.senderId === user.id
                              ? "ml-8 bg-[#dff0ff] text-[#214f7f]"
                              : "mr-8 bg-white text-[#335b84]"
                          }`}
                        >
                          <p>{message.message}</p>
                          <p className="mt-1 text-[10px] text-[#6a86a4]">
                            {new Date(message.createdAt).toLocaleString(language === "sv" ? "sv-SE" : "en-US")}
                          </p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 flex gap-2">
                      <input
                        className="w-full rounded-xl border border-[#cfe2ff] px-3 py-2 text-sm outline-none"
                        placeholder={t.writeMessage}
                        value={chatDraft}
                        onChange={(event) => setChatDraft(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            void sendChatMessage();
                          }
                        }}
                      />
                      <button className="cta-btn px-4 py-2 text-sm" type="button" onClick={() => void sendChatMessage()}>
                        {t.send}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        )}

        {view === "cv" && (
          <section className="space-y-3">
            <div className="glass-card p-4">
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
                  onChange={(event) => setCvTone(event.target.value as "professional" | "friendly" | "confident")}
                >
                  <option value="professional">{t.professional}</option>
                  <option value="friendly">{t.friendly}</option>
                  <option value="confident">{t.confident}</option>
                </select>
              </div>
              <input
                className="mt-2 w-full rounded-xl border border-[#cfe2ff] px-3 py-2 text-sm outline-none"
                placeholder={t.targetRole}
                value={cvTargetRole}
                onChange={(event) => setCvTargetRole(event.target.value)}
              />
              <textarea
                className="mt-3 min-h-24 w-full rounded-xl border border-[#cfe2ff] p-3 text-sm outline-none"
                placeholder={t.cvPrompt}
                value={cvPrompt}
                onChange={(event) => setCvPrompt(event.target.value)}
              />
              <button className="cta-btn mt-3 w-full px-4 py-3 text-sm" onClick={() => void generateCv()} type="button" disabled={saving}>
                {t.generateCv}
              </button>
            </div>

            {profile?.cv && (
              <div className="glass-card p-4">
                <p className="text-sm text-[#284f77]">
                  {t.quality}: <strong>{profile.cv.qualityScore || 0}/100</strong>
                </p>
                <textarea
                  className="mt-2 min-h-24 w-full rounded-xl border border-[#cfe2ff] p-3 text-sm outline-none"
                  value={profile.cv.summary}
                  onChange={(event) =>
                    setProfile((current) =>
                      current && current.cv ? { ...current, cv: { ...current.cv, summary: event.target.value } } : current,
                    )
                  }
                />
                <textarea
                  className="mt-2 min-h-52 w-full rounded-xl border border-[#cfe2ff] p-3 text-xs outline-none"
                  value={profile.cv.content}
                  onChange={(event) =>
                    setProfile((current) =>
                      current && current.cv ? { ...current, cv: { ...current.cv, content: event.target.value } } : current,
                    )
                  }
                />
                <button className="cta-btn mt-3 w-full px-4 py-3 text-sm" onClick={() => void saveCv()} type="button" disabled={saving}>
                  {t.saveCv}
                </button>
              </div>
            )}
          </section>
        )}

        {view === "profile" && profile && (
          <section className="space-y-3">
            <form className="glass-card space-y-2 p-4" onSubmit={saveProfile}>
              <input
                className="w-full rounded-xl border border-[#cfe2ff] px-3 py-2 text-sm outline-none"
                value={profile.name}
                placeholder={t.name}
                onChange={(event) => setProfile((current) => (current ? { ...current, name: event.target.value } : current))}
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
                        ? { ...current, age: Number(event.target.value) > 0 ? Number(event.target.value) : null }
                        : current,
                    )
                  }
                />
                <input
                  className="w-full rounded-xl border border-[#cfe2ff] px-3 py-2 text-sm outline-none"
                  value={profile.city}
                  placeholder={t.city}
                  onChange={(event) => setProfile((current) => (current ? { ...current, city: event.target.value } : current))}
                />
              </div>
              <input
                className="w-full rounded-xl border border-[#cfe2ff] px-3 py-2 text-sm outline-none"
                value={profile.contactEmail}
                placeholder={t.contactEmail}
                onChange={(event) =>
                  setProfile((current) => (current ? { ...current, contactEmail: event.target.value } : current))
                }
              />
              <input
                className="w-full rounded-xl border border-[#cfe2ff] px-3 py-2 text-sm outline-none"
                value={profile.contactPhone}
                placeholder={t.contactPhone}
                onChange={(event) =>
                  setProfile((current) => (current ? { ...current, contactPhone: event.target.value } : current))
                }
              />
              <input
                className="w-full rounded-xl border border-[#cfe2ff] px-3 py-2 text-sm outline-none"
                value={profile.targetRole}
                placeholder={t.targetRole}
                onChange={(event) =>
                  setProfile((current) => (current ? { ...current, targetRole: event.target.value } : current))
                }
              />
              <input
                className="w-full rounded-xl border border-[#cfe2ff] px-3 py-2 text-sm outline-none"
                value={fromCsv(profile.skills)}
                placeholder={t.skills}
                onChange={(event) =>
                  setProfile((current) => (current ? { ...current, skills: toCsv(event.target.value) } : current))
                }
              />
              <input
                className="w-full rounded-xl border border-[#cfe2ff] px-3 py-2 text-sm outline-none"
                value={fromCsv(profile.interests)}
                placeholder={t.interests}
                onChange={(event) =>
                  setProfile((current) => (current ? { ...current, interests: toCsv(event.target.value) } : current))
                }
              />
              <input
                className="w-full rounded-xl border border-[#cfe2ff] px-3 py-2 text-sm outline-none"
                value={fromCsv(profile.experience)}
                placeholder={t.experience}
                onChange={(event) =>
                  setProfile((current) => (current ? { ...current, experience: toCsv(event.target.value) } : current))
                }
              />
              <input
                className="w-full rounded-xl border border-[#cfe2ff] px-3 py-2 text-sm outline-none"
                value={profile.availability}
                placeholder={t.availability}
                onChange={(event) =>
                  setProfile((current) => (current ? { ...current, availability: event.target.value } : current))
                }
              />
              <button className="cta-btn w-full px-4 py-3 text-sm" disabled={saving}>
                {saving ? t.saving : t.save}
              </button>
              <button
                className="w-full rounded-xl border border-[#ffcfcf] bg-[#ffe8e8] px-4 py-3 text-sm font-semibold text-[#b42323]"
                type="button"
                onClick={logout}
              >
                {t.logout}
              </button>
            </form>
          </section>
        )}

        {view === "alerts" && (
          <section className="space-y-3">
            <div className="glass-card p-4">
              <button className="secondary-btn w-full px-4 py-3 text-sm" onClick={() => void markAllRead()} type="button">
                {t.markAllRead}
              </button>
            </div>
            {notifications.length === 0 && <div className="glass-card p-4 text-sm text-[#3d6288]">{t.noNotifications}</div>}
            {notifications.map((notification) => (
              <div key={notification.id} className="glass-card p-4">
                <p className="text-sm text-[#2f5074]">{notification.message}</p>
                <p className="mt-1 text-xs text-[#5b7694]">
                  {new Date(notification.createdAt).toLocaleString(language === "sv" ? "sv-SE" : "en-US")}
                </p>
              </div>
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
              className={`min-h-[42px] whitespace-normal break-words rounded-xl px-1 py-2 text-[11px] leading-tight font-semibold ${
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

