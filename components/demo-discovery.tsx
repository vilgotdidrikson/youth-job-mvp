"use client";

import { useEffect, useRef, useState } from "react";
import {
  demoProfileQuestions as questions,
  buildDemoProfile,
  type DemoProfile,
  type YouthJob,
} from "@/lib/youth-demo-data";

export function DemoIcon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    jobs: "m4 7 7-4 9 4v13H4V7Zm4 4h8m-8 4h5",
    map: "m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2V5Zm6-2v16m6-14v16",
    applications: "M7 4h13v17H7V4Zm-3 0v14m7-9h5m-5 4h5m-5 4h3",
    chat: "M21 11a9 8 0 0 1-9 8H7l-4 3v-6a8 8 0 0 1 9-13 9 8 0 0 1 9 8Z",
    profile: "M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-2a8 7 0 0 1 16 0v2",
  };
  return (
    <svg
      width="23"
      height="23"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] || paths.jobs} />
    </svg>
  );
}

export function DemoSwipe({
  jobs,
  saved,
  excluded,
  skipped,
  onSkip,
  onSave,
  onOpen,
  onApply,
  onReset,
}: {
  jobs: YouthJob[];
  saved: string[];
  excluded: string[];
  skipped: string[];
  onSkip: (id: string) => void;
  onSave: (id: string) => void;
  onOpen: (id: string) => void;
  onApply: (id: string) => void;
  onReset: () => void;
}) {
  const [drag, setDrag] = useState(0);
  const start = useRef<{ x: number; y: number } | null>(null);
  const remaining = jobs.filter(
    (j) => !skipped.includes(j.id) && !excluded.includes(j.id),
  );
  const current = remaining[0];
  function decide(direction: "left" | "right") {
    setDrag(0);
    start.current = null;
    if (!current) return;
    if (direction === "right") onApply(current.id);
    else onSkip(current.id);
  }
  if (!current)
    return (
      <div className="yd-deck-empty">
        <span>✓</span>
        <h3>Du är ikapp!</h3>
        <button
          className="yd-primary"
          onClick={() => {
            onReset();
          }}
        >
          Visa jobben igen
        </button>
      </div>
    );
  return (
    <div className="yd-discovery">
      <div className="yd-deck-count">
        Stockholm <span>{remaining.length} jobb att upptäcka</span>
      </div>
      <div className="yd-deck">
        <div className="yd-deck-back" />
        <article
          className={`yd-swipe-card ${current.tone}`}
          style={{ transform: `translateX(${drag}px) rotate(${drag / 25}deg)` }}
          onPointerDown={(e) => {
            if ((e.target as HTMLElement).closest("button")) return;
            start.current = { x: e.clientX, y: e.clientY };
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (start.current && Math.abs(e.clientY - start.current.y) < 80)
              setDrag(e.clientX - start.current.x);
          }}
          onPointerUp={() => {
            if (Math.abs(drag) > 75) decide(drag > 0 ? "right" : "left");
            else {
              setDrag(0);
              start.current = null;
            }
          }}
          onPointerCancel={() => {
            setDrag(0);
            start.current = null;
          }}
        >
          <div className={`yd-swipe-art ${current.tone}`}>
            <span className="yd-job-type">{current.category}</span>
            <strong aria-hidden="true">{current.mark}</strong>
            <span className="yd-swipe-location">
              {current.area} · Stockholm
            </span>
            <button
              className="yd-save"
              aria-label={`${saved.includes(current.id) ? "Ta bort sparat jobb" : "Spara jobb"}: ${current.title}`}
              aria-pressed={saved.includes(current.id)}
              onClick={() => onSave(current.id)}
            >
              {saved.includes(current.id) ? "♥" : "♡"}
            </button>
            {Math.abs(drag) > 25 && (
              <span className={`yd-swipe-stamp ${drag < 0 ? "skip" : ""}`}>
                {drag > 0 ? "ANSÖK" : "NÄSTA"}
              </span>
            )}
          </div>
          <div className="yd-swipe-info">
            <span>{current.company}</span>
            <h3>{current.title}</h3>
            <div className="yd-tags">
              <span>{current.hours}</span>
              <span>{current.age}</span>
            </div>
            <p>{current.description}</p>
            <button className="yd-text" onClick={() => onOpen(current.id)}>
              Läs om jobbet →
            </button>
          </div>
        </article>
      </div>
      <div className="yd-swipe-actions">
        <button onClick={() => decide("left")} aria-label="Hoppa över jobbet">
          <span>×</span>Nästa
        </button>
        <button
          className="yd-swipe-apply"
          onClick={() => decide("right")}
          aria-label="Ansök till jobbet"
        >
          <span>✓</span>Ansök
        </button>
      </div>
      <div className="yd-swipe-hint">
        ← Nästa jobb <span>Svep för att välja</span> Ansök →
      </div>
    </div>
  );
}

export function DemoProfileBuilder({
  profile,
  answers,
  onAnswer,
  onComplete,
  onRestart,
}: {
  profile: DemoProfile;
  answers: string[];
  onAnswer: (answer: string) => void;
  onComplete: (profile: DemoProfile) => void;
  onRestart: () => void;
}) {
  const log = useRef<HTMLDivElement>(null);
  const complete = answers.length === questions.length;
  useEffect(() => {
    log.current?.scrollTo({
      top: log.current.scrollHeight,
      behavior: "instant",
    });
  }, [answers.length]);
  const built = buildDemoProfile(profile, answers);
  return (
    <section className="yd-builder">
      <header>
        <span className="yd-ai-avatar">✦</span>
        <div>
          <h3>Din profilassistent</h3>
          <small>
            Simulerad AI · {Math.min(answers.length + 1, 4)} av 4 frågor
          </small>
        </div>
        <button className="yd-text" onClick={onRestart}>
          Börja om
        </button>
      </header>
      <div
        className="yd-builder-log"
        ref={log}
        role="log"
        aria-label="Profilbyggarchatt"
      >
        {questions
          .slice(0, Math.min(answers.length + 1, questions.length))
          .map((q, i) => (
            <div key={q.text}>
              <div className="yd-ai-bubble">{q.text}</div>
              {answers[i] && (
                <div className="yd-answer-bubble">{answers[i]}</div>
              )}
            </div>
          ))}
        {complete && (
          <>
            <div className="yd-ai-bubble">Klart! Här är din profil.</div>
            <article className="yd-built-profile">
              <h3>Alex, {built.age}</h3>
              <span>{built.area}</span>
              <p>{built.bio}</p>
              <div className="yd-tags">
                <span>{built.availability[0]}</span>
                <span>{built.strengths}</span>
              </div>
            </article>
          </>
        )}
      </div>
      <div className="yd-builder-options">
        {complete ? (
          <button className="yd-primary" onClick={() => onComplete(built)}>
            Använd min profil →
          </button>
        ) : (
          questions[answers.length].options.map((answer) => (
            <button key={answer} onClick={() => onAnswer(answer)}>
              {answer}
              <span>→</span>
            </button>
          ))
        )}
      </div>
    </section>
  );
}
