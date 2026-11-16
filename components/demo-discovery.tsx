"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
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

function SwipeJobBody({
  job,
  saved,
  onSave,
  onOpen,
  disabled,
}: {
  job: YouthJob;
  saved: boolean;
  onSave?: () => void;
  onOpen?: () => void;
  disabled?: boolean;
}) {
  return (
    <>
      <div className={`yd-swipe-art ${job.tone}`}>
        <span className="yd-job-type">{job.category}</span>
        <strong aria-hidden="true">{job.mark}</strong>
        <span className="yd-swipe-location">{job.area} · Stockholm</span>
        {onSave && (
          <button
            className="yd-save"
            aria-label={`${saved ? "Ta bort sparat jobb" : "Spara jobb"}: ${job.title}`}
            aria-pressed={saved}
            onClick={onSave}
            disabled={disabled}
          >
            {saved ? "♥" : "♡"}
          </button>
        )}
      </div>
      <div className="yd-swipe-info">
        <span>{job.company}</span>
        <h3>{job.title}</h3>
        <div className="yd-tags">
          <span>{job.hours}</span>
          <span>{job.age}</span>
        </div>
        <p>{job.description}</p>
        {onOpen ? (
          <button className="yd-text" onClick={onOpen} disabled={disabled}>
            Läs om jobbet →
          </button>
        ) : (
          <span className="yd-card-preview-link">Läs om jobbet →</span>
        )}
      </div>
    </>
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
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const card = useRef<HTMLElement>(null);
  const nextCard = useRef<HTMLElement>(null);
  const stamp = useRef<HTMLSpanElement>(null);
  const animation = useRef<Animation | null>(null);
  const frame = useRef(0);
  const previousId = useRef<string | undefined>(undefined);
  const gesture = useRef<{
    x: number;
    y: number;
    offset: number;
    lastX: number;
    time: number;
    velocity: number;
  } | null>(null);
  const remaining = jobs.filter(
    (j) => !skipped.includes(j.id) && !excluded.includes(j.id),
  );
  const current = remaining[0];
  const reducedMotion = () =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function paint(x: number) {
    if (card.current) {
      card.current.style.transform = `translate3d(${x}px,0,0) rotate(${Math.max(-14, Math.min(14, x / 25))}deg)`;
      card.current.dataset.direction = x < 0 ? "left" : "right";
    }
    if (stamp.current)
      stamp.current.style.opacity = String(Math.min(1, Math.abs(x) / 100));
    if (nextCard.current)
      nextCard.current.style.transform = `translateY(${10 * (1 - Math.min(1, Math.abs(x) / 160))}px) scale(${0.96 + Math.min(1, Math.abs(x) / 160) * 0.04})`;
  }
  useLayoutEffect(() => {
    cancelAnimationFrame(frame.current);
    animation.current?.cancel();
    gesture.current = null;
    locked.current = false;
    setBusy(false);
    paint(0);
    if (card.current && previousId.current && !reducedMotion()) {
      animation.current = card.current.animate(
        [
          { transform: "translateY(8px) scale(.98)", opacity: 0.85 },
          { transform: "translateY(0) scale(1)", opacity: 1 },
        ],
        { duration: 180, easing: "cubic-bezier(.2,.8,.3,1)" },
      );
    }
    previousId.current = current?.id;
  }, [current?.id]);
  useEffect(
    () => () => {
      cancelAnimationFrame(frame.current);
      animation.current?.cancel();
    },
    [],
  );
  function settle(direction?: "left" | "right") {
    const node = card.current;
    if (!current || !node || locked.current) return;
    locked.current = true;
    setBusy(true);
    cancelAnimationFrame(frame.current);
    animation.current?.cancel();
    const x = gesture.current?.offset || 0;
    gesture.current = null;
    paint(x);
    const distance = direction
      ? (direction === "right" ? 1 : -1) *
        Math.max(window.innerWidth, node.clientWidth + 100)
      : 0;
    const motion = node.animate(
      [
        { transform: node.style.transform, opacity: 1 },
        {
          transform: `translate3d(${distance}px,${direction ? 35 : 0}px,0) rotate(${direction ? (direction === "right" ? 18 : -18) : 0}deg)`,
          opacity: direction ? 0 : 1,
        },
      ],
      {
        duration: reducedMotion() ? 0 : direction ? 280 : 260,
        easing: direction
          ? "cubic-bezier(.25,.7,.4,1)"
          : "cubic-bezier(.2,1.3,.4,1)",
        fill: "forwards",
      },
    );
    animation.current = motion;
    motion.onfinish = () => {
      if (direction === "right") onApply(current.id);
      else if (direction === "left") onSkip(current.id);
      locked.current = false;
      setBusy(false);
      // A rejected decision or a short drag returns the same card to rest.
      frame.current = requestAnimationFrame(() => {
        if (card.current === node) {
          motion.cancel();
          paint(0);
        }
      });
    };
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
        {remaining[1] ? (
          <article
            ref={nextCard}
            className={`yd-swipe-card yd-next-card ${remaining[1].tone}`}
            aria-hidden="true"
            inert
          >
            <SwipeJobBody
              job={remaining[1]}
              saved={saved.includes(remaining[1].id)}
            />
          </article>
        ) : (
          <div className="yd-deck-back" />
        )}
        <article
          key={current.id}
          ref={card}
          className={`yd-swipe-card yd-front-card ${current.tone}`}
          onPointerDown={(e) => {
            if (
              locked.current ||
              !e.isPrimary ||
              e.button !== 0 ||
              (e.target as HTMLElement).closest("button")
            )
              return;
            animation.current?.cancel();
            gesture.current = {
              x: e.clientX,
              y: e.clientY,
              offset: 0,
              lastX: e.clientX,
              time: e.timeStamp,
              velocity: 0,
            };
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            const start = gesture.current;
            if (!start) return;
            const dx = e.clientX - start.x,
              dy = e.clientY - start.y;
            if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) {
              gesture.current = null;
              paint(0);
              return;
            }
            start.velocity =
              (e.clientX - start.lastX) / Math.max(1, e.timeStamp - start.time);
            start.lastX = e.clientX;
            start.time = e.timeStamp;
            start.offset = dx;
            cancelAnimationFrame(frame.current);
            frame.current = requestAnimationFrame(() => paint(dx));
          }}
          onPointerUp={(e) => {
            const start = gesture.current;
            if (!start) return;
            const x = start.offset;
            const flick =
              Math.abs(x) > 30 &&
              Math.abs(start.velocity) > 0.55 &&
              e.timeStamp - start.time < 100;
            settle(
              Math.abs(x) > 85 || flick
                ? x > 0
                  ? "right"
                  : "left"
                : undefined,
            );
          }}
          onPointerCancel={() => {
            if (gesture.current && !locked.current) settle();
          }}
          onLostPointerCapture={() => {
            if (gesture.current && !locked.current) settle();
          }}
        >
          <SwipeJobBody
            job={current}
            saved={saved.includes(current.id)}
            onSave={() => onSave(current.id)}
            onOpen={() => onOpen(current.id)}
            disabled={busy}
          />
          <span ref={stamp} className="yd-swipe-stamp" aria-hidden="true">
            <span data-choice="right">ANSÖK</span>
            <span data-choice="left">NÄSTA</span>
          </span>
        </article>
      </div>
      <div className="yd-swipe-actions">
        <button
          disabled={busy}
          onClick={() => settle("left")}
          aria-label="Hoppa över jobbet"
        >
          <span>×</span>Nästa
        </button>
        <button
          className="yd-swipe-apply"
          disabled={busy}
          onClick={() => settle("right")}
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
