"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  emptyYouthFilters,
  filterYouthJobs,
  initialYouthProfile,
  demoProfileQuestions,
  youthJobs,
  type DemoProfile,
} from "@/lib/youth-demo-data";

import dynamic from "next/dynamic";
import {
  DemoIcon,
  DemoSwipe,
  DemoProfileBuilder,
} from "@/components/demo-discovery";

const DemoJobMap = dynamic(
  () => import("@/components/demo-job-map").then((module) => module.DemoJobMap),
  { ssr: false, loading: () => <p role="status">Laddar kartan…</p> },
);

type Tab = "map" | "jobs" | "saved" | "applications" | "chat" | "profile";
type Draft = {
  note: string;
  start: string;
  answer: string;
  availability: string[];
};
type Application = {
  jobId: string;
  draft: Draft;
  profile: DemoProfile;
  status: "sent" | "contact" | "withdrawn";
  slot?: string;
};
import { demoContacts, type DemoChatMessage as Message } from "@/lib/demo-chat";
type Overlay =
  | "job"
  | "filters"
  | "apply"
  | "review"
  | "application"
  | "withdraw"
  | "cv"
  | null;
const labels: Record<Tab, string> = {
  jobs: "Upptäck",
  map: "Karta",
  saved: "Sparade",
  applications: "Aktivitet",
  chat: "Chatt",
  profile: "Min profil",
};
const freshDraft = (profile: DemoProfile): Draft => ({
  note: "",
  start: "Enligt överenskommelse",
  answer: "",
  availability: [...profile.availability],
});

function Sheet({
  title,
  close,
  children,
  footer,
}: {
  title: string;
  close: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    return () => {
      dialog.close();
      document.body.style.overflow = previous;
    };
  }, [title]);
  return (
    <dialog
      ref={ref}
      className="yd-sheet"
      aria-labelledby="yd-dialog-title"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="yd-sheet-frame">
        <header>
          <h2 id="yd-dialog-title">{title}</h2>
          <button type="button" aria-label="Stäng detaljvyn" onClick={close}>
            ×
          </button>
        </header>
        <div className="yd-sheet-body">{children}</div>
        {footer && <footer>{footer}</footer>}
      </div>
    </dialog>
  );
}

export function YouthDemo() {
  const [tab, setTab] = useState<Tab>("jobs");
  const [saved, setSaved] = useState<string[]>(["park", "bakery", "cinema"]);
  const [skipped, setSkipped] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState(emptyYouthFilters);
  const [profile, setProfile] = useState(initialYouthProfile);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({
    event: {
      ...freshDraft(initialYouthProfile),
      note: "Hej! Jag gillar sport och vill gärna hjälpa till på matcher.",
    },
  });
  const [applications, setApplications] = useState<Application[]>([
    {
      jobId: "cafe",
      status: "contact",
      profile: { ...initialYouthProfile },
      draft: {
        ...freshDraft(initialYouthProfile),
        answer: "Jag gillar service och vill lära mig mer om kaffe.",
      },
    },
    {
      jobId: "shop",
      status: "sent",
      profile: { ...initialYouthProfile },
      draft: {
        ...freshDraft(initialYouthProfile),
        answer: "Jag hjälper gärna kunder att hitta rätt.",
      },
    },
    {
      jobId: "sports",
      status: "contact",
      slot: "Onsdag 17.00",
      profile: { ...initialYouthProfile },
      draft: {
        ...freshDraft(initialYouthProfile),
        answer: "Jag hjälper till i min idrottsförening.",
      },
    },
  ]);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [selected, setSelected] = useState("cafe");
  const [consent, setConsent] = useState(false);
  const [applicationFilter, setApplicationFilter] = useState("Alla");
  const [threadId, setThreadId] = useState("cafe");
  const [threads, setThreads] = useState<Record<string, Message[]>>({
    cafe: [
      { own: true, text: "Hej! Jag har precis sökt jobbet hos er." },
      {
        own: false,
        text: "Hej Alex! Kul att du sökt. Kan du jobba varannan helg?",
      },
    ],
    shop: [
      { own: true, text: "Hej! Behöver jag ha jobbat i butik tidigare?" },
      {
        own: false,
        text: "Hej! Nej, du får introduktion av oss. Det viktigaste är att du gillar att hjälpa kunder.",
      },
    ],
    sports: [
      {
        own: false,
        text: "Hej Alex! Din erfarenhet som ungdomsledare låter intressant. Vi hörs på onsdag 17.00!",
      },
      { own: true, text: "Det blir jättebra, vi hörs då!" },
    ],
  });
  const [profileAnswers, setProfileAnswers] = useState<string[]>([]);
  const [buildingProfile, setBuildingProfile] = useState(false);
  const [profileBuilt, setProfileBuilt] = useState(false);
  const [typing, setTyping] = useState<Record<string, boolean>>({});
  const [chatErrors, setChatErrors] = useState<Record<string, string>>({});
  const [unread, setUnread] = useState<Record<string, number>>({});
  const requests = useRef<Record<string, AbortController>>({});
  const activeThread = useRef<string | null>(null);
  useEffect(() => {
    activeThread.current = tab === "chat" ? threadId : null;
    if (tab === "chat") setUnread((current) => ({ ...current, [threadId]: 0 }));
  }, [tab, threadId]);
  useEffect(
    () => () => {
      Object.values(requests.current).forEach((controller) =>
        controller.abort(),
      );
    },
    [],
  );
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");
  const logRef = useRef<HTMLDivElement>(null);
  const job = youthJobs.find((j) => j.id === selected)!;
  const draft = drafts[job.id] ?? freshDraft(profile);
  const application = applications.find((a) => a.jobId === job.id);
  const visibleJobs =
    tab === "saved"
      ? youthJobs.filter((j) => saved.includes(j.id))
      : filterYouthJobs(search, filters, profile.age);
  const filterCount =
    Number(filters.category !== "Alla") +
    Number(filters.area !== "Alla") +
    Number(filters.schedule !== "Alla") +
    Number(filters.suitableAge);
  const chatJob = youthJobs.find((j) => j.id === threadId) ?? youthJobs[0];
  const messages = threads[chatJob.id] ?? [
    {
      own: false,
      text: "Hej Alex! Tack för ditt intresse. Vilka tider skulle du kunna arbeta?",
    },
  ];
  const chatJobs = youthJobs.filter(
    (j) =>
      j.id === "cafe" ||
      applications.some((a) => a.jobId === j.id && a.status === "contact") ||
      threads[j.id],
  );
  const draftEntries = Object.entries(drafts).filter(
    ([id]) => !applications.some((a) => a.jobId === id),
  );
  const filteredApplications = applications.filter(
    (a) =>
      applicationFilter === "Alla" ||
      (applicationFilter === "Pågående" && a.status !== "withdrawn") ||
      (applicationFilter === "Tillbakadragna" && a.status === "withdrawn"),
  );
  const shownDrafts =
    applicationFilter === "Alla" || applicationFilter === "Utkast"
      ? draftEntries
      : [];
  const activeApplications = applications.filter(
    (a) => a.status !== "withdrawn",
  );
  useEffect(() => {
    if (tab === "chat" && logRef.current)
      logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [tab, threads, threadId, typing]);
  function go(next: Tab) {
    setTab(next);
    setOverlay(null);
    setNotice("");
  }
  function openJob(id: string) {
    setSelected(id);
    setOverlay("job");
    setNotice("");
  }
  function save(id: string) {
    setSaved((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );
  }
  function patchDraft(patch: Partial<Draft>) {
    setDrafts((current) => ({
      ...current,
      [job.id]: { ...(current[job.id] ?? freshDraft(profile)), ...patch },
    }));
  }
  function beginApply() {
    patchDraft({});
    setConsent(false);
    setOverlay("apply");
  }
  function sendApplication() {
    if (
      !consent ||
      profile.age < job.minAge ||
      applications.some((a) => a.jobId === job.id)
    )
      return;
    setApplications((current) => [
      ...current,
      {
        jobId: job.id,
        draft: { ...draft, availability: [...draft.availability] },
        profile: { ...profile, availability: [...profile.availability] },
        status: "sent",
      },
    ]);
    setOverlay(null);
    setTab("applications");
    setNotice(`Din ansökan till ${job.company} är skickad.`);
  }
  function applyFromSwipe(id: string) {
    const target = youthJobs.find((item) => item.id === id);
    if (!target || profile.age < target.minAge) {
      setNotice(
        target
          ? `${target.age} för det här jobbet.`
          : "Jobbet kunde inte hittas.",
      );
      return;
    }
    setApplications((current) =>
      current.some((item) => item.jobId === id)
        ? current
        : [
            ...current,
            {
              jobId: id,
              draft: freshDraft(profile),
              profile: { ...profile, availability: [...profile.availability] },
              status: "sent",
            },
          ],
    );
    setNotice(`Ansökan till ${target.company} är skickad.`);
  }
  function openChat(id: string, reply = false) {
    setThreadId(id);
    setMessage("");
    go("chat");
    if (reply) {
      setApplications((current) =>
        current.map((a) =>
          a.jobId === id && a.status === "sent"
            ? { ...a, status: "contact" }
            : a,
        ),
      );
      setThreads((current) => ({
        ...current,
        [id]: current[id] ?? [
          {
            own: false,
            text: "Hej Alex! Vi har läst din ansökan och vill gärna veta mer. När skulle du kunna ta ett kort samtal?",
          },
        ],
      }));
    }
  }
  const timeNow = () =>
    new Date().toLocaleTimeString("sv-SE", {
      hour: "2-digit",
      minute: "2-digit",
    });
  async function requestReply(id: string, history: Message[]) {
    if (requests.current[id]) return;
    const controller = new AbortController();
    requests.current[id] = controller;
    setTyping((current) => ({ ...current, [id]: true }));
    setChatErrors((current) => ({ ...current, [id]: "" }));
    const timeout = setTimeout(() => {
      setChatErrors((current) => ({
        ...current,
        [id]: "Svaret dröjer för länge. Försök igen.",
      }));
      controller.abort();
    }, 27000);
    try {
      const response = await fetch("/api/demo/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: id,
          messages: history.slice(-12).map(({ own, text }) => ({ own, text })),
        }),
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok || typeof data.text !== "string")
        throw new Error(data.error || "AI:n kunde inte svara just nu.");
      if (controller.signal.aborted) return;
      setThreads((current) => ({
        ...current,
        [id]: [
          ...(current[id] ?? history).map((entry) =>
            entry.own ? { ...entry, read: true } : entry,
          ),
          { own: false, text: data.text, time: timeNow() },
        ],
      }));
      if (activeThread.current !== id)
        setUnread((current) => ({ ...current, [id]: (current[id] || 0) + 1 }));
      setApplications((current) =>
        current.map((item) =>
          item.jobId === id && item.status === "sent"
            ? { ...item, status: "contact" }
            : item,
        ),
      );
    } catch (error) {
      if (!controller.signal.aborted)
        setChatErrors((current) => ({
          ...current,
          [id]:
            error instanceof Error
              ? error.message
              : "Kunde inte hämta AI-svaret.",
        }));
    } finally {
      clearTimeout(timeout);
      if (requests.current[id] === controller) delete requests.current[id];
      setTyping((current) => ({ ...current, [id]: false }));
    }
  }
  function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!message.trim() || requests.current[chatJob.id]) return;
    const history = [
      ...messages,
      { own: true, text: message.trim(), time: timeNow(), read: false },
    ];
    setThreads((current) => ({ ...current, [chatJob.id]: history }));
    setMessage("");
    void requestReply(chatJob.id, history);
  }
  function book(slot: string) {
    if (requests.current[chatJob.id]) return;
    setApplications((current) =>
      current.map((a) => (a.jobId === chatJob.id ? { ...a, slot } : a)),
    );
    const history = [
      ...messages,
      {
        own: true,
        text: `Jag väljer ${slot.toLowerCase()} för demosamtalet.`,
        time: timeNow(),
        read: false,
      },
    ];
    setThreads((current) => ({ ...current, [chatJob.id]: history }));
    void requestReply(chatJob.id, history);
    setNotice(`Samtal bokat: ${slot}. Ingen riktig bokning görs.`);
  }
  function withdraw() {
    setApplications((current) =>
      current.map((a) =>
        a.jobId === job.id ? { ...a, status: "withdrawn", slot: undefined } : a,
      ),
    );
    setOverlay(null);
    setNotice(
      "Demoansökan har dragits tillbaka. I tjänsten skulle företaget få information om detta.",
    );
  }
  const nav = (
    <nav className="yd-nav" aria-label="Ungdomsdemonavigation">
      {(["jobs", "map", "applications", "chat", "profile"] as Tab[]).map(
        (item) => (
          <button
            key={item}
            aria-current={
              tab === item || (item === "applications" && tab === "saved")
                ? "page"
                : undefined
            }
            onClick={() => go(item)}
          >
            <span>
              <DemoIcon name={item} />
            </span>
            <span>{labels[item]}</span>
            {item === "chat" && Object.values(unread).some(Boolean) && (
              <b>
                {Object.values(unread).reduce((sum, count) => sum + count, 0)}
              </b>
            )}
            {item === "saved" && saved.length > 0 && <b>{saved.length}</b>}
            {item === "applications" && activeApplications.length > 0 && (
              <b>{activeApplications.length}</b>
            )}
          </button>
        ),
      )}
    </nav>
  );
  return (
    <div className="yd-app">
      <aside className="yd-sidebar">
        <div className="yd-user">
          <span className="yd-avatar">A</span>
          <div>
            <strong>Alex, {profile.age} år</strong>
            <small>Södermalm · Stockholm</small>
          </div>
        </div>
        {nav}
      </aside>
      <section className="yd-main" aria-label="Ungdomsvy">
        <div className="yd-heading">
          <div>
            <h2>{tab === "applications" ? "Ansökningar" : labels[tab]}</h2>
          </div>
          <button
            className="yd-profile-shortcut"
            onClick={() => go("profile")}
            aria-label="Öppna min demoprofil"
          >
            A
          </button>
        </div>
        <p className="yd-notice" role="status" aria-live="polite">
          {notice}
        </p>
        {(tab === "applications" || tab === "saved") && (
          <div className="yd-activity-tabs" aria-label="Din aktivitet">
            <button
              aria-pressed={tab === "applications"}
              onClick={() => go("applications")}
            >
              Ansökningar <b>{activeApplications.length}</b>
            </button>
            <button aria-pressed={tab === "saved"} onClick={() => go("saved")}>
              Sparade <b>{saved.length}</b>
            </button>
          </div>
        )}
        {tab === "map" && <DemoJobMap jobs={youthJobs} onOpen={openJob} />}
        {(tab === "jobs" || tab === "saved") && (
          <>
            {tab === "jobs" && (
              <>
                <div className="yd-search-row">
                  <label>
                    <span aria-hidden="true">⌕</span>
                    <input
                      aria-label="Sök demojobb"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Jobb, företag eller område"
                    />
                  </label>
                  <button
                    onClick={() => setOverlay("filters")}
                    aria-label={`Öppna jobbfilter${filterCount ? `, ${filterCount} aktiva` : ""}`}
                  >
                    Filter <span>{filterCount || "+"}</span>
                  </button>
                </div>
                <div className="yd-category-chips" aria-label="Jobbkategorier">
                  {["Alla", ...new Set(youthJobs.map((j) => j.category))].map(
                    (value) => (
                      <button
                        aria-pressed={filters.category === value}
                        key={value}
                        onClick={() =>
                          setFilters((current) => ({
                            ...current,
                            category: value,
                          }))
                        }
                      >
                        {value}
                      </button>
                    ),
                  )}
                </div>
              </>
            )}
            {tab === "jobs" ? (
              <DemoSwipe
                jobs={visibleJobs}
                saved={saved}
                excluded={applications.map((a) => a.jobId)}
                skipped={skipped}
                onSkip={(id) => setSkipped((current) => [...current, id])}
                onSave={save}
                onOpen={openJob}
                onApply={applyFromSwipe}
                onReset={() => {
                  setSkipped([]);
                  setSearch("");
                  setFilters(emptyYouthFilters);
                }}
              />
            ) : (
              <>
                <div className="yd-result-heading">
                  <span>{visibleJobs.length} sparade jobb</span>
                  {tab === "saved" && (
                    <span>Tryck på hjärtat för att ta bort</span>
                  )}
                </div>
                <div className="yd-job-grid">
                  {visibleJobs.map((item) => (
                    <article className="yd-job-card" key={item.id}>
                      <div className={`yd-card-art ${item.tone}`}>
                        <span>{item.category}</span>
                        <strong aria-hidden="true">{item.mark}</strong>
                        <button
                          className="yd-save"
                          aria-label={`${saved.includes(item.id) ? "Ta bort sparat jobb" : "Spara jobb"}: ${item.title}`}
                          aria-pressed={saved.includes(item.id)}
                          onClick={() => save(item.id)}
                        >
                          {saved.includes(item.id) ? "♥" : "♡"}
                        </button>
                        <span className="yd-art-area">⌖ {item.area}</span>
                      </div>
                      <button
                        className="yd-card-open"
                        onClick={() => openJob(item.id)}
                        aria-label={`Visa jobbet ${item.title} hos ${item.company}`}
                      >
                        <span>{item.company}</span>
                        <h3>
                          {item.title}
                          <span aria-hidden="true">→</span>
                        </h3>
                        <p>{item.hours}</p>
                        <div className="yd-tags">
                          <span>{item.age}</span>
                          <span>{item.tags[0]}</span>
                        </div>
                        {applications.some((a) => a.jobId === item.id) && (
                          <span className="yd-card-status">
                            {applications.find((a) => a.jobId === item.id)
                              ?.status === "withdrawn"
                              ? "Tidigare ansökan"
                              : "✓ Ansökan skickad"}
                          </span>
                        )}
                        {drafts[item.id] &&
                          !applications.some((a) => a.jobId === item.id) && (
                            <span className="yd-card-status">
                              Ansökan påbörjad
                            </span>
                          )}
                      </button>
                    </article>
                  ))}
                </div>
                {visibleJobs.length === 0 && (
                  <div className="yd-empty">
                    <span>♡</span>
                    <h3>
                      {tab === "saved"
                        ? "Spara något som väcker din nyfikenhet."
                        : "Inga jobb med de här valen."}
                    </h3>
                    <p>
                      {tab === "saved"
                        ? "Hjärtat på ett jobb lägger det i din lista."
                        : "Prova ett annat område, en annan tid eller färre filter."}
                    </p>
                    <button
                      className="yd-primary"
                      onClick={() => {
                        setSearch("");
                        setFilters(emptyYouthFilters);
                        go("jobs");
                      }}
                    >
                      Visa alla jobb →
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}
        {tab === "applications" && (
          <>
            <div
              className="yd-category-chips"
              aria-label="Filtrera ansökningar"
            >
              {["Alla", "Pågående", "Utkast", "Tillbakadragna"].map((value) => (
                <button
                  key={value}
                  aria-pressed={applicationFilter === value}
                  onClick={() => setApplicationFilter(value)}
                >
                  {value}
                </button>
              ))}
            </div>
            {shownDrafts.map(([id]) => {
              const j = youthJobs.find((j) => j.id === id)!;
              return (
                <article className="yd-application" key={id}>
                  <div className="yd-row-top">
                    <span className={`dx-emblem ${j.tone}`}>{j.mark}</span>
                    <div>
                      <span>{j.company}</span>
                      <h3>{j.title}</h3>
                    </div>
                    <span className="yd-status draft">Utkast</span>
                  </div>
                  <p>Inte skickad ännu.</p>
                  <button
                    className="yd-secondary"
                    onClick={() => {
                      setSelected(id);
                      setOverlay("apply");
                    }}
                  >
                    Fortsätt ansökan →
                  </button>
                  <button
                    className="yd-text"
                    onClick={() =>
                      setDrafts((current) => {
                        const next = { ...current };
                        delete next[id];
                        return next;
                      })
                    }
                  >
                    Ta bort utkast
                  </button>
                </article>
              );
            })}
            {filteredApplications.map((a) => {
              const j = youthJobs.find((j) => j.id === a.jobId)!;
              return (
                <article className="yd-application" key={a.jobId}>
                  <div className="yd-row-top">
                    <span className={`dx-emblem ${j.tone}`}>{j.mark}</span>
                    <div>
                      <span>{j.company}</span>
                      <h3>{j.title}</h3>
                    </div>
                    <span className={`yd-status ${a.status}`}>
                      {a.status === "sent"
                        ? "Skickad"
                        : a.status === "contact"
                          ? a.slot
                            ? "Samtal bokat"
                            : "Kontakt"
                          : "Tillbakadragen"}
                    </span>
                  </div>
                  <div
                    className="yd-progress"
                    aria-label={`Ansökningsstatus: ${a.status}`}
                  >
                    <span className="done">Ansökan</span>
                    <i />
                    <span className={a.status === "contact" ? "done" : ""}>
                      Kontakt
                    </span>
                    <i />
                    <span className={a.slot ? "done" : ""}>Samtal</span>
                  </div>
                  {a.slot && <p>◷ Samtal: {a.slot}</p>}
                  <div className="yd-actions">
                    <button
                      className="yd-secondary"
                      onClick={() => {
                        setSelected(j.id);
                        setOverlay("application");
                      }}
                    >
                      Se skickat underlag
                    </button>
                    {a.status === "sent" && (
                      <button
                        className="yd-primary"
                        onClick={() => openChat(j.id, true)}
                      >
                        Se återkoppling →
                      </button>
                    )}
                    {a.status === "contact" && (
                      <button
                        className="yd-primary"
                        onClick={() => openChat(j.id)}
                      >
                        Öppna chatten →
                      </button>
                    )}
                  </div>
                  {a.status !== "withdrawn" && (
                    <button
                      className="yd-text"
                      onClick={() => {
                        setSelected(j.id);
                        setOverlay("withdraw");
                      }}
                    >
                      Dra tillbaka ansökan
                    </button>
                  )}
                </article>
              );
            })}
            {filteredApplications.length === 0 && shownDrafts.length === 0 && (
              <div className="yd-empty">
                <span>→</span>
                <h3>Din nästa möjlighet börjar här.</h3>
                <p>
                  Öppna ett jobb och prova att ansöka. Du kan granska underlaget
                  innan du skickar.
                </p>
                <button className="yd-primary" onClick={() => go("jobs")}>
                  Hitta ett jobb →
                </button>
              </div>
            )}
          </>
        )}
        {tab === "profile" &&
          (buildingProfile ? (
            <DemoProfileBuilder
              profile={profile}
              answers={profileAnswers}
              onAnswer={(answer) =>
                setProfileAnswers((current) =>
                  current.length < demoProfileQuestions.length
                    ? [...current, answer]
                    : current,
                )
              }
              onRestart={() => setProfileAnswers([])}
              onComplete={(built) => {
                setProfile(built);
                setProfileBuilt(true);
                setBuildingProfile(false);
                setNotice("Din profil är uppdaterad.");
              }}
            />
          ) : (
            <>
              <div className="yd-profile-banner">
                <span className="yd-avatar">A</span>
                <div>
                  <h3>Alex, {profile.age}</h3>
                  <p>{profile.area} · Stockholm</p>
                </div>
                <button
                  className="yd-secondary"
                  onClick={() => setOverlay("cv")}
                >
                  Visa CV
                </button>
              </div>
              <button
                className="yd-build-cta"
                onClick={() => setBuildingProfile(true)}
              >
                <span className="yd-ai-avatar">✦</span>
                <span>
                  <strong>
                    {profileBuilt
                      ? "Uppdatera din profil"
                      : "Bygg din profil med AI"}
                  </strong>
                  <small>4 snabba frågor · tre val per fråga</small>
                </span>
                <span>→</span>
              </button>
              <section className="yd-profile-summary">
                <h3>Om mig</h3>
                <p>{profile.bio}</p>
                <h3>Tillgänglighet</h3>
                <div className="yd-tags">
                  {profile.availability.map((value) => (
                    <span key={value}>{value}</span>
                  ))}
                </div>
                <h3>Erfarenhet</h3>
                <p>{profile.experience || "Ungdomsledare i idrottsförening"}</p>
                {profile.strengths && (
                  <>
                    <h3>Styrkor</h3>
                    <p>{profile.strengths}</p>
                  </>
                )}
                <h3>Språk</h3>
                <p>Svenska och engelska</p>
              </section>
            </>
          ))}
        {tab === "chat" && (
          <div className="yd-chat-layout">
            <div className="yd-thread-list" aria-label="Demokonversationer">
              {chatJobs.map((j) => (
                <button
                  key={j.id}
                  aria-pressed={threadId === j.id}
                  onClick={() => {
                    setThreadId(j.id);
                    setMessage("");
                    setNotice("");
                  }}
                >
                  <span className={`dx-emblem ${j.tone}`}>{j.mark}</span>
                  <span>
                    <strong>{j.company}</strong>
                    <small>
                      {typing[j.id]
                        ? `${demoContacts[j.id]} skriver…`
                        : threads[j.id]?.at(-1)?.text || j.title}
                    </small>
                  </span>
                  {!!unread[j.id] && (
                    <b className="yd-unread">{unread[j.id]}</b>
                  )}
                </button>
              ))}
            </div>
            <section className="yd-chat">
              <header>
                <span className={`dx-emblem ${chatJob.tone}`}>
                  {chatJob.mark}
                </span>
                <div>
                  <h3>{chatJob.company}</h3>
                  <p>
                    {demoContacts[chatJob.id]} · {chatJob.title}
                  </p>
                  <small className="yd-ai-disclosure">
                    AI-demochatt · svar via OpenAI
                  </small>
                </div>
              </header>
              <div
                ref={logRef}
                className="yd-message-log"
                role="log"
                aria-label="Demomeddelanden"
              >
                <div className="yd-chat-day">Idag</div>
                {messages.map((entry, i) => (
                  <div
                    key={i}
                    className={`yd-message ${entry.own ? "own" : ""}`}
                  >
                    <small>{entry.own ? "Du" : demoContacts[chatJob.id]}</small>
                    <p>{entry.text}</p>
                    <div className="yd-message-meta">
                      <time>
                        {entry.time ||
                          `14.${String(20 + i * 2).padStart(2, "0")}`}
                      </time>
                      {entry.own && (
                        <span>
                          {entry.read === false ? "Levererat" : "Läst"} ✓
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                {typing[chatJob.id] && (
                  <div className="yd-typing" role="status">
                    <i />
                    <i />
                    <i />
                    <span>{demoContacts[chatJob.id]} skriver…</span>
                  </div>
                )}
              </div>
              {chatErrors[chatJob.id] && (
                <div className="yd-chat-error" role="alert">
                  <p>{chatErrors[chatJob.id]}</p>
                  <button
                    className="yd-text"
                    onClick={() => void requestReply(chatJob.id, messages)}
                  >
                    Försök igen
                  </button>
                </div>
              )}
              <div className="yd-quick-replies" aria-label="Förslag på svar">
                {[
                  "Jag kan jobba helger.",
                  "När kan jag börja?",
                  "Hur ser en vanlig dag ut?",
                ].map((text) => (
                  <button key={text} onClick={() => setMessage(text)}>
                    {text}
                  </button>
                ))}
              </div>
              <form onSubmit={sendMessage}>
                <label className="dx-sr-only" htmlFor="yd-message">
                  Ditt meddelande
                </label>
                <textarea
                  id="yd-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={500}
                  rows={1}
                  placeholder="Skriv ett demosvar…"
                />
                <button
                  className="yd-primary"
                  disabled={!message.trim() || typing[chatJob.id]}
                  aria-label="Skicka meddelande"
                >
                  ↑
                </button>
              </form>
              {applications.some(
                (a) => a.jobId === chatJob.id && a.status === "contact",
              ) && (
                <div className="yd-slots">
                  <strong>Välj tid för ett samtal</strong>

                  {["Tisdag 16.30", "Onsdag 17.00"].map((slot) => (
                    <button
                      key={slot}
                      className="yd-secondary"
                      aria-pressed={applications.some(
                        (a) => a.jobId === chatJob.id && a.slot === slot,
                      )}
                      disabled={!!typing[chatJob.id]}
                      onClick={() => book(slot)}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </section>
      {overlay && (
        <Sheet
          title={
            overlay === "filters"
              ? "Hitta ett jobb som passar"
              : overlay === "cv"
                ? "Alex · CV"
                : overlay === "withdraw"
                  ? "Dra tillbaka ansökan?"
                  : overlay === "review"
                    ? "Granska din ansökan"
                    : overlay === "apply"
                      ? "Din ansökan · steg 1 av 2"
                      : overlay === "application"
                        ? "Ditt skickade underlag"
                        : job.title
          }
          close={() => setOverlay(null)}
          footer={
            overlay === "job" ? (
              <>
                <button
                  className="yd-save-detail"
                  aria-pressed={saved.includes(job.id)}
                  onClick={() => save(job.id)}
                  aria-label={
                    saved.includes(job.id)
                      ? "Ta bort sparat jobb"
                      : "Spara jobbet"
                  }
                >
                  {saved.includes(job.id) ? "♥" : "♡"}
                </button>
                {application ? (
                  <button
                    className="yd-primary"
                    onClick={() => {
                      go("applications");
                    }}
                  >
                    Visa min ansökan →
                  </button>
                ) : (
                  <button
                    className="yd-primary"
                    disabled={profile.age < job.minAge}
                    onClick={beginApply}
                  >
                    {profile.age < job.minAge
                      ? `${job.age} i det här exemplet`
                      : drafts[job.id]
                        ? "Fortsätt ansökan →"
                        : "Ansök →"}
                  </button>
                )}
              </>
            ) : overlay === "review" ? (
              <>
                <button
                  className="yd-secondary"
                  onClick={() => setOverlay("apply")}
                >
                  ← Ändra
                </button>
                <button
                  className="yd-primary"
                  disabled={!consent || profile.age < job.minAge}
                  onClick={sendApplication}
                >
                  Skicka ansökan →
                </button>
              </>
            ) : overlay === "filters" ? (
              <>
                <button
                  className="yd-secondary"
                  onClick={() => setFilters(emptyYouthFilters)}
                >
                  Rensa
                </button>
                <button className="yd-primary" onClick={() => setOverlay(null)}>
                  Visa {filterYouthJobs(search, filters, profile.age).length}{" "}
                  jobb →
                </button>
              </>
            ) : undefined
          }
        >
          {overlay === "job" && (
            <>
              <div className={`yd-detail-art ${job.tone}`}>
                <span>{job.category}</span>
                <strong>{job.mark}</strong>
                <span>{job.company}</span>
              </div>
              <div className="yd-detail-title">
                <span>{job.company}</span>
                <h3>{job.title}</h3>
                <p>⌖ {job.area}, Stockholm</p>
              </div>
              <div className="yd-tags">
                <span>{job.age}</span>
                {job.tags.map((tag) => (
                  <span key={tag}>{tag}</span>
                ))}
              </div>
              {profile.age < job.minAge && (
                <p className="yd-age-note">
                  Alex är {profile.age} år i din demoprofil. Det här exemplet
                  söker personer från {job.minAge} år. Du kan ändra demoprofilen
                  eller hitta ett annat jobb.
                </p>
              )}
              <h4>Om jobbet</h4>
              <p>{job.description}</p>
              <h4>Det här får du göra</h4>
              <ul>
                {job.tasks.map((task) => (
                  <li key={task}>{task}</li>
                ))}
              </ul>
              <dl className="yd-facts">
                <div>
                  <dt>Arbetstid</dt>
                  <dd>{job.hours}</dd>
                </div>
                <div>
                  <dt>Start</dt>
                  <dd>{job.start}</dd>
                </div>
                <div>
                  <dt>Lön</dt>
                  <dd>Enligt överenskommelse</dd>
                </div>
              </dl>
            </>
          )}
          {overlay === "filters" && (
            <div className="yd-filter-form">
              {(
                [
                  {
                    key: "category",
                    label: "Typ av jobb",
                    values: [
                      "Alla",
                      ...new Set(youthJobs.map((j) => j.category)),
                    ],
                  },
                  {
                    key: "area",
                    label: "Område",
                    values: ["Alla", ...new Set(youthJobs.map((j) => j.area))],
                  },
                  {
                    key: "schedule",
                    label: "Arbetstid",
                    values: ["Alla", "Helger", "Kvällar", "Sommar"],
                  },
                ] as const
              ).map((field) => (
                <label key={field.key}>
                  {field.label}
                  <select
                    value={filters[field.key]}
                    onChange={(e) =>
                      setFilters((current) => ({
                        ...current,
                        [field.key]: e.target.value,
                      }))
                    }
                  >
                    {field.values.map((value) => (
                      <option key={value}>{value}</option>
                    ))}
                  </select>
                </label>
              ))}
              <label className="yd-check">
                <input
                  type="checkbox"
                  checked={filters.suitableAge}
                  onChange={(e) =>
                    setFilters((current) => ({
                      ...current,
                      suitableAge: e.target.checked,
                    }))
                  }
                />
                Visa bara jobb för Alex ålder ({profile.age} år)
              </label>
            </div>
          )}
          {overlay === "apply" && (
            <form
              className="yd-apply"
              onSubmit={(e) => {
                e.preventDefault();
                setConsent(false);
                setOverlay("review");
              }}
            >
              <span className="yd-kicker">{job.company}</span>
              <h3>{job.title}</h3>

              <label>
                Kort hälsning <span>(valfritt)</span>
                <textarea
                  value={draft.note}
                  onChange={(e) => patchDraft({ note: e.target.value })}
                  maxLength={500}
                  rows={3}
                  placeholder="Berätta vad som gör dig nyfiken…"
                />
              </label>
              <label>
                När kan du börja?
                <select
                  value={draft.start}
                  onChange={(e) => patchDraft({ start: e.target.value })}
                >
                  {[
                    "Enligt överenskommelse",
                    "Så snart som möjligt",
                    "Efter skolavslutningen",
                  ].map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
              <fieldset>
                <legend>
                  När kan du jobba? <span>(välj minst ett)</span>
                </legend>
                <div className="yd-choice-grid">
                  {["Helger", "Kvällar", "Efter skolan", "Sommar"].map(
                    (value) => (
                      <label key={value}>
                        <input
                          type="checkbox"
                          checked={draft.availability.includes(value)}
                          onChange={(e) =>
                            patchDraft({
                              availability: e.target.checked
                                ? [...draft.availability, value]
                                : draft.availability.filter((x) => x !== value),
                            })
                          }
                        />
                        {value}
                      </label>
                    ),
                  )}
                </div>
              </fieldset>
              <label>
                {job.question}
                <textarea
                  value={draft.answer}
                  onChange={(e) => patchDraft({ answer: e.target.value })}
                  maxLength={500}
                  rows={3}
                  required
                  placeholder="Berätta kort…"
                />
              </label>
              <button
                className="yd-primary"
                disabled={
                  draft.availability.length === 0 || profile.age < job.minAge
                }
              >
                Granska ansökan →
              </button>
            </form>
          )}
          {(overlay === "review" || overlay === "application") &&
            (() => {
              const sent = overlay === "application" ? application : undefined;
              const data = sent?.draft ?? draft;
              const person = sent?.profile ?? profile;
              return (
                <div className="yd-review">
                  <span className="yd-kicker">
                    DET HÄR SER {job.company.toLocaleUpperCase("sv")}
                  </span>
                  <h3>{job.title}</h3>
                  <div className="yd-person-row">
                    <span className="yd-avatar">A</span>
                    <div>
                      <strong>Alex, {person.age} år</strong>
                      <p>{person.area} · Svenska och engelska</p>
                    </div>
                  </div>
                  <h4>Presentation</h4>
                  <p>{person.bio}</p>
                  <h4>Erfarenhet & CV</h4>
                  <p>
                    {person.experience || "Ungdomsledare i idrottsförening"}.
                    Gymnasiestudier.
                  </p>
                  <h4>Tillgänglighet & start</h4>
                  <p>
                    {data.availability.join(", ")} · {data.start}
                  </p>
                  {data.note && (
                    <>
                      <h4>Din hälsning</h4>
                      <p>{data.note}</p>
                    </>
                  )}
                  {data.answer && (
                    <>
                      <h4>{job.question}</h4>
                      <p>{data.answer}</p>
                    </>
                  )}
                  {overlay === "review" && (
                    <label className="yd-check">
                      <input
                        type="checkbox"
                        checked={consent}
                        onChange={(e) => setConsent(e.target.checked)}
                      />
                      Jag vill dela det här fiktiva underlaget med
                      demoföretaget.
                    </label>
                  )}
                </div>
              );
            })()}
          {overlay === "withdraw" && (
            <div className="yd-withdraw">
              <p>
                Din ansökan till <strong>{job.company}</strong> markeras som
                tillbakadragen i demon. Den finns kvar i historiken.
              </p>
              <button className="yd-primary" onClick={withdraw}>
                Ja, dra tillbaka demoansökan
              </button>
              <button className="yd-secondary" onClick={() => setOverlay(null)}>
                Behåll ansökan
              </button>
            </div>
          )}
          {overlay === "cv" && (
            <div className="yd-cv">
              <span className="yd-kicker">CV</span>
              <h3>Alex</h3>
              <p>
                {profile.age} år · {profile.area}
              </p>
              <h4>Om mig</h4>
              <p>{profile.bio}</p>
              <h4>Erfarenhet</h4>
              <p>
                {profile.experience ||
                  "Ungdomsledare i idrottsförening. Hjälper till med aktiviteter och möter barn och föräldrar."}
              </p>
              <h4>Utbildning</h4>
              <p>Gymnasiestudier</p>
              <h4>Språk</h4>
              <p>Svenska och engelska</p>
              <h4>Tillgänglighet</h4>
              <p>{profile.availability.join(", ") || "Inte vald"}</p>
            </div>
          )}
        </Sheet>
      )}
    </div>
  );
}
