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
  youthJobs,
  type DemoProfile,
} from "@/lib/youth-demo-data";

type Tab = "jobs" | "saved" | "applications" | "chat" | "profile";
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
type Message = { own: boolean; text: string };
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
  jobs: "Hitta jobb",
  saved: "Sparade",
  applications: "Ansökningar",
  chat: "Chatt",
  profile: "Min profil",
};
const icons: Record<Tab, string> = {
  jobs: "⌖",
  saved: "♡",
  applications: "↗",
  chat: "◌",
  profile: "◎",
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
  const [saved, setSaved] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState(emptyYouthFilters);
  const [profile, setProfile] = useState(initialYouthProfile);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [applications, setApplications] = useState<Application[]>([]);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [selected, setSelected] = useState("cafe");
  const [consent, setConsent] = useState(false);
  const [applicationFilter, setApplicationFilter] = useState("Alla");
  const [threadId, setThreadId] = useState("cafe");
  const [threads, setThreads] = useState<Record<string, Message[]>>({});
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
  }, [tab, threads, threadId]);
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
    setNotice(`Din demoansökan till ${job.company} är skickad.`);
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
            text: "Hej Alex! Vi har läst din demoansökan och vill gärna veta mer. När skulle du kunna ta ett kort samtal?",
          },
        ],
      }));
    }
  }
  function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!message.trim()) return;
    setThreads((current) => ({
      ...current,
      [chatJob.id]: [
        ...(current[chatJob.id] ?? messages),
        { own: true, text: message.trim() },
      ],
    }));
    setMessage("");
  }
  function book(slot: string) {
    setApplications((current) =>
      current.map((a) => (a.jobId === chatJob.id ? { ...a, slot } : a)),
    );
    setThreads((current) => ({
      ...current,
      [chatJob.id]: [
        ...(current[chatJob.id] ?? messages),
        {
          own: true,
          text: `Jag väljer ${slot.toLowerCase()} för demosamtalet.`,
        },
        {
          own: false,
          text: `Då säger vi ${slot.toLowerCase()}! Detta är en fiktiv bokning och hamnar inte i någon kalender.`,
        },
      ],
    }));
    setNotice(`Demosamtal valt: ${slot}. Ingen riktig bokning görs.`);
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
      {(Object.keys(labels) as Tab[]).map((item) => (
        <button
          key={item}
          aria-current={tab === item ? "page" : undefined}
          onClick={() => go(item)}
        >
          <span aria-hidden="true">{icons[item]}</span>
          <span>{labels[item]}</span>
          {item === "saved" && saved.length > 0 && <b>{saved.length}</b>}
          {item === "applications" && activeApplications.length > 0 && (
            <b>{activeApplications.length}</b>
          )}
        </button>
      ))}
    </nav>
  );
  return (
    <div className="yd-app">
      <aside className="yd-sidebar">
        <div className="yd-user">
          <span className="yd-avatar">A</span>
          <div>
            <strong>Alex, {profile.age} år</strong>
            <small>Din fiktiva demoprofil</small>
          </div>
        </div>
        {nav}
        <p className="yd-sidebar-note">
          Prova hela vägen från ett jobb du gillar till ett första samtal.
        </p>
      </aside>
      <section className="yd-main" aria-label="Ungdomsvy">
        <div className="yd-heading">
          <div>
            <span className="yd-kicker">
              {tab === "jobs" ? "DITT NÄSTA STEG" : "DIN DEMO"}
            </span>
            <h2>{tab === "jobs" ? "Hitta något som är du." : labels[tab]}</h2>
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
        {(tab === "jobs" || tab === "saved") && (
          <>
            {tab === "jobs" && (
              <>
                <p className="yd-lead">
                  Extrajobb, sommarjobb och nya möjligheter i Stockholm.
                </p>
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
            <div className="yd-result-heading">
              <span>
                {visibleJobs.length}{" "}
                {tab === "saved" ? "sparade jobb" : "exempeljobb"}
              </span>
              {tab === "jobs" && filterCount > 0 && (
                <button
                  onClick={() => {
                    setFilters(emptyYouthFilters);
                    setSearch("");
                  }}
                >
                  Rensa filter
                </button>
              )}
              {tab === "saved" && <span>Tryck på hjärtat för att ta bort</span>}
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
                      <span aria-hidden="true">↗</span>
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
                          ? "Tidigare demoansökan"
                          : "✓ Du har ansökt i demon"}
                      </span>
                    )}
                    {drafts[item.id] &&
                      !applications.some((a) => a.jobId === item.id) && (
                        <span className="yd-card-status">
                          Påbörjad demoansökan
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
        {tab === "applications" && (
          <>
            <p className="yd-lead">
              Följ dina demoansökningar och prova vad som kan hända sedan.
            </p>
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
                  <p>Ditt utkast finns kvar under det här demobesöket.</p>
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
                            ? "Demosamtal valt"
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
                  {a.slot && <p>◷ Demosamtal: {a.slot}</p>}
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
                        Prova ett företagssvar →
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
                      Dra tillbaka demoansökan
                    </button>
                  )}
                </article>
              );
            })}
            {filteredApplications.length === 0 && shownDrafts.length === 0 && (
              <div className="yd-empty">
                <span>↗</span>
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
        {tab === "profile" && (
          <>
            <div className="yd-profile-banner">
              <span className="yd-avatar">A</span>
              <div>
                <h3>Alex</h3>
                <p>Fiktiv profil · ändras bara i din demo</p>
              </div>
              <button className="yd-secondary" onClick={() => setOverlay("cv")}>
                Visa demo-CV
              </button>
            </div>
            <form
              className="yd-profile-form"
              onSubmit={(e) => {
                e.preventDefault();
                setNotice(
                  "Din demoprofil är uppdaterad. Nya demoansökningar använder uppgifterna du ser här.",
                );
              }}
            >
              <div className="yd-field-grid">
                <label>
                  Ålder i demon
                  <select
                    value={profile.age}
                    onChange={(e) =>
                      setProfile((current) => ({
                        ...current,
                        age: Number(e.target.value),
                      }))
                    }
                  >
                    {[15, 16, 17, 18, 19, 20, 21, 22, 23].map((age) => (
                      <option key={age} value={age}>
                        {age} år
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Ort / område
                  <select
                    value={profile.area}
                    onChange={(e) =>
                      setProfile((current) => ({
                        ...current,
                        area: e.target.value,
                      }))
                    }
                  >
                    {[...new Set(youthJobs.map((j) => j.area))].map((area) => (
                      <option key={area}>{area}</option>
                    ))}
                  </select>
                </label>
              </div>
              <fieldset>
                <legend>När kan du jobba?</legend>
                <div className="yd-choice-grid">
                  {["Helger", "Kvällar", "Efter skolan", "Sommar"].map(
                    (value) => (
                      <label key={value}>
                        <input
                          type="checkbox"
                          checked={profile.availability.includes(value)}
                          onChange={(e) =>
                            setProfile((current) => ({
                              ...current,
                              availability: e.target.checked
                                ? [...current.availability, value]
                                : current.availability.filter(
                                    (x) => x !== value,
                                  ),
                            }))
                          }
                        />
                        {value}
                      </label>
                    ),
                  )}
                </div>
              </fieldset>
              <label>
                Presentation
                <textarea
                  value={profile.bio}
                  maxLength={500}
                  rows={4}
                  onChange={(e) =>
                    setProfile((current) => ({
                      ...current,
                      bio: e.target.value,
                    }))
                  }
                />
              </label>
              <div className="yd-profile-facts">
                <h4>Erfarenhet & språk</h4>
                <p>Ungdomsledare i idrottsförening · Gymnasiestudier</p>
                <p>Svenska och engelska</p>
              </div>
              <button className="yd-primary">Bekräfta demoprofil</button>
              <p className="yd-small">
                Prova gärna med olika åldrar och arbetstider. Skriv inga riktiga
                personuppgifter i demon.
              </p>
            </form>
          </>
        )}
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
                    <small>{j.title}</small>
                  </span>
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
                  <p>Fiktiv mottagare · {chatJob.title}</p>
                </div>
              </header>
              <div
                ref={logRef}
                className="yd-message-log"
                role="log"
                aria-label="Demomeddelanden"
              >
                {messages.map((entry, i) => (
                  <div
                    key={i}
                    className={`yd-message ${entry.own ? "own" : ""}`}
                  >
                    <small>{entry.own ? "Du" : chatJob.company}</small>
                    <p>{entry.text}</p>
                  </div>
                ))}
              </div>
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
              <button
                className="yd-text yd-example"
                onClick={() =>
                  setThreads((current) => ({
                    ...current,
                    [chatJob.id]: [
                      ...(current[chatJob.id] ?? messages),
                      {
                        own: false,
                        text: "Tack för ditt svar! Vi berättar gärna mer och kan ta ett kort samtal. Välj en av demotiderna nedan om du vill prova nästa steg.",
                      },
                    ],
                  }))
                }
              >
                Visa ett exempelsvar från företaget ↳
              </button>
              <form onSubmit={sendMessage}>
                <label className="dx-sr-only" htmlFor="yd-message">
                  Ditt demomeddelande
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
                  disabled={!message.trim()}
                  aria-label="Skicka demomeddelande"
                >
                  ↑
                </button>
              </form>
              {applications.some(
                (a) => a.jobId === chatJob.id && a.status === "contact",
              ) && (
                <div className="yd-slots">
                  <strong>Prova att välja ett demosamtal</strong>
                  <p>Fiktiva tider – ingen kalenderbokning görs.</p>
                  {["Tisdag 16.30", "Onsdag 17.00"].map((slot) => (
                    <button
                      key={slot}
                      className="yd-secondary"
                      aria-pressed={applications.some(
                        (a) => a.jobId === chatJob.id && a.slot === slot,
                      )}
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
                ? "Alex · Demo-CV"
                : overlay === "withdraw"
                  ? "Dra tillbaka demoansökan?"
                  : overlay === "review"
                    ? "Granska din demoansökan"
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
                    Visa min demoansökan →
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
                        : "Ansök i demon →"}
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
                  Skicka demoansökan ↗
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
                  <dd>Inte angiven i exemplet – fråga företaget.</dd>
                </div>
              </dl>
              <p className="yd-small">
                Fiktiv annons. En riktig ansökan skickas aldrig från den här
                demon.
              </p>
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
              <p className="yd-small">
                Valen gäller bara de fiktiva jobben i demon.
              </p>
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
              <p>
                Du söker med Alex demoprofil. Ditt utkast finns kvar om du
                stänger vyn.
              </p>
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
                  placeholder="Ett kort svar räcker i demon."
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
                  <p>Ungdomsledare i idrottsförening. Gymnasiestudier.</p>
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
                  <h4>{job.question}</h4>
                  <p>{data.answer}</p>
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
                  <p className="yd-small">
                    Inga riktiga uppgifter skickas. I en inskickad demoansökan
                    ligger den profilversion kvar som användes när du skickade.
                  </p>
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
              <span className="yd-kicker">FIKTIVT CV</span>
              <h3>Alex</h3>
              <p>
                {profile.age} år · {profile.area}
              </p>
              <h4>Om mig</h4>
              <p>{profile.bio}</p>
              <h4>Erfarenhet</h4>
              <p>
                Ungdomsledare i idrottsförening. Hjälper till med aktiviteter
                och möter barn och föräldrar.
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
