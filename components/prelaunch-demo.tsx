"use client";
import { useState } from "react";
import type { Audience } from "@/lib/prelaunch";

const jobs = [
  { title: "Ditt nästa steg? En kaffe med oss.", company: "Kvarterskaffet", place: "Södermalm, Stockholm", category: "Café & service", symbol: "K.", color: "cafe", hours: "Helger & efter skolan", description: "Gillar du människor, doften av nybakat och att få saker att hända? Hjälp till i kassan, servera kaffe och bli en del av ett litet team.", tags: ["Från 16 år", "Ingen erfarenhet krävs"] },
  { title: "Gör vardagen lite grönare.", company: "Gröna Hörnet", place: "Vasastan, Stockholm", category: "Butik", symbol: "g.", color: "green", hours: "Eftermiddagar & helger", description: "Vi söker en nyfiken kollega som vill möta kunder och hålla fint i vår växtbutik. Du får lära dig på plats.", tags: ["Från 16 år", "Deltid"] },
  { title: "Bli en del av matchdagen.", company: "Stadens Sportklubb", place: "Nacka, Stockholm", category: "Event & förening", symbol: "S.", color: "blue", hours: "Kvällar & helger", description: "Hjälp oss skapa bra upplevelser på våra matcher. Du möter besökare, hjälper till i kiosken och jobbar tillsammans med andra unga.", tags: ["Från 15 år", "Extrajobb"] },
];
const candidates = [
  { name: "Alex", age: 18, initial: "A", place: "Södermalm", headline: "Bra service börjar med ett hej.", bio: "Jag går sista året på gymnasiet och söker ett extrajobb där jag får träffa människor. Jag är van att ta ansvar som ledare i min förening.", tags: ["Svenska & engelska", "Helger & kvällar"], evidence: "Har erfarenhet av att möta människor genom föreningsarbete. Kan arbeta de helger ni söker personal." },
  { name: "Sam", age: 17, initial: "S", place: "Årsta", headline: "Nyfiken, noggrann och redo att lära.", bio: "Jag söker mitt första jobb och gillar att samarbeta. På fritiden tränar jag och hjälper till på skolans evenemang.", tags: ["Svenska & engelska", "Efter skolan"], evidence: "Beskriver samarbete vid skolevenemang. Tidigare kassavana är inte angiven och behöver följas upp." },
];

export function PrelaunchDemo({ role, setRole }: { role: Audience; setRole: (role: Audience) => void }) {
  const [index, setIndex] = useState(0);
  const [applied, setApplied] = useState<number[]>([]);
  const [view, setView] = useState<"card" | "profile" | "chat">("card");
  const [messages, setMessages] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const job = jobs[index % jobs.length];
  const candidate = candidates[index % candidates.length];
  function switchRole(next: Audience) { setRole(next); setView("card"); setIndex(0); setMessages([]); }
  return <div className="pl-demo" id="demo">
    <div className="pl-demo-top"><span className="pl-demo-live"><i /> Testa själv</span><span>Interaktiv demo</span></div>
    <div className="pl-switch" aria-label="Välj demovy"><button type="button" aria-pressed={role === "youth"} onClick={() => switchRole("youth")}>Jag söker jobb</button><button type="button" aria-pressed={role === "company"} onClick={() => switchRole("company")}>Vi söker personal</button></div>
    <div className="pl-demo-screen">
      <div className="pl-appbar"><span>matchnwork<span className="pl-brand-dot">.</span></span><span className="pl-avatar">{role === "youth" ? "A" : "K"}</span></div>
      {view === "chat" ? <div className="pl-chat"><button className="pl-text-button" onClick={() => setView("card")}>← Tillbaka</button><h3>{role === "youth" ? job.company : candidate.name}</h3><span className="pl-small">Demochatt · inget skickas till någon</span><div className="pl-messages"><p className="pl-bubble">Hej! Vad roligt att du är intresserad. När skulle du kunna börja?</p>{messages.map((text, i) => <p className="pl-bubble pl-bubble-own" key={i}>{text}</p>)}</div><form onSubmit={e => { e.preventDefault(); if (draft.trim()) { setMessages([...messages, draft.trim()]); setDraft(""); } }} className="pl-chat-form"><input value={draft} onChange={e => setDraft(e.target.value)} maxLength={300} placeholder="Skriv ett demosvar…" aria-label="Demomeddelande" required /><button aria-label="Skicka demosvar">↑</button></form></div>
      : role === "youth" ? <><div className={`pl-job-art ${job.color}`}><span className="pl-job-category">{job.category}</span><span className="pl-job-symbol" aria-hidden="true">{job.symbol}</span><span className="pl-art-caption">Människor. Möjligheter. Ditt nästa steg.</span><div className="pl-art-ring" /></div><div className="pl-card-copy"><div className="pl-card-kicker">{job.company} <span>↗</span></div><h3>{job.title}</h3><p className="pl-small">⌖ {job.place}</p><div className="pl-tags">{job.tags.map(x => <span key={x}>{x}</span>)}</div><p className="pl-description">{job.description}</p><p className="pl-hours">◷ {job.hours}</p>{applied.includes(index % jobs.length) ? <div className="pl-applied" role="status"><strong>✓ Demoansökan skickad</strong><p>Här skulle du kunna följa din ansökan.</p><button onClick={() => { setMessages([]); setView("chat"); }}>Prova chatten →</button></div> : <div className="pl-demo-actions"><button className="pl-skip" onClick={() => setIndex(index + 1)}>Nästa jobb →</button><button className="pl-apply" onClick={() => setApplied([...applied, index % jobs.length])}>Ansök <span>♡</span></button></div>}</div></>
      : <div className="pl-candidate"><div className="pl-candidate-heading"><span className="pl-person">{candidate.initial}</span><div><span className="pl-small">Ansökan till cafémedarbetare</span><h3>{candidate.name}, {candidate.age} år</h3><p className="pl-small">⌖ {candidate.place}</p></div></div><h4>{candidate.headline}</h4><div className="pl-tags">{candidate.tags.map(x => <span key={x}>{x}</span>)}</div><p className="pl-description">{candidate.bio}</p>{view === "profile" && <div className="pl-evidence"><strong>Underlag till er bedömning</strong><p>{candidate.evidence}</p><span>Exempel på beslutsstöd. Ni gör själva bedömningen.</span></div>}<div className="pl-candidate-tools"><button onClick={() => setView(view === "profile" ? "card" : "profile")}>{view === "profile" ? "Dölj underlag ↑" : "Se ansökningsunderlag ↓"}</button></div><div className="pl-demo-actions"><button className="pl-skip" onClick={() => { setIndex(index + 1); setView("card"); }}>Nästa kandidat →</button><button className="pl-apply" onClick={() => { setMessages([]); setView("chat"); }}>Prova chatten ↗</button></div></div>}
    </div>
    <div className="pl-demo-disclaimer"><span>✳</span> Fiktiva jobb och personer. Ingen riktig ansökan skickas.</div>
  </div>;
}

