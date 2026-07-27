"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/hooks/use-session";
import { completeYouthOnboarding } from "@/lib/onboarding";
import { uploadYouthDocument } from "@/lib/storage";
import type { YouthDocument, YouthDocumentType } from "@/lib/types";

const JOB_OPTIONS = [
  "Café/restaurang", "Butik", "Barnomsorg", "Idrott",
  "Event", "Lager", "Leverans", "Kundtjänst",
  "Administration", "Handledare", "Sociala medier", "Övrigt",
];

const TIME_OPTIONS = ["Deltid", "Heltid", "Sommarjobb", "Helgjobb", "Extra vid behov"];
const STRENGTH_TIPS = ["Ansvarstagande", "Social", "Noggrann", "Kreativ", "Bra på att samarbeta"];
const EXPERIENCE_TIPS = ["Barnvakt", "Praktik", "Hjälpt till hemma", "Idrottsledare", "Föreningsarbete"];
const LANGUAGE_TIPS = [
  { label: "Svenska", flag: "🇸🇪" },
  { label: "Engelska", flag: "🇬🇧" },
  { label: "Arabiska", flag: "🇸🇦" },
  { label: "Spanska", flag: "🇪🇸" },
  { label: "Finska", flag: "🇫🇮" },
  { label: "Somaliska", flag: "🇸🇴" },
];

const DOC_TYPE_LABELS: Record<YouthDocumentType, string> = {
  grades: "Betyg",
  recommendation: "Rekommendationsbrev",
  certificate: "Intyg",
  other: "Övrigt",
};

interface StepConfig {
  field: keyof Answers;
  question: string;
  type: "text" | "number" | "textarea" | "chips";
  placeholder?: string;
  chips?: string[];
  optional?: boolean;
}

const STEPS: StepConfig[] = [
  {
    field: "full_name",
    question: "Vad heter du?",
    type: "text",
    placeholder: "Ditt namn",
  },
  {
    field: "age",
    question: "Hur gammal är du?",
    type: "number",
    placeholder: "Din ålder",
  },
  {
    field: "city",
    question: "Vilken stad bor du i?",
    type: "text",
    placeholder: "T.ex. Stockholm",
  },
  {
    field: "desired_roles",
    question: "Vilka typer av jobb är du intresserad av?\nVälj gärna flera.",
    type: "chips",
    chips: JOB_OPTIONS,
  },
  {
    field: "strengths",
    question: "Vilka är dina bästa egenskaper?",
    type: "text",
    placeholder: "T.ex. pålitlig, snabblärd, social",
    optional: true,
  },
  {
    field: "work_experience",
    question: "Har du jobbat eller hjälpt till med något förut?",
    type: "textarea",
    placeholder: "T.ex. barnvaktade för grannar, hjälpte i föräldrarnas butik...",
    optional: true,
  },
  {
    field: "education",
    question: "Vilken skola går eller har du gått på?",
    type: "text",
    placeholder: "T.ex. Norra gymnasium, grundskolan",
    optional: true,
  },
  {
    field: "languages",
    question: "Vilka språk kan du?",
    type: "text",
    placeholder: "T.ex. svenska, engelska, arabiska",
    optional: true,
  },
  {
    field: "employment_preferences",
    question: "Hur vill du helst jobba?",
    type: "chips",
    chips: TIME_OPTIONS,
  },
];

interface Answers {
  full_name: string;
  age: string;
  city: string;
  desired_roles: string[];
  strengths: string;
  work_experience: string;
  education: string;
  languages: string;
  employment_preferences: string[];
}

function buildCvText(a: Answers): string {
  const parts: string[] = [];
  const firstName = a.full_name?.trim().split(/\s+/)[0] ?? "";
  const dot = (s: string) => s && !/[.!?]$/.test(s) ? s + "." : s;

  // 4 variants chosen deterministically by first letter of name
  const v = firstName ? firstName.charCodeAt(0) % 4 : 0;

  // ── RUBRIK ──────────────────────────────────────────────────────────
  if (a.full_name) parts.push(a.full_name.toUpperCase());
  const headerLine = [a.age ? `${a.age} år` : "", a.city].filter(Boolean).join("  ·  ");
  if (headerLine) parts.push(headerLine);
  parts.push("");

  // ── INLEDNING (namn + ålder/ort + roller + styrkor i ett stycke) ────
  const ageCity =
    a.age && a.city ? `${a.age} år och bor i ${a.city}` :
    a.age           ? `${a.age} år gammal` :
    a.city          ? `bosatt i ${a.city}` : "";

  const openings = [
    ageCity ? `Hej! Jag heter ${firstName} och är ${ageCity}.` : `Hej, jag heter ${firstName}!`,
    ageCity ? `Mitt namn är ${firstName}, jag är ${ageCity}.`  : `Mitt namn är ${firstName}.`,
    ageCity ? `Jag heter ${firstName} och är ${ageCity}.`      : `Jag heter ${firstName}.`,
    ageCity ? `Jag är ${firstName}, ${ageCity}.`               : `Jag är ${firstName}.`,
  ];

  let intro = openings[v];

  if (a.desired_roles.length > 0) {
    const roleText =
      a.desired_roles.length === 1
        ? a.desired_roles[0].toLowerCase()
        : a.desired_roles.slice(0, -1).map(r => r.toLowerCase()).join(", ") +
          " och " + a.desired_roles[a.desired_roles.length - 1].toLowerCase();
    const roleLines = [
      ` Jag söker jobb inom ${roleText}.`,
      ` Det jag framför allt letar efter är jobb inom ${roleText}.`,
      ` Jag är intresserad av jobb inom ${roleText}.`,
      ` Jag hoppas hitta ett jobb inom ${roleText}.`,
    ];
    intro += roleLines[v];
  }

  if (a.strengths) {
    const s = a.strengths.trim().replace(/\.$/, "").toLowerCase();
    const strengthLines = [
      ` Jag ser mig själv som ${s}.`,
      ` Jag beskriver mig som ${s}.`,
      ` Mina styrkor är att jag är ${s}.`,
      ` Jag är en person som är ${s}.`,
    ];
    intro += strengthLines[v];
  }

  parts.push(dot(intro));

  // ── ERFARENHET ──────────────────────────────────────────────────────
  if (a.work_experience) {
    const raw = a.work_experience.trim();
    const lower = raw.charAt(0).toLowerCase() + raw.slice(1);
    let expParagraph: string;
    if (/^jag\b/i.test(raw)) {
      expParagraph = dot(raw.charAt(0).toUpperCase() + raw.slice(1));
    } else {
      const expIntros = [
        `Tidigare har jag ${dot(lower)}`,
        `Jag har bland annat ${dot(lower)}`,
        `Vad gäller erfarenhet har jag ${dot(lower)}`,
        `Jag har erfarenhet av att ${dot(lower)}`,
      ];
      expParagraph = expIntros[v];
    }
    parts.push("");
    parts.push(expParagraph);
  }

  // ── UTBILDNING ──────────────────────────────────────────────────────
  if (a.education) {
    const raw = a.education.trim();
    let eduParagraph: string;
    if (/^jag\b/i.test(raw)) {
      eduParagraph = dot(raw.charAt(0).toUpperCase() + raw.slice(1));
    } else {
      const eduLines = [
        `Jag studerar på ${raw}.`,
        `Just nu går jag på ${raw}.`,
        `Min utbildning är vid ${raw}.`,
        `Jag läser på ${raw}.`,
      ];
      eduParagraph = eduLines[v];
    }
    parts.push("");
    parts.push(eduParagraph);
  }

  // ── SPRÅK ───────────────────────────────────────────────────────────
  if (a.languages) {
    const langs = a.languages.split(/[,;]+/).map(l => l.trim()).filter(Boolean);
    const langText =
      langs.length > 1
        ? langs.slice(0, -1).join(", ") + " och " + langs[langs.length - 1]
        : langs[0] ?? a.languages.trim();
    const langLines = [
      `Jag pratar ${langText}.`,
      `Jag kommunicerar på ${langText}.`,
      `Jag talar ${langText}.`,
      `Jag behärskar ${langText}.`,
    ];
    parts.push("");
    parts.push(langLines[v]);
  }

  // ── TILLGÄNGLIGHET ──────────────────────────────────────────────────
  if (a.employment_preferences.length > 0) {
    const prefs = a.employment_preferences;
    const prefText =
      prefs.length === 1
        ? prefs[0].toLowerCase()
        : prefs.slice(0, -1).map(p => p.toLowerCase()).join(", ") +
          " och " + prefs[prefs.length - 1].toLowerCase();
    const availLines = [
      `Jag är öppen för ${prefText} och redo att börja så snart som möjligt.`,
      `Jag söker ${prefText} och kan börja omgående.`,
      `Vad gäller tillgänglighet passar ${prefText} mig bäst.`,
      `Jag är tillgänglig för ${prefText}.`,
    ];
    parts.push("");
    parts.push(availLines[v]);
  }

  return parts.join("\n");
}


export default function OnboardingPage() {
  const router = useRouter();
  const { user, profile, loading } = useSession();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({
    full_name: "",
    age: "",
    city: "",
    desired_roles: [],
    strengths: "",
    work_experience: "",
    education: "",
    languages: "",
    employment_preferences: [],
  });
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [customRole, setCustomRole] = useState("");
  const [showCvStep, setShowCvStep] = useState(false);
  const [showDocStep, setShowDocStep] = useState(false);
  const [cvText, setCvText] = useState("");
  const [documents, setDocuments] = useState<YouthDocument[]>([]);
  const [docType, setDocType] = useState<YouthDocumentType>("grades");
  const [docUploading, setDocUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && !user) router.replace("/auth");
    if (!loading && user && profile?.role === "company") router.replace("/dashboard");
  }, [loading, user, profile, router]);

  const current = STEPS[step];
  const isChips = current.type === "chips";
  const isLast = step === STEPS.length - 1;
  const progress = ((step + 1) / STEPS.length) * 100;

  /* ── CV preview / edit step ─────────────────────── */
  if (showCvStep) {
    return (
      <main
        className="youth-onboarding"
        style={{
          display: "flex",
          flexDirection: "column",
          minHeight: "100vh",
          maxWidth: 430,
          margin: "0 auto",
          background: "#ffffff",
          padding: "0 1.25rem",
        }}
      >
        <div style={{ paddingTop: "3rem", paddingBottom: "1.5rem" }}>
          <p style={{ fontSize: "0.75rem", color: "#a3a3a3", fontWeight: 600, letterSpacing: "0.05em", marginBottom: "0.4rem" }}>
            Ditt CV är klart!
          </p>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 800, letterSpacing: "-0.03em", color: "#111111", margin: 0 }}>
            Granska ditt CV
          </h1>
          <p style={{ marginTop: "0.4rem", fontSize: "0.85rem", color: "#737373" }}>
            Redigera texten nedan om du vill ändra något.
          </p>
        </div>

        <textarea
          value={cvText}
          onChange={(e) => setCvText(e.target.value)}
          rows={18}
          style={{
            width: "100%",
            boxSizing: "border-box",
            flex: 1,
            borderRadius: 12,
            border: "1.5px solid #e8e8e8",
            padding: "1rem",
            fontSize: "0.85rem",
            fontFamily: "monospace",
            resize: "vertical",
            color: "#111111",
            lineHeight: 1.65,
            outline: "none",
            background: "#fafafa",
          }}
        />

        {error && (
          <p style={{ marginTop: "0.75rem", fontSize: "0.85rem", color: "#c0392b" }}>{error}</p>
        )}

        <div style={{ paddingBottom: "3rem", paddingTop: "1.5rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          <button
            type="button"
            onClick={() => void handleSaveCv()}
            disabled={saving}
            style={{
              width: "100%",
              padding: "1rem",
              borderRadius: 12,
              border: "none",
              background: "#111111",
              color: "#ffffff",
              fontSize: "1rem",
              fontWeight: 700,
              cursor: saving ? "not-allowed" : "pointer",
              fontFamily: "inherit",
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? "Sparar..." : "Nästa →"}
          </button>
          <button
            type="button"
            onClick={() => setShowCvStep(false)}
            style={{
              width: "100%",
              padding: "0.75rem",
              fontSize: "0.875rem",
              background: "none",
              border: "none",
              color: "#a3a3a3",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            ← Tillbaka till frågorna
          </button>
        </div>
      </main>
    );
  }

  /* ── Document upload step (optional) ──────────────────── */
  if (showDocStep) {
    return (
      <main
        className="youth-onboarding"
        style={{
          display: "flex",
          flexDirection: "column",
          minHeight: "100vh",
          maxWidth: 430,
          margin: "0 auto",
          background: "#ffffff",
          padding: "0 1.25rem",
        }}
      >
        <div style={{ paddingTop: "3rem", paddingBottom: "1.5rem" }}>
          <div
            style={{
              display: "inline-block",
              background: "#f5f5f5",
              borderRadius: "4px 16px 16px 16px",
              padding: "1rem 1.25rem",
              maxWidth: "88%",
            }}
          >
            <p style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "#111111", lineHeight: 1.5 }}>
              Vill du bifoga dokument? (valfritt)
            </p>
          </div>
          <p style={{ fontSize: "0.85rem", color: "#737373", marginTop: "0.75rem", lineHeight: 1.55 }}>
            T.ex. betyg, rekommendationsbrev eller intyg. Dessa visas för företag som ser din profil.
          </p>
        </div>

        {/* Type selector + file picker */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem", marginBottom: "1rem" }}>
          <select
            value={docType}
            onChange={(e) => setDocType(e.target.value as YouthDocumentType)}
            style={{
              height: 44,
              borderRadius: 10,
              border: "1.5px solid #e8e8e8",
              padding: "0 0.75rem",
              fontSize: "0.9rem",
              color: "#111111",
              background: "#ffffff",
              outline: "none",
              fontFamily: "inherit",
            }}
          >
            <option value="grades">Betyg</option>
            <option value="recommendation">Rekommendationsbrev</option>
            <option value="certificate">Intyg</option>
            <option value="other">Övrigt</option>
          </select>
          <label
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.4rem",
              border: "1.5px dashed #e8e8e8",
              borderRadius: 12,
              padding: "1.25rem",
              textAlign: "center",
              cursor: docUploading ? "not-allowed" : "pointer",
              opacity: docUploading ? 0.6 : 1,
            }}
          >
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              style={{ display: "none" }}
              disabled={docUploading}
              onChange={(e) => void handleFileSelect(e)}
            />
            <span style={{ fontSize: "1.5rem" }}>📎</span>
            <p style={{ fontSize: "0.85rem", color: "#737373", margin: 0 }}>
              {docUploading ? "Laddar upp..." : "Tryck för att välja fil"}
            </p>
            <p style={{ fontSize: "0.75rem", color: "#a3a3a3", margin: 0 }}>PDF, JPG eller PNG · max 5 MB</p>
          </label>
        </div>

        {/* Uploaded docs list */}
        {documents.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", marginBottom: "1rem" }}>
            {documents.map((doc, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  background: "#f5f5f5",
                  borderRadius: 10,
                  padding: "0.6rem 0.85rem",
                }}
              >
                <span style={{ fontSize: "1rem" }}>📎</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: "0.82rem", fontWeight: 600, color: "#111111", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {doc.name}
                  </p>
                  <p style={{ fontSize: "0.72rem", color: "#737373", margin: 0 }}>{DOC_TYPE_LABELS[doc.type]}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setDocuments((d) => d.filter((_, j) => j !== i))}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#a3a3a3", fontSize: "1rem", padding: "0.25rem", lineHeight: 1 }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {error && (
          <p style={{ fontSize: "0.85rem", color: "#c0392b", marginBottom: "0.75rem" }}>{error}</p>
        )}

        <div style={{ paddingBottom: "3rem", paddingTop: "1rem", display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "auto" }}>
          <button
            type="button"
            onClick={() => void handleSaveWithDocs()}
            disabled={saving || docUploading}
            style={{
              width: "100%",
              padding: "1rem",
              borderRadius: 12,
              border: "none",
              background: "#111111",
              color: "#ffffff",
              fontSize: "1rem",
              fontWeight: 700,
              cursor: saving || docUploading ? "not-allowed" : "pointer",
              fontFamily: "inherit",
              opacity: saving || docUploading ? 0.6 : 1,
            }}
          >
            {saving ? "Sparar..." : "Spara och börja swipa"}
          </button>
          <button
            type="button"
            onClick={() => { setShowDocStep(false); setShowCvStep(true); }}
            style={{
              width: "100%",
              padding: "0.75rem",
              fontSize: "0.875rem",
              background: "none",
              border: "none",
              color: "#a3a3a3",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            ← Tillbaka till CV
          </button>
        </div>
      </main>
    );
  }

  function handleTextChange(val: string) {
    setAnswers((prev) => ({ ...prev, [current.field]: val }));
  }

  function toggleChip(chip: string) {
    setAnswers((prev) => {
      const arr = prev[current.field] as string[];
      return {
        ...prev,
        [current.field]: arr.includes(chip) ? arr.filter((c) => c !== chip) : [...arr, chip],
      };
    });
  }

  function addCustomRole() {
    const value = customRole.trim();
    if (!value) return;
    setAnswers((prev) => ({
      ...prev,
      desired_roles: prev.desired_roles.includes(value)
        ? prev.desired_roles
        : [...prev.desired_roles, value],
    }));
    setCustomRole("");
  }

  async function handleNext() {
    if (!isLast) {
      setStep((s) => s + 1);
      return;
    }
    // Last question answered → generate CV via Groq (falls back to local template if no key)
    setSaving(true);
    setError("");
    let generated = "";
    try {
      const res = await fetch("/api/youth/cv/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(answers),
      });
      if (res.ok) {
        const data = (await res.json()) as { cv: string };
        generated = data.cv;
      }
    } catch {
      // silently fall through to local template
    }
    if (!generated) generated = buildCvText(answers);
    setSaving(false);
    setCvText(generated);
    setShowCvStep(true);
  }

  async function handleSaveCv() {
    // CV collected — proceed to optional document upload step
    setShowCvStep(false);
    setShowDocStep(true);
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setDocUploading(true);
    setError("");
    try {
      const url = await uploadYouthDocument(file);
      setDocuments((prev) => [...prev, { name: file.name, url, type: docType }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunde inte ladda upp filen.");
    } finally {
      setDocUploading(false);
      e.target.value = "";
    }
  }

  async function handleSaveWithDocs() {
    setSaving(true);
    setError("");
    try {
      await completeYouthOnboarding({ ...answers, cv_text: cvText, documents });
      router.replace("/swipe");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Kunde inte spara profilen.");
      setSaving(false);
    }
  }

  if (loading || !user) {
    return (
      <main
        className="youth-onboarding"
        style={{
          display: "flex",
          minHeight: "100vh",
          alignItems: "center",
          justifyContent: "center",
          background: "#ffffff",
        }}
      >
        <p style={{ color: "#737373" }}>Laddar...</p>
      </main>
    );
  }

  const currentTextValue = isChips ? "" : (answers[current.field] as string);
  const currentChipsValue = isChips ? (answers[current.field] as string[]) : [];

  return (
    <main
      className="youth-onboarding"
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        maxWidth: 430,
        margin: "0 auto",
        background: "#ffffff",
        padding: "0 1.25rem",
      }}
    >
      {/* Progress bar */}
      <div style={{ paddingTop: "3rem", paddingBottom: "2.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem" }}>
          <span style={{ fontSize: "0.75rem", color: "#a3a3a3", fontWeight: 600, letterSpacing: "0.05em" }}>
            {step + 1} / {STEPS.length}
          </span>
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              style={{ fontSize: "0.8rem", color: "#737373", background: "none", border: "none", cursor: "pointer", padding: 0 }}
            >
              ← Tillbaka
            </button>
          )}
        </div>
        <div style={{ height: 3, borderRadius: 2, background: "#f0f0f0" }}>
          <div
            style={{
              height: 3,
              borderRadius: 2,
              background: "#111111",
              width: `${progress}%`,
              transition: "width 0.3s ease",
            }}
          />
        </div>
      </div>

      {/* Question bubble */}
      <div style={{ marginBottom: "2rem" }}>
        <div
          style={{
            display: "inline-block",
            background: "#f5f5f5",
            borderRadius: "4px 16px 16px 16px",
            padding: "1rem 1.25rem",
            maxWidth: "88%",
          }}
        >
          <p
            className="onboarding-question-title"
            style={{
              margin: 0,
              fontSize: "1.55rem",
              fontWeight: 700,
              color: "#111111",
              lineHeight: 1.5,
              whiteSpace: "pre-line",
            }}
          >
            {current.question}
          </p>
        </div>
      </div>

      {/* Input area */}
      <div style={{ flex: 1 }}>
        {current.field === "full_name" ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <input
              type="text"
              value={firstName}
              onChange={(e) => {
                const value = e.target.value;
                setFirstName(value);
                setAnswers((prev) => ({ ...prev, full_name: `${value} ${lastName}`.trim() }));
              }}
              placeholder="Namn"
              autoComplete="given-name"
              autoFocus
              style={{ width: "100%", boxSizing: "border-box", height: "3rem", padding: "0 1rem", borderRadius: 10, border: "1.5px solid #e8e8e8", fontSize: "1rem", outline: "none", fontFamily: "inherit", color: "#111111", background: "#ffffff" }}
            />
            <input
              type="text"
              value={lastName}
              onChange={(e) => {
                const value = e.target.value;
                setLastName(value);
                setAnswers((prev) => ({ ...prev, full_name: `${firstName} ${value}`.trim() }));
              }}
              placeholder="Efternamn"
              autoComplete="family-name"
              style={{ width: "100%", boxSizing: "border-box", height: "3rem", padding: "0 1rem", borderRadius: 10, border: "1.5px solid #e8e8e8", fontSize: "1rem", outline: "none", fontFamily: "inherit", color: "#111111", background: "#ffffff" }}
            />
          </div>
        ) : current.type === "chips" ? (
          <div>
            {current.field === "desired_roles" && (
              <div style={{ display: "flex", gap: "0.55rem", marginBottom: "1rem" }}>
                <input
                  type="text"
                  value={customRole}
                  onChange={(e) => setCustomRole(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomRole(); } }}
                  placeholder="Skriv ett yrke eller en jobbidé"
                  style={{ flex: 1, minWidth: 0, height: "3rem", padding: "0 1rem", borderRadius: 10, border: "1.5px solid #e8e8e8", fontSize: "0.9rem", outline: "none", fontFamily: "inherit", color: "#111111", background: "#ffffff" }}
                />
                <button type="button" onClick={addCustomRole} style={{ padding: "0 .9rem", border: "none", borderRadius: 10, background: "#111111", color: "#ffffff", fontSize: "0.82rem", fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Lägg till</button>
              </div>
            )}
            {current.field === "desired_roles" && <p style={{ margin: "0 0 0.65rem", color: "#737373", fontSize: "0.8rem", fontWeight: 600 }}>Tips på jobb</p>}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            {[...new Set([...current.chips!, ...currentChipsValue])].map((chip) => {
              const selected = (answers[current.field] as string[]).includes(chip);
              return (
                <button
                  key={chip}
                  type="button"
                  onClick={() => toggleChip(chip)}
                  style={{
                    padding: "0.55rem 1.1rem",
                    borderRadius: 999,
                    border: selected ? "none" : "1.5px solid #e8e8e8",
                    background: selected ? "#111111" : "#ffffff",
                    color: selected ? "#ffffff" : "#111111",
                    fontSize: "0.9rem",
                    cursor: "pointer",
                    fontWeight: selected ? 600 : 400,
                    fontFamily: "inherit",
                    transition: "background 0.15s, color 0.15s",
                  }}
                >
                  {chip}
                </button>
              );
            })}
            </div>
          </div>
        ) : current.type === "textarea" ? (
          <textarea
            value={currentTextValue}
            onChange={(e) => handleTextChange(e.target.value)}
            placeholder={current.placeholder}
            rows={4}
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "0.875rem 1rem",
              borderRadius: 12,
              border: "1.5px solid #e8e8e8",
              fontSize: "1rem",
              outline: "none",
              resize: "none",
              fontFamily: "inherit",
              color: "#111111",
              background: "#ffffff",
            }}
          />
        ) : (
          <input
            type={current.type}
            value={currentTextValue}
            onChange={(e) => handleTextChange(e.target.value)}
            placeholder={current.placeholder}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleNext();
            }}
            autoFocus
            style={{
              width: "100%",
              boxSizing: "border-box",
              height: "3rem",
              padding: "0 1rem",
              borderRadius: 10,
              border: "1.5px solid #e8e8e8",
              fontSize: "1rem",
              outline: "none",
              fontFamily: "inherit",
              color: "#111111",
              background: "#ffffff",
            }}
          />
        )}

        {current.field === "strengths" && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.8rem" }}>
            {STRENGTH_TIPS.map((tip) => {
              const selected = currentTextValue.toLowerCase().includes(tip.toLowerCase());
              return <button key={tip} type="button" onClick={() => {
                const nextValue = selected
                  ? currentTextValue.replace(new RegExp(`,?\\s*${tip}`, "i"), "").replace(/^,\s*/, "")
                  : [currentTextValue, tip].filter(Boolean).join(", ");
                handleTextChange(nextValue);
              }} style={{ padding: "0.5rem .8rem", borderRadius: 999, border: selected ? "none" : "1.5px solid #e8e8e8", background: selected ? "#111111" : "#ffffff", color: selected ? "#ffffff" : "#111111", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{tip}</button>;
            })}
          </div>
        )}

        {current.field === "work_experience" && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.8rem" }}>
            {EXPERIENCE_TIPS.map((tip) => {
              const selected = currentTextValue.toLowerCase().includes(tip.toLowerCase());
              return <button key={tip} type="button" onClick={() => {
                const nextValue = selected
                  ? currentTextValue.replace(new RegExp(`,?\\s*${tip}`, "i"), "").replace(/^,\s*/, "")
                  : [currentTextValue, tip].filter(Boolean).join(", ");
                handleTextChange(nextValue);
              }} style={{ padding: "0.5rem .8rem", borderRadius: 999, border: selected ? "none" : "1.5px solid #e8e8e8", background: selected ? "#111111" : "#ffffff", color: selected ? "#ffffff" : "#111111", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{tip}</button>;
            })}
          </div>
        )}

        {current.field === "languages" && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.8rem" }}>
            {LANGUAGE_TIPS.map(({ label, flag }) => {
              const selected = currentTextValue.toLowerCase().includes(label.toLowerCase());
              return <button key={label} type="button" onClick={() => {
                const nextValue = selected
                  ? currentTextValue.replace(new RegExp(`,?\\s*${label}`, "i"), "").replace(/^,\s*/, "")
                  : [currentTextValue, label].filter(Boolean).join(", ");
                handleTextChange(nextValue);
              }} style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", padding: "0.5rem .8rem", borderRadius: 999, border: selected ? "none" : "1.5px solid #e8e8e8", background: selected ? "#111111" : "#ffffff", color: selected ? "#ffffff" : "#111111", fontSize: "0.8rem", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}><span aria-hidden="true">{flag}</span>{label}</button>;
            })}
          </div>
        )}

        {error && (
          <p style={{ marginTop: "0.75rem", fontSize: "0.85rem", color: "#c0392b" }}>{error}</p>
        )}
      </div>

      {/* Navigation */}
      <div style={{ paddingBottom: "3rem", paddingTop: "2rem" }}>
        <button
          type="button"
          onClick={() => void handleNext()}
          disabled={saving}
          style={{
            width: "100%",
            padding: "1rem",
            borderRadius: 12,
            border: "none",
            background: "#111111",
            color: "#ffffff",
            fontSize: "1rem",
            fontWeight: 700,
            cursor: saving ? "not-allowed" : "pointer",
            fontFamily: "inherit",
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? "Genererar CV..." : isLast ? "Se mitt CV \u2192" : "N\u00e4sta"}
        </button>

        {current.optional && (
          <button
            type="button"
            onClick={() => {
              if (isLast) void handleNext();
              else setStep((s) => s + 1);
            }}
            style={{
              marginTop: "0.75rem",
              width: "100%",
              padding: "0.75rem",
              fontSize: "0.875rem",
              background: "none",
              border: "none",
              color: "#a3a3a3",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Hoppa över
          </button>
        )}
      </div>
    </main>
  );
}
