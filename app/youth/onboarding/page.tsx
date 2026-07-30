"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/hooks/use-session";
import { completeYouthOnboarding, getYouthProfile, saveYouthAccountDetails } from "@/lib/onboarding";
import { uploadYouthDocument } from "@/lib/storage";
import { ADDRESS_SUGGESTIONS, CITY_SUGGESTIONS, COMPANY_NAME_SUGGESTIONS, JOB_TITLE_SUGGESTIONS } from "@/lib/form-suggestions";
import type { YouthDocument, YouthDocumentType } from "@/lib/types";

const STRENGTH_TIPS = ["Ansvarstagande", "Social", "Noggrann", "Kreativ", "Bra på att samarbeta"];
const LANGUAGE_TIPS = [
  { label: "Svenska", flag: "🇸🇪" },
  { label: "Engelska", flag: "🇬🇧" },
  { label: "Arabiska", flag: "🇸🇦" },
  { label: "Spanska", flag: "🇪🇸" },
  { label: "Finska", flag: "🇫🇮" },
  { label: "Somaliska", flag: "🇸🇴" },
];
const BIRTH_DAYS = Array.from({ length: 31 }, (_, index) => String(index + 1));
const BIRTH_MONTHS = ["Januari", "Februari", "Mars", "April", "Maj", "Juni", "Juli", "Augusti", "September", "Oktober", "November", "December"];
const BIRTH_YEARS = Array.from({ length: 100 }, (_, index) => String(new Date().getFullYear() - 10 - index));
const WORK_YEARS = Array.from({ length: 100 }, (_, index) => String(new Date().getFullYear() - index));

const DOC_TYPE_LABELS: Record<YouthDocumentType, string> = {
  grades: "Betyg",
  recommendation: "Rekommendationsbrev",
  certificate: "Intyg",
  other: "Övrigt",
};

interface StepConfig {
  field: keyof Answers;
  question: string;
  type: "text" | "number" | "date" | "textarea" | "chips" | "image";
  placeholder?: string;
  chips?: string[];
  optional?: boolean;
}

interface AdditionalAddress {
  city: string;
  address: string;
  postal_code: string;
}

interface WorkExperience {
  title: string;
  company: string;
  location: string;
  location_type: string;
  employment_type: string;
  start_date: string;
  end_date: string;
  description: string;
  pdf_url: string;
}

interface EducationEntry {
  school: string;
  degree: string;
  subject: string;
  start_date: string;
  end_date: string;
  grade: string;
  activities: string;
  description: string;
  pdf_url: string;
}

interface CertificateEntry {
  name: string;
  issuer: string;
  category: string;
  issue_date: string;
  expiry_date: string;
  credential_url: string;
  description: string;
}

const emptyWorkExperience = (): WorkExperience => ({ title: "", company: "", location: "", location_type: "", employment_type: "", start_date: "", end_date: "", description: "", pdf_url: "" });
const emptyEducation = (): EducationEntry => ({ school: "", degree: "", subject: "", start_date: "", end_date: "", grade: "", activities: "", description: "", pdf_url: "" });
const emptyCertificate = (): CertificateEntry => ({ name: "", issuer: "", category: "", issue_date: "", expiry_date: "", credential_url: "", description: "" });

const STEPS: StepConfig[] = [
  {
    field: "full_name",
    question: "Vad heter du?",
    type: "text",
    placeholder: "Ditt namn",
  },
  {
    field: "date_of_birth",
    question: "När är du född?",
    type: "date",
  },
  {
    field: "address",
    question: "Var bor du?",
    type: "text",
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
    field: "certificates",
    question: "Har du certifikat, stipendier eller licenser?",
    type: "textarea",
    placeholder: "T.ex. HLR-certifikat, stipendium eller https://linkedin.com/in/...",
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
    field: "extracurriculars",
    question: "Annat – aktiviteter utanför skolan",
    type: "textarea",
    placeholder: "T.ex. föreningsliv, idrott, musik eller volontärarbete",
    optional: true,
  },
  {
    field: "profile_image",
    question: "Lägg till en profilbild",
    type: "image",
    optional: true,
  },
];

interface Answers {
  full_name: string;
  date_of_birth: string;
  address: string;
  postal_code: string;
  age: string;
  city: string;
  desired_roles: string[];
  certificates: string;
  extracurriculars: string;
  profile_image: string;
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
    date_of_birth: "",
    address: "",
    postal_code: "",
    age: "",
    city: "",
    desired_roles: [],
    certificates: "",
    extracurriculars: "",
    profile_image: "",
    strengths: "",
    work_experience: "",
    education: "",
    languages: "",
    employment_preferences: [],
  });
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthDateParts, setBirthDateParts] = useState({ day: "", month: "", year: "" });
  const [additionalAddresses, setAdditionalAddresses] = useState<AdditionalAddress[]>([]);
  const [workExperiences, setWorkExperiences] = useState<WorkExperience[]>([emptyWorkExperience()]);
  const [savedWorkExperiences, setSavedWorkExperiences] = useState<boolean[]>([false]);
  const [educations, setEducations] = useState<EducationEntry[]>([emptyEducation()]);
  const [savedEducations, setSavedEducations] = useState<boolean[]>([false]);
  const [certificates, setCertificates] = useState<CertificateEntry[]>([emptyCertificate()]);
  const [savedCertificates, setSavedCertificates] = useState<boolean[]>([false]);
  const [showCvStep, setShowCvStep] = useState(false);
  const [showAccountCreated, setShowAccountCreated] = useState(false);
  const [showDocStep, setShowDocStep] = useState(false);
  const [cvText, setCvText] = useState("");
  const [documents, setDocuments] = useState<YouthDocument[]>([]);
  const [docType, setDocType] = useState<YouthDocumentType>("grades");
  const [docUploading, setDocUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
    if (!loading && user && profile?.role === "company") router.replace("/dashboard");
  }, [loading, user, profile, router]);

  useEffect(() => {
    if (loading || !user || profile?.role !== "youth") return;

    let active = true;
    void getYouthProfile(user.id).then((savedProfile) => {
      if (!active || !savedProfile?.full_name || !savedProfile.date_of_birth || !savedProfile.address || !savedProfile.city || !savedProfile.postal_code) return;

      const nameParts = savedProfile.full_name.trim().split(/\s+/);
      setFirstName(nameParts[0] ?? "");
      setLastName(nameParts.slice(1).join(" "));
      const [year = "", month = "", day = ""] = (savedProfile.date_of_birth ?? "").split("-");
      setBirthDateParts({ day: String(Number(day) || ""), month: String(Number(month) || ""), year });
      setAnswers((previous) => ({
        ...previous,
        full_name: savedProfile.full_name ?? "",
        date_of_birth: savedProfile.date_of_birth ?? "",
        address: savedProfile.address ?? "",
        city: savedProfile.city ?? "",
        postal_code: savedProfile.postal_code ?? "",
        age: savedProfile.age ? String(savedProfile.age) : "",
      }));
      setAdditionalAddresses(Array.isArray(savedProfile.additional_addresses) ? savedProfile.additional_addresses : []);
      setStep(3);
    }).catch(() => {
      // Keep the account-details flow available if the saved profile cannot be read.
    });

    return () => {
      active = false;
    };
  }, [loading, profile?.role, user]);

  const current = STEPS[step];
  const isChips = current.type === "chips";
  const isLast = step === STEPS.length - 1;
  const isAccountDetailsFlow = step < 3;
  const flowStep = isAccountDetailsFlow ? step + 1 : step - 2;
  const flowTotal = isAccountDetailsFlow ? 3 : STEPS.length - 3;
  const progress = (flowStep / flowTotal) * 100;

  if (showAccountCreated) {
    return (
      <main className="mobile-shell" style={{ display: "flex", width: "100%", maxWidth: 560, minHeight: "100svh", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem", textAlign: "center" }}>
        <p style={{ margin: 0, color: "#737373", fontSize: "1.05rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Välkommen till Employo</p>
        <h1 style={{ margin: "0.75rem 0", color: "#111", fontSize: "clamp(3.2rem, 10vw, 4.5rem)", letterSpacing: "-0.06em", lineHeight: 0.95 }}>Kontot är skapat!</h1>
        <p style={{ maxWidth: "31rem", margin: "0 0 2.25rem", color: "#555", fontSize: "1.3rem", lineHeight: 1.55 }}>Vill du fortsätta skapa ditt CV nu eller gå in på ditt konto?</p>
        <button type="button" className="cta-btn" onClick={() => { setShowAccountCreated(false); setStep(3); }} style={{ width: "min(100%, 31rem)", padding: "1.3rem", fontSize: "1.2rem" }}>Fortsätt skapa mitt CV</button>
        <button type="button" className="secondary-btn" onClick={() => router.push("/dashboard")} style={{ width: "min(100%, 31rem)", marginTop: "0.85rem", padding: "1.3rem", fontSize: "1.15rem" }}>Gå till mitt konto</button>
      </main>
    );
  }

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

  function updateBirthDate(part: "day" | "month" | "year", value: string) {
    setBirthDateParts((previous) => {
      const next = { ...previous, [part]: value };
      if (next.day && next.month && next.year) {
        setAnswers((answers) => ({ ...answers, date_of_birth: `${next.year}-${next.month.padStart(2, "0")}-${next.day.padStart(2, "0")}` }));
      } else {
        setAnswers((answers) => ({ ...answers, date_of_birth: "" }));
      }
      return next;
    });
  }

  function formatWorkExperiences() {
    return workExperiences
      .filter((experience) => Object.values(experience).some(Boolean))
      .map((experience) => [
        [experience.title, experience.company].filter(Boolean).join(" · "),
        [experience.start_date, experience.end_date].filter(Boolean).join(" – "),
        [experience.location, experience.location_type].filter(Boolean).join(" · "),
        experience.description,
        experience.pdf_url,
      ].filter(Boolean).join("\n"))
      .join("\n\n");
  }

  function formatEducations() {
    return educations.filter((education) => Object.values(education).some(Boolean)).map((education) => [
      [education.school, education.degree].filter(Boolean).join(" · "),
      education.subject,
      [education.start_date, education.end_date].filter(Boolean).join(" – "),
      [education.grade, education.activities, education.description, education.pdf_url].filter(Boolean).join(" · "),
    ].filter(Boolean).join("\n")).join("\n\n");
  }

  function formatCertificates() {
    return certificates.filter((certificate) => Object.values(certificate).some(Boolean)).map((certificate) => [
      [certificate.name, certificate.issuer].filter(Boolean).join(" · "),
      certificate.category,
      [certificate.issue_date, certificate.expiry_date].filter(Boolean).join(" – "),
      certificate.credential_url,
      certificate.description,
    ].filter(Boolean).join("\n")).join("\n\n");
  }

  function updateEducationDate(index: number, field: "start_date" | "end_date", part: "month" | "year", value: string) {
    setEducations((previous) => previous.map((item, itemIndex) => {
      if (itemIndex !== index) return item;
      const [currentYear = "", currentMonth = ""] = item[field].split("-");
      const year = part === "year" ? value : currentYear;
      const month = part === "month" ? value : currentMonth;
      return { ...item, [field]: year || month ? `${year}-${month}` : "" };
    }));
  }

  function updateExperienceDate(index: number, field: "start_date" | "end_date", part: "month" | "year", value: string) {
    setWorkExperiences((previous) => previous.map((item, itemIndex) => {
      if (itemIndex !== index) return item;
      const [currentYear = "", currentMonth = ""] = item[field].split("-");
      const year = part === "year" ? value : currentYear;
      const month = part === "month" ? value : currentMonth;
      return { ...item, [field]: year || month ? `${year}-${month}` : "" };
    }));
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

  async function handleNext() {
    if (step === 2) {
      const hasIncompleteAdditionalAddress = additionalAddresses.some((item) => !item.city.trim() || !item.address.trim() || !item.postal_code.trim());
      if (!answers.full_name.trim() || !answers.date_of_birth || !answers.city.trim() || !answers.address.trim() || !answers.postal_code.trim() || hasIncompleteAdditionalAddress) {
        setError("Fyll i ditt namn, födelsedatum, stad, adress och postnummer för att fortsätta.");
        return;
      }
      setSaving(true);
      setError("");
      try {
        const savedAccount = await saveYouthAccountDetails({
          full_name: answers.full_name,
          date_of_birth: answers.date_of_birth,
          city: answers.city,
          address: answers.address,
          postal_code: answers.postal_code,
          additional_addresses: additionalAddresses,
        });
        setAnswers((prev) => ({ ...prev, age: savedAccount.age ? String(savedAccount.age) : "" }));
        setShowAccountCreated(true);
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : "Kunde inte spara dina uppgifter.");
      } finally {
        setSaving(false);
      }
      return;
    }
    if (step === 4) {
      const missingRequiredExperience = workExperiences.some((experience) => !experience.title.trim() || !experience.start_date.split("-")[0]);
      if (missingRequiredExperience) {
        setError("Fyll i Titel och Startår för varje arbetserfarenhet innan du går vidare.");
        return;
      }
    }
    if (step === 5) {
      const missingSchool = educations.some((education) => !education.school.trim());
      if (missingSchool) {
        setError("Fyll i Skola för varje utbildning innan du går vidare.");
        return;
      }
    }
    if (step === 6) {
      const missingCertificate = certificates.some((certificate) => !certificate.name.trim() || !certificate.issuer.trim());
      if (missingCertificate) {
        setError("Fyll i Namn och Utfärdande organisation för varje certifikat innan du går vidare.");
        return;
      }
    }
    if (!isLast) {
      setStep((s) => s + 1);
      return;
    }
    // Last question answered → generate CV via Groq (falls back to local template if no key)
    setSaving(true);
    setError("");
    let generated = "";
    const answersForCv = { ...answers, work_experience: formatWorkExperiences(), education: formatEducations(), certificates: formatCertificates() };
    try {
      const res = await fetch("/api/youth/cv/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(answersForCv),
      });
      if (res.ok) {
        const data = (await res.json()) as { cv: string };
        generated = data.cv;
      }
    } catch {
      // silently fall through to local template
    }
    if (!generated) generated = buildCvText(answersForCv);
    setAnswers(answersForCv);
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

  async function handleProfileImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setDocUploading(true);
    setError("");
    try {
      const url = await uploadYouthDocument(file);
      setAnswers((previous) => ({ ...previous, profile_image: url }));
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Kunde inte ladda upp profilbilden.");
    } finally {
      setDocUploading(false);
      e.target.value = "";
    }
  }

  async function handleEducationPdfSelect(index: number, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setDocUploading(true);
    setError("");
    try {
      const url = await uploadYouthDocument(file);
      setEducations((previous) => previous.map((item, itemIndex) => itemIndex === index ? { ...item, pdf_url: url } : item));
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Kunde inte ladda upp PDF-filen.");
    } finally {
      setDocUploading(false);
      e.target.value = "";
    }
  }

  async function handleExperiencePdfSelect(index: number, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setDocUploading(true);
    setError("");
    try {
      const url = await uploadYouthDocument(file);
      setWorkExperiences((previous) => previous.map((item, itemIndex) => itemIndex === index ? { ...item, pdf_url: url } : item));
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Kunde inte ladda upp PDF-filen.");
    } finally {
      setDocUploading(false);
      e.target.value = "";
    }
  }

  async function handleSaveWithDocs() {
    setSaving(true);
    setError("");
    try {
      await completeYouthOnboarding({ ...answers, work_experience: formatWorkExperiences(), education: formatEducations(), certificates: formatCertificates(), cv_text: cvText, documents });
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
      <datalist id="youth-job-title-suggestions">
        {JOB_TITLE_SUGGESTIONS.map((suggestion) => <option key={suggestion} value={suggestion} />)}
      </datalist>
      <datalist id="youth-company-name-suggestions">
        {COMPANY_NAME_SUGGESTIONS.map((suggestion) => <option key={suggestion} value={suggestion} />)}
      </datalist>
      <datalist id="youth-city-suggestions">
        {CITY_SUGGESTIONS.map((suggestion) => <option key={suggestion} value={suggestion} />)}
      </datalist>
      <datalist id="youth-address-suggestions">
        {ADDRESS_SUGGESTIONS.map((suggestion) => <option key={suggestion} value={suggestion} />)}
      </datalist>

      {/* Progress bar */}
      <div style={{ paddingTop: "3rem", paddingBottom: "2.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem" }}>
          <span style={{ fontSize: "0.95rem", color: "#737373", fontWeight: 700, letterSpacing: "0.05em" }}>
            {flowStep} / {flowTotal}
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
        <div style={{ height: 8, borderRadius: 999, background: "#f0f0f0" }}>
          <div
            style={{
              height: 8,
              borderRadius: 999,
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
        ) : current.field === "date_of_birth" ? (
          <div style={{ display: "grid", gridTemplateColumns: "0.8fr 1.4fr 1fr", gap: "0.55rem" }}>
            <select value={birthDateParts.day} onChange={(e) => updateBirthDate("day", e.target.value)} aria-label="Dag" style={{ height: "3.2rem", padding: "0 .55rem", border: "1.5px solid #e8e8e8", borderRadius: 10, color: "#111", background: "#fff", font: "inherit" }}><option value="">Dag</option>{BIRTH_DAYS.map((day) => <option key={day} value={day}>{day}</option>)}</select>
            <select value={birthDateParts.month} onChange={(e) => updateBirthDate("month", e.target.value)} aria-label="Månad" style={{ height: "3.2rem", padding: "0 .55rem", border: "1.5px solid #e8e8e8", borderRadius: 10, color: "#111", background: "#fff", font: "inherit" }}><option value="">Månad</option>{BIRTH_MONTHS.map((month, index) => <option key={month} value={String(index + 1)}>{month}</option>)}</select>
            <select value={birthDateParts.year} onChange={(e) => updateBirthDate("year", e.target.value)} aria-label="År" style={{ height: "3.2rem", padding: "0 .55rem", border: "1.5px solid #e8e8e8", borderRadius: 10, color: "#111", background: "#fff", font: "inherit" }}><option value="">År</option>{BIRTH_YEARS.map((year) => <option key={year} value={year}>{year}</option>)}</select>
          </div>
        ) : current.field === "address" ? (
          <div style={{ display: "grid", gap: "0.75rem" }}>
            <div style={{ display: "grid", gap: "0.75rem", padding: "1rem", border: "1.5px solid #e8e8e8", borderRadius: 14 }}>
              <p style={{ margin: "0 0 -0.2rem", color: "#737373", fontSize: "0.78rem", fontWeight: 700 }}>Adress 1</p>
              <input type="text" value={answers.city} onChange={(e) => setAnswers((previous) => ({ ...previous, city: e.target.value }))} placeholder="Stad" autoComplete="address-level2" list="youth-city-suggestions" autoFocus style={{ width: "100%", boxSizing: "border-box", height: "3rem", padding: "0 1rem", borderRadius: 10, border: "1.5px solid #e8e8e8", fontSize: "1rem", outline: "none", fontFamily: "inherit", color: "#111111", background: "#ffffff" }} />
              <input type="text" value={answers.address} onChange={(e) => setAnswers((previous) => ({ ...previous, address: e.target.value }))} placeholder="Adress" autoComplete="street-address" list="youth-address-suggestions" style={{ width: "100%", boxSizing: "border-box", height: "3rem", padding: "0 1rem", borderRadius: 10, border: "1.5px solid #e8e8e8", fontSize: "1rem", outline: "none", fontFamily: "inherit", color: "#111111", background: "#ffffff" }} />
              <input type="text" inputMode="numeric" value={answers.postal_code} onChange={(e) => setAnswers((previous) => ({ ...previous, postal_code: e.target.value }))} placeholder="Postnummer" autoComplete="postal-code" style={{ width: "100%", boxSizing: "border-box", height: "3rem", padding: "0 1rem", borderRadius: 10, border: "1.5px solid #e8e8e8", fontSize: "1rem", outline: "none", fontFamily: "inherit", color: "#111111", background: "#ffffff" }} />
            </div>
            {additionalAddresses.map((item, index) => (
              <div key={index} style={{ position: "relative", display: "grid", gap: "0.75rem", padding: "1rem", border: "1.5px solid #e8e8e8", borderRadius: 14 }}>
                <p style={{ margin: 0, color: "#737373", fontSize: "0.78rem", fontWeight: 700 }}>Adress {index + 2}</p>
                <button type="button" onClick={() => setAdditionalAddresses((previous) => previous.filter((_, addressIndex) => addressIndex !== index))} aria-label={`Ta bort adress ${index + 2}`} style={{ position: "absolute", top: "0.65rem", right: "0.65rem", display: "grid", width: "1.8rem", height: "1.8rem", placeItems: "center", border: "1px solid #e8e8e8", borderRadius: "50%", color: "#737373", background: "#ffffff", fontSize: "1rem", cursor: "pointer" }}>×</button>
                {(["city", "address", "postal_code"] as const).map((field) => <input key={field} type="text" inputMode={field === "postal_code" ? "numeric" : undefined} list={field === "city" ? "youth-city-suggestions" : field === "address" ? "youth-address-suggestions" : undefined} value={item[field]} onChange={(e) => setAdditionalAddresses((previous) => previous.map((address, addressIndex) => addressIndex === index ? { ...address, [field]: e.target.value } : address))} placeholder={field === "city" ? "Stad" : field === "address" ? "Adress" : "Postnummer"} style={{ width: "100%", boxSizing: "border-box", height: "3rem", padding: "0 1rem", borderRadius: 10, border: "1.5px solid #e8e8e8", fontSize: "1rem", outline: "none", fontFamily: "inherit", color: "#111111", background: "#ffffff" }} />)}
              </div>
            ))}
            <button type="button" onClick={() => setAdditionalAddresses((previous) => [...previous, { city: "", address: "", postal_code: "" }])} style={{ justifySelf: "start", marginTop: "0.25rem", padding: "0.65rem 0.9rem", border: "1.5px solid #49636a", borderRadius: 10, color: "#49636a", background: "#ffffff", font: "inherit", fontSize: "0.85rem", fontWeight: 700, cursor: "pointer" }}>+ Lägg till en ytterligare adress</button>
          </div>
        ) : current.type === "image" ? (
          <label style={{ display: "flex", minHeight: "12rem", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.7rem", border: "1.5px dashed #d1d1d1", borderRadius: 16, color: "#737373", cursor: docUploading ? "wait" : "pointer" }}>
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => void handleProfileImageSelect(e)} disabled={docUploading} style={{ display: "none" }} />
            {answers.profile_image ? <img src={answers.profile_image} alt="Profilbild" style={{ width: "7rem", height: "7rem", borderRadius: "50%", objectFit: "cover" }} /> : <span style={{ fontSize: "2rem" }}>👤</span>}
            <span style={{ fontSize: "0.9rem", fontWeight: 600 }}>{docUploading ? "Laddar upp..." : answers.profile_image ? "Byt profilbild" : "Välj profilbild"}</span>
            <span style={{ fontSize: "0.75rem" }}>Valfritt · JPG, PNG eller WebP</span>
          </label>
        ) : current.type === "chips" ? (
          <div>
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
        ) : current.field === "work_experience" ? (
          <div style={{ display: "grid", gap: "0.9rem" }}>
            {workExperiences.map((experience, index) => (
              <div key={index} style={{ position: "relative", display: "grid", gap: "0.7rem", padding: "1rem", border: "1.5px solid #e8e8e8", borderRadius: 14 }}>
                {savedWorkExperiences[index] ? (
                  <>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.75rem" }}>
                      <div><p style={{ margin: 0, color: "#111", fontSize: "1.05rem", fontWeight: 700 }}>{experience.title || "Arbetserfarenhet"}</p><p style={{ margin: "0.2rem 0 0", color: "#737373", fontSize: "0.82rem" }}>{[experience.company, experience.employment_type].filter(Boolean).join(" · ") || "Företag ej angivet"}</p></div>
                      <button type="button" onClick={() => setSavedWorkExperiences((previous) => previous.map((saved, savedIndex) => savedIndex === index ? false : saved))} style={{ border: 0, background: "none", color: "#49636a", font: "inherit", fontSize: "0.78rem", fontWeight: 700, cursor: "pointer" }}>Redigera</button>
                    </div>
                    <p style={{ margin: 0, color: "#555", fontSize: "0.82rem" }}>{[experience.start_date, experience.end_date].filter(Boolean).join(" – ") || "Datum ej angivet"}</p>
                    {experience.description && <p style={{ margin: 0, color: "#555", fontSize: "0.85rem", lineHeight: 1.45 }}>{experience.description}</p>}
                    <p style={{ margin: 0, color: "#737373", fontSize: "0.8rem" }}>{[experience.location, experience.location_type].filter(Boolean).join(" · ") || "Plats ej angiven"}</p>
                    {experience.pdf_url && <p style={{ margin: 0, color: "#49636a", fontSize: "0.8rem", fontWeight: 600 }}>PDF bifogad</p>}
                  </>
                ) : <>
                <p style={{ margin: 0, color: "#737373", fontSize: "0.78rem", fontWeight: 700 }}>Arbetserfarenhet {index + 1}</p>
                {workExperiences.length > 1 && <button type="button" onClick={() => { setWorkExperiences((previous) => previous.filter((_, experienceIndex) => experienceIndex !== index)); setSavedWorkExperiences((previous) => previous.filter((_, experienceIndex) => experienceIndex !== index)); }} aria-label={`Ta bort arbetserfarenhet ${index + 1}`} style={{ position: "absolute", top: "0.65rem", right: "0.65rem", display: "grid", width: "1.8rem", height: "1.8rem", placeItems: "center", border: "1px solid #e8e8e8", borderRadius: "50%", color: "#737373", background: "#ffffff", fontSize: "1rem", cursor: "pointer" }}>×</button>}
                {(["title", "company", "location"] as const).map((field) => <label key={field} style={{ display: "grid", gap: "0.3rem", color: "#a3a3a3", fontSize: "0.72rem", fontWeight: 600 }}>{field === "title" ? "Titel *" : field === "company" ? "Företag" : "Plats"}<input type="text" list={field === "title" ? "youth-job-title-suggestions" : field === "company" ? "youth-company-name-suggestions" : "youth-city-suggestions"} value={experience[field]} onChange={(e) => setWorkExperiences((previous) => previous.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: e.target.value } : item))} placeholder={field === "title" ? "T.ex. Butiksmedarbetare" : field === "company" ? "T.ex. ICA" : "T.ex. Stockholm"} style={{ width: "100%", boxSizing: "border-box", height: "3rem", padding: "0 1rem", borderRadius: 10, border: "1.5px solid #e8e8e8", fontSize: "1rem", outline: "none", fontFamily: "inherit", color: "#111111", background: "#ffffff" }} /></label>)}
                <label style={{ display: "grid", gap: "0.3rem", color: "#a3a3a3", fontSize: "0.72rem", fontWeight: 600 }}>Platstyp<select value={experience.location_type} onChange={(e) => setWorkExperiences((previous) => previous.map((item, itemIndex) => itemIndex === index ? { ...item, location_type: e.target.value } : item))} style={{ width: "100%", height: "3rem", padding: "0 1rem", borderRadius: 10, border: "1.5px solid #e8e8e8", color: experience.location_type ? "#111" : "#a3a3a3", background: "#fff", font: "inherit", fontSize: "1rem" }}><option value="">Välj</option><option value="På plats">På plats</option><option value="Hybrid">Hybrid</option><option value="Distans">Distans</option></select></label>
                <label style={{ display: "grid", gap: "0.3rem", color: "#a3a3a3", fontSize: "0.72rem", fontWeight: 600 }}>Anställningstyp<select value={experience.employment_type} onChange={(e) => setWorkExperiences((previous) => previous.map((item, itemIndex) => itemIndex === index ? { ...item, employment_type: e.target.value } : item))} style={{ width: "100%", height: "3rem", padding: "0 1rem", borderRadius: 10, border: "1.5px solid #e8e8e8", color: experience.employment_type ? "#111" : "#a3a3a3", background: "#fff", font: "inherit", fontSize: "1rem" }}><option value="">Välj</option><option value="Deltid">Deltid</option><option value="Heltid">Heltid</option><option value="Sommarjobb">Sommarjobb</option><option value="Praktik">Praktik</option><option value="Extraarbete">Extraarbete</option></select></label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
                  {(["start_date", "end_date"] as const).map((dateField) => {
                    const [year = "", month = ""] = experience[dateField].split("-");
                    return <div key={dateField} style={{ color: "#737373", fontSize: "0.75rem" }}>
                      <span>{dateField === "start_date" ? "Startdatum" : "Slutdatum"}</span>
                      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.9fr", gap: "0.4rem", marginTop: "0.3rem" }}>
                        <select value={month} onChange={(e) => updateExperienceDate(index, dateField, "month", e.target.value)} aria-label={`${dateField === "start_date" ? "Startdatum" : "Slutdatum"} månad`} style={{ width: "100%", boxSizing: "border-box", height: "3rem", padding: "0 0.4rem", borderRadius: 10, border: "1.5px solid #e8e8e8", color: "#111", background: "#fff", font: "inherit" }}><option value="">Månad</option>{BIRTH_MONTHS.map((monthName, monthIndex) => <option key={monthName} value={String(monthIndex + 1).padStart(2, "0")}>{monthName}</option>)}</select>
                        <select value={year} onChange={(e) => updateExperienceDate(index, dateField, "year", e.target.value)} aria-label={`${dateField === "start_date" ? "Startdatum" : "Slutdatum"} år`} style={{ width: "100%", boxSizing: "border-box", height: "3rem", padding: "0 0.4rem", borderRadius: 10, border: "1.5px solid #e8e8e8", color: "#111", background: "#fff", font: "inherit" }}><option value="">År{dateField === "start_date" ? " *" : ""}</option>{WORK_YEARS.map((workYear) => <option key={workYear} value={workYear}>{workYear}</option>)}</select>
                      </div>
                    </div>;
                  })}
                </div>
                <label style={{ display: "grid", gap: "0.3rem", color: "#a3a3a3", fontSize: "0.72rem", fontWeight: 600 }}>Beskrivning<textarea value={experience.description} onChange={(e) => setWorkExperiences((previous) => previous.map((item, itemIndex) => itemIndex === index ? { ...item, description: e.target.value } : item))} placeholder="T.ex. Jag hjälpte kunder och fyllde på varor" rows={3} style={{ width: "100%", boxSizing: "border-box", padding: "0.875rem 1rem", borderRadius: 10, border: "1.5px solid #e8e8e8", fontSize: "1rem", outline: "none", resize: "vertical", fontFamily: "inherit", color: "#111111", background: "#ffffff" }} /></label>
                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: ".8rem", border: "1.5px dashed #d1d1d1", borderRadius: 10, color: "#49636a", fontSize: ".85rem", fontWeight: 600, cursor: docUploading ? "wait" : "pointer" }}><input type="file" accept="application/pdf" onChange={(e) => void handleExperiencePdfSelect(index, e)} disabled={docUploading} style={{ display: "none" }} />📎 {experience.pdf_url ? "PDF bifogad – byt fil" : "Lägg till PDF"}</label>
                <button type="button" onClick={() => { if (!experience.title.trim() || !experience.start_date.split("-")[0]) { setError("Titel och år måste fyllas i för att spara erfarenheten."); return; } setError(""); setSavedWorkExperiences((previous) => previous.map((saved, savedIndex) => savedIndex === index ? true : saved)); }} style={{ justifySelf: "start", padding: "0.55rem 0.8rem", border: 0, borderRadius: 8, color: "#fff", background: "#111", font: "inherit", fontSize: "0.8rem", fontWeight: 700, cursor: "pointer" }}>Spara erfarenhet</button>
                </>}
              </div>
            ))}
            <button type="button" onClick={() => { setWorkExperiences((previous) => [...previous, emptyWorkExperience()]); setSavedWorkExperiences((previous) => [...previous, false]); }} style={{ justifySelf: "start", padding: "0.65rem 0.9rem", border: "1.5px solid #49636a", borderRadius: 10, color: "#49636a", background: "#ffffff", font: "inherit", fontSize: "0.85rem", fontWeight: 700, cursor: "pointer" }}>+ Lägg till arbetserfarenhet</button>
          </div>
        ) : current.field === "education" ? (
          <div style={{ display: "grid", gap: "0.9rem" }}>
            {educations.map((education, index) => (
              <div key={index} style={{ position: "relative", display: "grid", gap: "0.7rem", padding: "1rem", border: "1.5px solid #e8e8e8", borderRadius: 14 }}>
                {savedEducations[index] ? <>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem" }}><div><p style={{ margin: 0, color: "#111", fontSize: "1.05rem", fontWeight: 700 }}>{education.school || "Utbildning"}</p><p style={{ margin: "0.2rem 0 0", color: "#737373", fontSize: "0.82rem" }}>{[education.degree, education.subject].filter(Boolean).join(" · ") || "Examen ej angiven"}</p></div><button type="button" onClick={() => setSavedEducations((previous) => previous.map((saved, savedIndex) => savedIndex === index ? false : saved))} style={{ border: 0, background: "none", color: "#49636a", font: "inherit", fontSize: "0.78rem", fontWeight: 700, cursor: "pointer" }}>Redigera</button></div>
                  <p style={{ margin: 0, color: "#555", fontSize: "0.82rem" }}>{[education.start_date, education.end_date].filter(Boolean).join(" – ") || "Datum ej angivet"}</p>
                  {[education.grade, education.activities, education.description].filter(Boolean).map((value) => <p key={value} style={{ margin: 0, color: "#555", fontSize: "0.85rem", lineHeight: 1.45 }}>{value}</p>)}
                  {education.pdf_url && <p style={{ margin: 0, color: "#49636a", fontSize: "0.8rem", fontWeight: 600 }}>PDF bifogad</p>}
                </> : <>
                  <p style={{ margin: 0, color: "#737373", fontSize: "0.78rem", fontWeight: 700 }}>Utbildning {index + 1}</p>
                  {educations.length > 1 && <button type="button" onClick={() => { setEducations((previous) => previous.filter((_, itemIndex) => itemIndex !== index)); setSavedEducations((previous) => previous.filter((_, itemIndex) => itemIndex !== index)); }} aria-label={`Ta bort utbildning ${index + 1}`} style={{ position: "absolute", top: "0.65rem", right: "0.65rem", display: "grid", width: "1.8rem", height: "1.8rem", placeItems: "center", border: "1px solid #e8e8e8", borderRadius: "50%", color: "#737373", background: "#fff", fontSize: "1rem", cursor: "pointer" }}>×</button>}
                  <label style={{ display: "grid", gap: ".3rem", color: "#a3a3a3", fontSize: ".72rem", fontWeight: 600 }}>Skola *<input type="text" value={education.school} onChange={(e) => setEducations((previous) => previous.map((item, itemIndex) => itemIndex === index ? { ...item, school: e.target.value } : item))} placeholder="T.ex. Kungsholmens gymnasium" style={{ width: "100%", boxSizing: "border-box", height: "3rem", padding: "0 1rem", borderRadius: 10, border: "1.5px solid #e8e8e8", fontSize: "1rem", outline: "none", fontFamily: "inherit", color: "#111", background: "#fff" }} /></label>
                  <label style={{ display: "grid", gap: ".3rem", color: "#a3a3a3", fontSize: ".72rem", fontWeight: 600 }}>Examen<input type="text" value={education.degree} onChange={(e) => setEducations((previous) => previous.map((item, itemIndex) => itemIndex === index ? { ...item, degree: e.target.value } : item))} placeholder="T.ex. Samhällsvetenskapsprogrammet" style={{ width: "100%", boxSizing: "border-box", height: "3rem", padding: "0 1rem", borderRadius: 10, border: "1.5px solid #e8e8e8", fontSize: "1rem", outline: "none", fontFamily: "inherit", color: "#111", background: "#fff" }} /></label>
                  <label style={{ display: "grid", gap: ".3rem", color: "#a3a3a3", fontSize: ".72rem", fontWeight: 600 }}>Ämnesområde<input type="text" value={education.subject} onChange={(e) => setEducations((previous) => previous.map((item, itemIndex) => itemIndex === index ? { ...item, subject: e.target.value } : item))} placeholder="T.ex. Ekonomi" style={{ width: "100%", boxSizing: "border-box", height: "3rem", padding: "0 1rem", borderRadius: 10, border: "1.5px solid #e8e8e8", fontSize: "1rem", outline: "none", fontFamily: "inherit", color: "#111", background: "#fff" }} /></label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>{(["start_date", "end_date"] as const).map((dateField) => { const [year = "", month = ""] = education[dateField].split("-"); return <div key={dateField} style={{ color: "#737373", fontSize: "0.75rem" }}><span>{dateField === "start_date" ? "Startdatum" : "Slutdatum"}</span><div style={{ display: "grid", gridTemplateColumns: "1.2fr .9fr", gap: ".4rem", marginTop: ".3rem" }}><select value={month} onChange={(e) => updateEducationDate(index, dateField, "month", e.target.value)} style={{ height: "3rem", border: "1.5px solid #e8e8e8", borderRadius: 10, font: "inherit" }}><option value="">Månad</option>{BIRTH_MONTHS.map((monthName, monthIndex) => <option key={monthName} value={String(monthIndex + 1).padStart(2, "0")}>{monthName}</option>)}</select><select value={year} onChange={(e) => updateEducationDate(index, dateField, "year", e.target.value)} style={{ height: "3rem", border: "1.5px solid #e8e8e8", borderRadius: 10, font: "inherit" }}><option value="">År</option>{WORK_YEARS.map((workYear) => <option key={workYear} value={workYear}>{workYear}</option>)}</select></div></div>; })}</div>
                  <input type="text" value={education.grade} onChange={(e) => setEducations((previous) => previous.map((item, itemIndex) => itemIndex === index ? { ...item, grade: e.target.value } : item))} placeholder="Betyg" style={{ width: "100%", boxSizing: "border-box", height: "3rem", padding: "0 1rem", borderRadius: 10, border: "1.5px solid #e8e8e8", fontSize: "1rem", outline: "none", fontFamily: "inherit", color: "#111", background: "#fff" }} />
                  <textarea value={education.activities} onChange={(e) => setEducations((previous) => previous.map((item, itemIndex) => itemIndex === index ? { ...item, activities: e.target.value } : item))} placeholder="Aktiviteter och föreningar" rows={2} style={{ width: "100%", boxSizing: "border-box", padding: ".875rem 1rem", borderRadius: 10, border: "1.5px solid #e8e8e8", font: "inherit", resize: "vertical" }} />
                  <textarea value={education.description} onChange={(e) => setEducations((previous) => previous.map((item, itemIndex) => itemIndex === index ? { ...item, description: e.target.value } : item))} placeholder="Beskrivning" rows={3} style={{ width: "100%", boxSizing: "border-box", padding: ".875rem 1rem", borderRadius: 10, border: "1.5px solid #e8e8e8", font: "inherit", resize: "vertical" }} />
                  <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: ".8rem", border: "1.5px dashed #d1d1d1", borderRadius: 10, color: "#49636a", fontSize: ".85rem", fontWeight: 600, cursor: docUploading ? "wait" : "pointer" }}><input type="file" accept="application/pdf" onChange={(e) => void handleEducationPdfSelect(index, e)} disabled={docUploading} style={{ display: "none" }} />📎 {education.pdf_url ? "PDF bifogad – byt fil" : "Lägg till PDF"}</label>
                  <button type="button" onClick={() => { if (!education.school.trim()) { setError("Skola måste fyllas i för att spara utbildningen."); return; } setError(""); setSavedEducations((previous) => previous.map((saved, savedIndex) => savedIndex === index ? true : saved)); }} style={{ width: "100%", padding: ".85rem", border: 0, borderRadius: 10, color: "#fff", background: "#111", font: "inherit", fontWeight: 700, cursor: "pointer" }}>Spara utbildning</button>
                </>}
              </div>
            ))}
            <button type="button" onClick={() => { setEducations((previous) => [...previous, emptyEducation()]); setSavedEducations((previous) => [...previous, false]); }} style={{ justifySelf: "start", padding: ".65rem .9rem", border: "1.5px solid #49636a", borderRadius: 10, color: "#49636a", background: "#fff", font: "inherit", fontSize: ".85rem", fontWeight: 700, cursor: "pointer" }}>+ Lägg till utbildning</button>
          </div>
        ) : current.field === "certificates" ? (
          <div style={{ display: "grid", gap: "0.9rem" }}>
            {certificates.map((certificate, index) => (
              <div key={index} style={{ position: "relative", display: "grid", gap: "0.7rem", padding: "1rem", border: "1.5px solid #e8e8e8", borderRadius: 14 }}>
                {savedCertificates[index] ? <>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem" }}><div><p style={{ margin: 0, color: "#111", fontSize: "1.05rem", fontWeight: 700 }}>{certificate.name || "Certifikat"}</p><p style={{ margin: "0.2rem 0 0", color: "#737373", fontSize: "0.82rem" }}>{[certificate.issuer, certificate.category].filter(Boolean).join(" · ") || "Organisation ej angiven"}</p></div><button type="button" onClick={() => setSavedCertificates((previous) => previous.map((saved, savedIndex) => savedIndex === index ? false : saved))} style={{ border: 0, background: "none", color: "#49636a", font: "inherit", fontSize: "0.78rem", fontWeight: 700, cursor: "pointer" }}>Redigera</button></div>
                  <p style={{ margin: 0, color: "#555", fontSize: "0.82rem" }}>{[certificate.issue_date, certificate.expiry_date].filter(Boolean).join(" – ") || "Datum ej angivet"}</p>
                  {certificate.description && <p style={{ margin: 0, color: "#555", fontSize: "0.85rem", lineHeight: 1.45 }}>{certificate.description}</p>}
                  {certificate.credential_url && <p style={{ margin: 0, color: "#49636a", fontSize: "0.8rem" }}>{certificate.credential_url}</p>}
                </> : <>
                  <p style={{ margin: 0, color: "#737373", fontSize: "0.78rem", fontWeight: 700 }}>Certifikat {index + 1}</p>
                  {certificates.length > 1 && <button type="button" onClick={() => { setCertificates((previous) => previous.filter((_, itemIndex) => itemIndex !== index)); setSavedCertificates((previous) => previous.filter((_, itemIndex) => itemIndex !== index)); }} aria-label={`Ta bort certifikat ${index + 1}`} style={{ position: "absolute", top: "0.65rem", right: "0.65rem", display: "grid", width: "1.8rem", height: "1.8rem", placeItems: "center", border: "1px solid #e8e8e8", borderRadius: "50%", color: "#737373", background: "#fff", fontSize: "1rem", cursor: "pointer" }}>×</button>}
                  {(["name", "issuer"] as const).map((field) => <label key={field} style={{ display: "grid", gap: ".3rem", color: "#a3a3a3", fontSize: ".72rem", fontWeight: 600 }}>{field === "name" ? "Namn *" : "Utfärdande organisation *"}<input type="text" value={certificate[field]} onChange={(e) => setCertificates((previous) => previous.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: e.target.value } : item))} placeholder={field === "name" ? "T.ex. HLR-certifikat" : "T.ex. Röda Korset"} style={{ width: "100%", boxSizing: "border-box", height: "3rem", padding: "0 1rem", borderRadius: 10, border: "1.5px solid #e8e8e8", fontSize: "1rem", outline: "none", fontFamily: "inherit", color: "#111", background: "#fff" }} /></label>)}
                  <label style={{ display: "grid", gap: ".3rem", color: "#a3a3a3", fontSize: ".72rem", fontWeight: 600 }}>Typ<select value={certificate.category} onChange={(e) => setCertificates((previous) => previous.map((item, itemIndex) => itemIndex === index ? { ...item, category: e.target.value } : item))} style={{ width: "100%", height: "3rem", padding: "0 1rem", border: "1.5px solid #e8e8e8", borderRadius: 10, color: certificate.category ? "#111" : "#a3a3a3", background: "#fff", font: "inherit", fontSize: "1rem" }}><option value="">Välj</option><option value="Certifikat">Certifikat</option><option value="Stipendium">Stipendium</option><option value="Licens">Licens</option><option value="Annat">Annat</option></select></label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: ".6rem" }}>{(["issue_date", "expiry_date"] as const).map((field) => <label key={field} style={{ display: "grid", gap: ".3rem", color: "#a3a3a3", fontSize: ".72rem", fontWeight: 600 }}>{field === "issue_date" ? "Utfärdandedatum" : "Giltig till"}<input type="month" value={certificate[field]} onChange={(e) => setCertificates((previous) => previous.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: e.target.value } : item))} style={{ width: "100%", height: "3rem", boxSizing: "border-box", padding: "0 .5rem", border: "1.5px solid #e8e8e8", borderRadius: 10, font: "inherit" }} /></label>)}</div>
                  <label style={{ display: "grid", gap: ".3rem", color: "#a3a3a3", fontSize: ".72rem", fontWeight: 600 }}>Beskrivning<textarea value={certificate.description} onChange={(e) => setCertificates((previous) => previous.map((item, itemIndex) => itemIndex === index ? { ...item, description: e.target.value } : item))} placeholder="T.ex. Vad certifikatet eller stipendiet gällde" rows={2} style={{ width: "100%", boxSizing: "border-box", padding: ".7rem 1rem", border: "1.5px solid #e8e8e8", borderRadius: 10, font: "inherit", resize: "vertical" }} /></label>
                  <button type="button" onClick={() => { if (!certificate.name.trim() || !certificate.issuer.trim()) { setError("Namn och utfärdande organisation måste fyllas i."); return; } setError(""); setSavedCertificates((previous) => previous.map((saved, savedIndex) => savedIndex === index ? true : saved)); }} style={{ justifySelf: "start", padding: ".55rem .8rem", border: 0, borderRadius: 8, color: "#fff", background: "#111", font: "inherit", fontSize: ".8rem", fontWeight: 700, cursor: "pointer" }}>Spara certifikat</button>
                </>}
              </div>
            ))}
            <button type="button" onClick={() => { setCertificates((previous) => [...previous, emptyCertificate()]); setSavedCertificates((previous) => [...previous, false]); }} style={{ justifySelf: "start", padding: ".65rem .9rem", border: "1.5px solid #49636a", borderRadius: 10, color: "#49636a", background: "#fff", font: "inherit", fontSize: ".85rem", fontWeight: 700, cursor: "pointer" }}>+ Lägg till certifikat eller stipendium</button>
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
