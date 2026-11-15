"use client";

import Image from "next/image";
import { YouthDemo } from "@/components/youth-demo";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { demoJobs, demoCandidates } from "@/lib/demo-data";
import type { Audience } from "@/lib/prelaunch";

type View = "ads" | "candidates" | "chat";
type Ad = { id: string; title: string; hours: string; description: string; active: boolean; candidates: string[] };
type Message = { own: boolean; text: string };
const initialAds: Ad[] = [
  { id: "coffee-ad", title: "Cafémedarbetare", hours: "Helger & efter skolan", description: demoJobs[0].description, active: true, candidates: ["alex", "sam", "kim"] },
  { id: "weekend-ad", title: "Helgpersonal till caféet", hours: "Lördag & söndag", description: "Vi söker en kollega till vårt helgteam.", active: true, candidates: ["sam", "kim"] },
];
const navLabels: Record<View, string> = { ads: "Mina annonser", candidates: "Ansökningar", chat: "Meddelanden" };
const navIcons: Record<View, string> = { ads: "▤", candidates: "◎", chat: "◌" };

export function PrelaunchDemo() {
  const [youthReset, setYouthReset] = useState(0);
  const [role, setRole] = useState<Audience>("youth");
  const [view, setView] = useState<View>("ads");
  const [ads, setAds] = useState<Ad[]>(initialAds);
  const [selectedAd, setSelectedAd] = useState("coffee-ad");
  const [selectedCandidate, setSelectedCandidate] = useState("alex");
  const [candidateTab, setCandidateTab] = useState<"application" | "cv">("application");
  const [editingAd, setEditingAd] = useState(false);
  const [chatId, setChatId] = useState("cafe");
  const [threads, setThreads] = useState<Record<string, Message[]>>({});
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState("");
  const ad = ads.find(a => a.id === selectedAd) ?? ads[0];
  const candidate = demoCandidates.find(c => c.id === selectedCandidate) ?? demoCandidates[0];
  const menus: View[] = ["ads", "candidates", "chat"];
  const conversationItems = demoCandidates.map(c => ({ id: c.id, name: c.name, sub: "Cafémedarbetare" }));
  const conversation = conversationItems.find(c => c.id === chatId) ?? conversationItems[0];
  const threadKey = `${role}:${conversation.id}`;
  const messages = threads[threadKey] ?? [{ own: false, text: role === "youth" ? "Hej! Vad roligt att du är intresserad. Vilka dagar skulle du kunna jobba?" : "Hej! Jag är intresserad av jobbet och berättar gärna mer om mig själv." }];
  function changeView(next: View) { setView(next); setEditingAd(false); setNotice(""); }
  function changeRole(next: Audience) { setRole(next); changeView("ads"); setChatId("alex"); }
  function openChat(id: string) { changeView("chat"); setChatId(id); setDraft(""); }
  function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!draft.trim()) return;
    setThreads(current => ({ ...current, [threadKey]: [...messages, { own: true, text: draft.trim() }] })); setDraft("");
  }
  function simulateReply() {
    setThreads(current => ({ ...current, [threadKey]: [...messages, { own: false, text: role === "youth" ? "Tack! Det låter bra. Ska vi höras för ett kort samtal och prata mer om jobbet?" : "Absolut, jag berättar gärna mer. Jag kan ta ett kort samtal efter skolan." }] }));
  }
  function createAd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget); const id = `demo-ad-${ads.length + 1}`;
    setAds(current => [...current, { id, title: String(data.get("title")).trim(), hours: String(data.get("hours")).trim(), description: String(data.get("description")).trim(), active: true, candidates: [] }]);
    setSelectedAd(id); setEditingAd(false); setNotice("Din demoannons är publicerad i testmiljön. Ingen riktig annons har skapats.");
  }
  function reset() { setYouthReset(current => current + 1); setThreads({}); setAds(initialAds); setSelectedAd("coffee-ad"); setSelectedCandidate("alex"); setDraft(""); setCandidateTab("application"); changeRole("youth"); setNotice("Demon har återställts."); }
  return <main className="dx-page">
    <header className="dx-top"><Link href="/" className="dx-logo"><Image src="/brand/matchnwork-logo.png" alt="" width={36} height={36} /><span>matchnwork<span>.</span></span></Link><Link href="/">Till intresseanmälan ↗</Link></header>
    <section className="dx-intro"><div><span className="dx-eyebrow">LÄR KÄNNA MATCHNWORK</span><h1>En liten demo.<br /><em>Många möjligheter.</em></h1><p>Utforska, testa och klicka dig fram. Här får du känna på båda sidor av MatchnWork.</p></div><div className="dx-role-picker"><span>Vilken sida vill du prova?</span><div role="group" aria-label="Välj demovy"><button aria-pressed={role === "youth"} onClick={() => changeRole("youth")}>Jag söker jobb <span>↗</span></button><button aria-pressed={role === "company"} onClick={() => changeRole("company")}>Vi söker personal <span>↗</span></button></div></div></section>
    <section className="dx-shell" aria-label="Interaktiv MatchnWork-demo">
      <div className="dx-demo-banner"><span><i /> DEMOLÄGE · Fiktiva jobb och personer. Inget skickas till någon.</span><button onClick={reset}>Återställ demo ↺</button></div>
      {role === "youth" ? <YouthDemo key={youthReset} /> : <div className="dx-app"><aside className="dx-sidebar"><div className="dx-account"><span className="dx-avatar peach">K</span><div><strong>Kvarterskaffet</strong><span>Företagskonto · Demo</span></div></div><nav aria-label="Demonavigation">{menus.map(item => <button key={item} aria-current={view === item ? "page" : undefined} onClick={() => changeView(item)}><span>{navIcons[item]}</span>{navLabels[item]}</button>)}</nav><div className="dx-sidebar-note"><span>✳</span><p>Skapa en demoannons, öppna en ansökan och testa att ta kontakt.</p></div></aside>
      <div className="dx-main"><div className="dx-section-heading"><div><span className="dx-eyebrow">HEJ KVARTERSKAFFET</span><h2>{navLabels[view]}</h2></div><span className="dx-mode-label">Företagsvy</span></div><div className="dx-notice" role="status" aria-live="polite">{notice}</div>
      {view === "ads" && <><div className="dx-company-summary"><div><span>Aktiva demoannonser</span><strong>{ads.filter(a => a.active).length.toString().padStart(2,"0")}</strong></div><div><span>Exempelansökningar</span><strong>{ads.reduce((sum,a) => sum + a.candidates.length,0).toString().padStart(2,"0")}</strong></div><button className="dx-primary" onClick={() => setEditingAd(!editingAd)}>{editingAd ? "Stäng formuläret" : "+ Skapa demoannons"}</button></div>{editingAd && <form className="dx-ad-form" onSubmit={createAd}><h3>Vad söker ni för kollega?</h3><div><label>Jobbtitel<input name="title" placeholder="Exempelvis cafémedarbetare" required minLength={2} maxLength={80} /></label><label>Arbetstider<input name="hours" placeholder="Exempelvis helger" required maxLength={100} /></label></div><label>Om jobbet<textarea name="description" placeholder="Berätta vad jobbet innebär…" rows={3} required minLength={10} maxLength={800} /></label><p>Annonsen finns bara i din demo och får inga riktiga ansökningar.</p><button className="dx-primary">Publicera demoannons ↗</button></form>}<div className="dx-ad-list">{ads.map(a => <article className="dx-ad-row" key={a.id}><div className="dx-ad-initial">k.</div><div><span className={`dx-status ${!a.active ? "paused" : ""}`}>{a.active ? "Aktiv demoannons" : "Pausad demoannons"}</span><h3>{a.title}</h3><p>{a.hours} · {a.candidates.length} exempelansökningar</p><p className="dx-ad-description">{a.description}</p></div><div className="dx-ad-actions"><button className="dx-secondary" onClick={() => { setSelectedAd(a.id); setSelectedCandidate(a.candidates[0] || "alex"); setCandidateTab("application"); changeView("candidates"); }}>Visa ansökningar →</button><button className="dx-text" onClick={() => { setAds(current => current.map(item => item.id === a.id ? { ...item, active: !item.active } : item)); setNotice(a.active ? "Demoannonsen är pausad." : "Demoannonsen är aktiv igen."); }}>{a.active ? "Pausa" : "Återaktivera"}</button></div></article>)}</div></>}
      {view === "candidates" && <><div className="dx-candidate-toolbar"><label>Ansökningar till <select value={selectedAd} onChange={e => { const a = ads.find(a => a.id === e.target.value)!; setSelectedAd(a.id); setSelectedCandidate(a.candidates[0] || "alex"); setCandidateTab("application"); }}>{ads.map(a => <option key={a.id} value={a.id}>{a.title}</option>)}</select></label><span>{ad.candidates.length} fiktiva ansökningar</span></div>{ad.candidates.length === 0 ? <div className="dx-empty"><span>◎</span><h3>Din demoannons är redo.</h3><p>Det finns inga ansökningar till den här annonsen. Välj en av exempelannonserna för att prova kandidatvyn.</p></div> : <div className="dx-candidate-layout"><div className="dx-candidate-list">{demoCandidates.filter(c => ad.candidates.includes(c.id)).map(c => <button key={c.id} className={c.id === selectedCandidate ? "selected" : ""} onClick={() => { setSelectedCandidate(c.id); setCandidateTab("application"); }}><span className={`dx-avatar ${c.color}`}>{c.name[0]}</span><span><strong>{c.name}, {c.age} år</strong><small>{c.area}</small><span>{c.availability}</span></span><b>↗</b></button>)}</div><article className="dx-candidate-detail"><div className="dx-candidate-title"><span className={`dx-portrait ${candidate.color}`}>{candidate.name[0]}</span><div><span className="dx-eyebrow">ANSÖKAN · {ad.title}</span><h3>{candidate.name}, {candidate.age} år</h3><p>{candidate.area}</p></div></div><div className="dx-detail-tabs" role="group" aria-label="Kandidatunderlag"><button aria-pressed={candidateTab === "application"} onClick={() => setCandidateTab("application")}>Ansökan & underlag</button><button aria-pressed={candidateTab === "cv"} onClick={() => setCandidateTab("cv")}>Visa demo-CV</button></div>{candidateTab === "application" ? <><h4 className="dx-candidate-quote">{candidate.title}</h4><p>{candidate.bio}</p><dl><div><dt>Tillgänglighet</dt><dd>{candidate.availability}</dd></div><div><dt>Språk</dt><dd>{candidate.languages}</dd></div></dl><section className="dx-evidence"><span className="dx-eyebrow">UNDERLAG TILL ER BEDÖMNING</span><p><strong>Det som framgår</strong>{candidate.evidence}</p><p><strong>Att följa upp</strong>{candidate.unknown}</p><small>Fiktivt exempel på beslutsstöd. Företaget gör alltid bedömningen.</small></section></> : <section className="dx-cv"><span>DEMO-CV</span><h4>{candidate.name}</h4><h5>Presentation</h5><p>{candidate.bio}</p><h5>Erfarenhet</h5><p>{candidate.experience}</p><h5>Utbildning</h5><p>{candidate.education}</p><h5>Språk & tillgänglighet</h5><p>{candidate.languages}<br />{candidate.availability}</p></section>}<button className="dx-primary" onClick={() => openChat(candidate.id)}>Prova att ta kontakt <span>↗</span></button></article></div>}</>}
      {view === "chat" && <div className="dx-chat-layout"><div className="dx-threads">{conversationItems.map(item => <button key={item.id} className={conversation.id === item.id ? "selected" : ""} onClick={() => { setChatId(item.id); setDraft(""); }}><span className="dx-avatar peach">{item.name[0]}</span><span><strong>{item.name}</strong><small>{item.sub}</small></span></button>)}</div><section className="dx-chat"><header><span className="dx-avatar lilac">{conversation.name[0]}</span><div><h3>{conversation.name}</h3><span>Demokonversation · ingen riktig mottagare</span></div></header><div className="dx-chat-messages" role="log" aria-label="Demomeddelanden">{messages.map((message,i) => <div className={`dx-message ${message.own ? "own" : ""}`} key={i}><span>{message.own ? "Du" : "Fiktiv mottagare"}</span><p>{message.text}</p></div>)}</div><button className="dx-example-reply" onClick={simulateReply}>Visa ett exempelsvar från mottagaren ↳</button><form onSubmit={sendMessage}><label className="dx-sr-only" htmlFor="demo-message">Ditt demomeddelande</label><input id="demo-message" value={draft} onChange={e => setDraft(e.target.value)} placeholder="Skriv ett demomeddelande…" maxLength={500} required /><button disabled={!draft.trim()} className="dx-primary">Skicka <span>↑</span></button></form></section></div>}
      </div></div>}
    </section><footer className="dx-footer"><span>Det här är en förenklad förhandstitt. Dina demoändringar försvinner när sidan laddas om.</span><Link href="/">Var med när vi öppnar ↗</Link></footer>
  </main>;
}
