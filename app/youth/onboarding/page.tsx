"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "@/hooks/use-session";
import { completeYouthOnboarding, getYouthProfile, saveUploadedCvToProfile, saveYouthAccountDetails } from "@/lib/onboarding";
import { createCvPdfFile } from "@/lib/cv-pdf";
import { uploadYouthDocument } from "@/lib/storage";
import { ADDRESS_SUGGESTIONS, CITY_SUGGESTIONS, COMPANY_NAME_SUGGESTIONS, JOB_TITLE_SUGGESTIONS } from "@/lib/form-suggestions";
import type { YouthDocument, YouthDocumentType } from "@/lib/types";
import { structuredCvFromForm, type StructuredCvData } from "@/lib/structured-cv";

const STRENGTH_TIPS = [
  "Ansvarstagande",
  "Social",
  "Noggrann",
  "Kreativ",
  "Bra på att samarbeta",
  "Initiativtagande",
  "Snabblärd",
  "Serviceinriktad",
  "Strukturerad",
  "Flexibel",
  "Positiv",
  "Lösningsorienterad",
  "Engagerad",
];
const LANGUAGE_TIPS = [
  { label: "Svenska", flag: "🇸🇪" },
  { label: "Engelska", flag: "🇬🇧" },
  { label: "Arabiska", flag: "🇸🇦" },
  { label: "Spanska", flag: "🇪🇸" },
  { label: "Finska", flag: "🇫🇮" },
  { label: "Somaliska", flag: "🇸🇴" },
];
const CUSTOM_LANGUAGE_FLAGS: Record<string, string> = {
  chinese: "🇨🇳",
  mandarin: "🇨🇳",
  cantonese: "🇭🇰",
  japanese: "🇯🇵",
  korean: "🇰🇷",
  portuguese: "🇵🇹",
  italian: "🇮🇹",
  russian: "🇷🇺",
  hindi: "🇮🇳",
  bengali: "🇧🇩",
  romanian: "🇷🇴",
  thai: "🇹🇭",
  vietnamese: "🇻🇳",
};

function getLanguageFlag(language: string): string {
  const normalized = language.trim().toLocaleLowerCase();
  return LANGUAGE_TIPS.find((item) => item.label.toLocaleLowerCase() === normalized)?.flag
    ?? CUSTOM_LANGUAGE_FLAGS[normalized]
    ?? "🌐";
}
const BIRTH_DAYS = Array.from({ length: 31 }, (_, index) => String(index + 1));
const BIRTH_MONTHS = ["Januari", "Februari", "Mars", "April", "Maj", "Juni", "Juli", "Augusti", "September", "Oktober", "November", "December"];
const BIRTH_YEARS = Array.from({ length: 100 }, (_, index) => String(new Date().getFullYear() - 10 - index));
const WORK_YEARS = Array.from({ length: 100 }, (_, index) => String(2026 - index));
const ACCOUNT_DETAILS_STEP_COUNT = 3;
const FIRST_CV_STEP = ACCOUNT_DETAILS_STEP_COUNT;
const CV_DRAFT_STORAGE_KEY = "employo-written-cv-draft-v1";

function hasAccountDetails(profile: {
  full_name?: string | null;
  date_of_birth?: string | null;
  address?: string | null;
  city?: string | null;
  postal_code?: string | null;
} | null): boolean {
  return Boolean(
    profile?.full_name?.trim() &&
    profile.date_of_birth &&
    profile.address?.trim() &&
    profile.city?.trim(),
  );
}

export default function OnboardingPage() {
  return <YouthOnboardingFlow flow="account" />;
}

const DOC_TYPE_LABELS: Record<YouthDocumentType, string> = {
  grades: "Betyg",
  recommendation: "Rekommendationsbrev",
  certificate: "Intyg",
  cv: "Eget CV",
  generated_cv: "Employo-CV",
  other: "Övrigt",
};

interface StepConfig {
  field: keyof Answers;
  question: string;
  description?: string;
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
  is_current: boolean;
  description: string;
  pdf_url: string;
}

interface EducationEntry {
  school: string;
  degree: string;
  subject: string;
  start_date: string;
  end_date: string;
  description: string;
}

interface CertificateEntry {
  name: string;
  issuer: string;
  category: string;
  issue_date: string;
  expiry_date: string;
  credential_url: string;
  description: string;
  pdf_url: string;
}

interface OtherEntry {
  title: string;
  type: "write" | "link" | "pdf";
  value: string;
  file?: YouthDocument;
}

const emptyWorkExperience = (): WorkExperience => ({ title: "", company: "", location: "", location_type: "", employment_type: "", start_date: "", end_date: "", is_current: false, description: "", pdf_url: "" });
const emptyEducation = (): EducationEntry => ({ school: "", degree: "", subject: "", start_date: "", end_date: "", description: "" });
const emptyCertificate = (): CertificateEntry => ({ name: "", issuer: "", category: "", issue_date: "", expiry_date: "", credential_url: "", description: "", pdf_url: "" });

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
    field: "languages",
    question: "Vilka språk kan du?",
    type: "text",
    placeholder: "Skriv ett språk",
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
    question: "Utbildning",
    description: "Lägg till dina utbildningar. Det kan exempelvis vara en skola, en onlinekurs eller liknande.",
    type: "text",
    placeholder: "T.ex. Norra gymnasium, grundskolan",
    optional: true,
  },
  {
    field: "skills_text",
    question: "Vilka konkreta kompetenser och verktyg kan du använda?",
    description: "Skriv bara sådant du faktiskt har använt.",
    type: "textarea",
    placeholder: "T.ex. React, Excel, kassasystem eller bildredigering",
    optional: true,
  },
  {
    field: "certificates",
    question: "Har du certifikat, stipendier eller licenser?",
    type: "textarea",
    placeholder: "T.ex. HLR-certifikat eller stipendium",
    optional: true,
  },
  {
    field: "extracurriculars",
    question: "Andra bemärkelser eller tillägg",
    description: "Här kan du till exempel berätta om en fritidsaktivitet eller bifoga en pdf med dina betyg.",
    type: "textarea",
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
  skills_text: string;
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

function buildStructuredCvFallback(a: Answers): string {
  const sections: string[] = [];
  const addSection = (heading: string, content: string) => {
    const value = content.trim();
    if (value) sections.push(`${heading}\n${value}`);
  };
  const firstName = a.full_name.trim().split(/\s+/)[0] || "";
  const profile = [
    firstName && a.city ? `Jag heter ${firstName} och bor i ${a.city}.` : a.city ? `Jag bor i ${a.city}.` : "",
    a.desired_roles.length ? `Jag söker jobb inom ${a.desired_roles.join(", ").toLowerCase()}.` : "",
    a.strengths.trim() ? `Mina styrkor är ${a.strengths.trim()}.` : "",
  ].filter(Boolean).join(" ");

  if (a.full_name.trim()) sections.push(a.full_name.trim().toUpperCase());
  addSection("PROFIL", profile);
  addSection("ARBETSLIVSERFARENHET", a.work_experience);
  addSection("UTBILDNING", a.education);
  addSection("CERTIFIKAT OCH MERITER", [a.certificates, a.extracurriculars].filter(Boolean).join("\n\n"));
  addSection("SPRÅK", a.languages);
  addSection("TILLGÄNGLIGHET", a.employment_preferences.join(", "));

  return sections.join("\n\n");
}


export function YouthOnboardingFlow({ flow, cvBuilder = false, voiceFinalize = false }: { flow: "account" | "cv"; cvBuilder?: boolean; voiceFinalize?: boolean }) {
  const router = useRouter();
  const { user, profile, loading } = useSession();
  const cvDraftStorageKey = `${CV_DRAFT_STORAGE_KEY}:${user?.id ?? "anonymous"}`;
  const [step, setStep] = useState(() => voiceFinalize ? STEPS.length - 1 : flow === "cv" ? FIRST_CV_STEP : 0);
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
    skills_text: "",
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
  const [selectedStrengths, setSelectedStrengths] = useState<string[]>([]);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [strengthInput, setStrengthInput] = useState("");
  const [languageInput, setLanguageInput] = useState("");
  const [otherType, setOtherType] = useState<"" | "write" | "link" | "pdf">("");
  const [otherTitle, setOtherTitle] = useState("");
  const [otherLink, setOtherLink] = useState("");
  const [otherPdf, setOtherPdf] = useState<YouthDocument | null>(null);
  const [otherEntries, setOtherEntries] = useState<OtherEntry[]>([]);
  const [cropSource, setCropSource] = useState("");
  const [cropDimensions, setCropDimensions] = useState({ width: 0, height: 0 });
  const [cropZoom, setCropZoom] = useState(1);
  const [cropOffset, setCropOffset] = useState({ x: 0, y: 0 });
  const cropDragRef = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const cameraVideoRef = useRef<HTMLVideoElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const [showCvStep, setShowCvStep] = useState(false);
  const [showAccountCreated, setShowAccountCreated] = useState(false);
  const [accountDetailsSaved, setAccountDetailsSaved] = useState(false);
  const [accountDetailsLoaded, setAccountDetailsLoaded] = useState(false);
  const [redirectingBetweenFlows, setRedirectingBetweenFlows] = useState(false);
  const [showDocStep, setShowDocStep] = useState(false);
  const [showCvMethodChoice] = useState(flow === "cv" && !cvBuilder);
  const [cvText, setCvText] = useState("");
  const [structuredCv, setStructuredCv] = useState<StructuredCvData | null>(null);
  const [documents, setDocuments] = useState<YouthDocument[]>([]);
  const [docType, setDocType] = useState<YouthDocumentType>("grades");
  const [docUploading, setDocUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
    if (!loading && user && profile?.role === "company") router.replace("/company?view=swipe");
  }, [loading, user, profile, router]);

  useEffect(() => {
    if (loading || !user || profile?.role !== "youth") return;

    let active = true;
    void (async () => {
      try {
        const savedProfile = await getYouthProfile(user.id);
        if (!active) return;

        if (flow === "account") {
          if (savedProfile && hasAccountDetails(savedProfile)) {
            setRedirectingBetweenFlows(true);
            router.replace("/youth/cv");
          }
          return;
        }

        // The CV page is always CV-only. It may hydrate saved account details,
        // but it must never send a user back to the name/address/birthdate flow.
        if (savedProfile) {
          const nameParts = savedProfile.full_name?.trim().split(/\s+/) ?? [];
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
          setDocuments(Array.isArray(savedProfile.documents) ? savedProfile.documents : []);
          setAccountDetailsSaved(hasAccountDetails(savedProfile));
        }
        if (voiceFinalize) {
          try {
            const savedVoiceAnswers = JSON.parse(sessionStorage.getItem("employo-voice-cv-answers") ?? "{}") as Partial<Pick<Answers, "strengths" | "languages" | "work_experience" | "education" | "certificates">>;
            setAnswers((previous) => ({ ...previous, ...savedVoiceAnswers }));
            const savedStructuredCv = JSON.parse(sessionStorage.getItem("employo-voice-cv-structured") ?? "null") as StructuredCvData | null;
            if (savedStructuredCv) setStructuredCv(savedStructuredCv);
          } catch {
            // The final optional step is still available if the temporary voice data is unavailable.
          }
        }
        let restoredDraft = false;
        if (cvBuilder && !voiceFinalize) {
          try {
            const draft = JSON.parse(sessionStorage.getItem(cvDraftStorageKey) ?? "null") as {
              step?: number;
              answers?: Answers;
              workExperiences?: WorkExperience[];
              savedWorkExperiences?: boolean[];
              educations?: EducationEntry[];
              savedEducations?: boolean[];
              certificates?: CertificateEntry[];
              savedCertificates?: boolean[];
              selectedStrengths?: string[];
              selectedLanguages?: string[];
              otherEntries?: OtherEntry[];
              showCvStep?: boolean;
              cvText?: string;
            } | null;
            if (draft?.answers && typeof draft.step === "number" && draft.step >= FIRST_CV_STEP && draft.step < STEPS.length) {
              setAnswers((previous) => ({ ...previous, ...draft.answers }));
              setStep(draft.step);
              if (draft.workExperiences?.length) setWorkExperiences(draft.workExperiences);
              if (draft.savedWorkExperiences?.length) setSavedWorkExperiences(draft.savedWorkExperiences);
              if (draft.educations?.length) setEducations(draft.educations);
              if (draft.savedEducations?.length) setSavedEducations(draft.savedEducations);
              if (draft.certificates?.length) setCertificates(draft.certificates);
              if (draft.savedCertificates?.length) setSavedCertificates(draft.savedCertificates);
              setSelectedStrengths(draft.selectedStrengths ?? []);
              setSelectedLanguages(draft.selectedLanguages ?? []);
              setOtherEntries(draft.otherEntries ?? []);
              setShowCvStep(Boolean(draft.showCvStep));
              setCvText(draft.cvText ?? "");
              restoredDraft = true;
            }
          } catch {
            sessionStorage.removeItem(cvDraftStorageKey);
          }
        }
        if (!restoredDraft) setStep(voiceFinalize ? STEPS.length - 1 : FIRST_CV_STEP);
      } catch {
        // Keep the account-details flow available if the saved profile cannot be read.
      } finally {
        if (active) setAccountDetailsLoaded(true);
      }
    })();

    return () => {
      active = false;
    };
  }, [cvBuilder, cvDraftStorageKey, flow, loading, profile?.role, router, user, voiceFinalize]);

  useEffect(() => {
    if (flow !== "cv" || !cvBuilder || voiceFinalize || !accountDetailsLoaded) return;
    sessionStorage.setItem(cvDraftStorageKey, JSON.stringify({
      step,
      answers,
      workExperiences,
      savedWorkExperiences,
      educations,
      savedEducations,
      certificates,
      savedCertificates,
      selectedStrengths,
      selectedLanguages,
      otherEntries,
      showCvStep,
      cvText,
    }));
  }, [accountDetailsLoaded, answers, certificates, cvBuilder, cvDraftStorageKey, cvText, educations, flow, otherEntries, savedCertificates, savedEducations, savedWorkExperiences, selectedLanguages, selectedStrengths, showCvStep, step, voiceFinalize, workExperiences]);

  useEffect(() => {
    if (!cameraOpen || !cameraStreamRef.current || !cameraVideoRef.current) return;
    cameraVideoRef.current.srcObject = cameraStreamRef.current;
    void cameraVideoRef.current.play().catch(() => {
      setCameraError("Kamerabilden kunde inte startas. Försök igen och kontrollera kameratillståndet.");
    });
  }, [cameraOpen]);

  const current = STEPS[step];
  const isChips = current.type === "chips";
  const isLast = step === STEPS.length - 1;
  const isAccountDetailsFlow = step < ACCOUNT_DETAILS_STEP_COUNT;
  const flowStep = isAccountDetailsFlow ? step + 1 : step - ACCOUNT_DETAILS_STEP_COUNT + 1;
  const flowTotal = isAccountDetailsFlow ? ACCOUNT_DETAILS_STEP_COUNT : STEPS.length - ACCOUNT_DETAILS_STEP_COUNT;
  const progress = (flowStep / flowTotal) * 100;

  if (showAccountCreated) {
    return (
      <main className="mobile-shell" style={{ display: "flex", width: "100%", maxWidth: 560, minHeight: "100svh", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "2rem", textAlign: "center" }}>
        <p style={{ margin: 0, color: "#737373", fontSize: "1.05rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Välkommen till Employo</p>
        <h1 style={{ margin: "0.75rem 0", color: "#111", fontSize: "clamp(3.2rem, 10vw, 4.5rem)", letterSpacing: "-0.06em", lineHeight: 0.95 }}>Kontot är skapat!</h1>
        <p style={{ maxWidth: "31rem", margin: "0 0 2.25rem", color: "#555", fontSize: "1.3rem", lineHeight: 1.55 }}>Vill du fortsätta skapa ditt CV nu eller gå in på ditt konto?</p>
        <button type="button" className="cta-btn" onClick={() => router.push("/youth/cv")} style={{ width: "min(100%, 31rem)", padding: "1.3rem", fontSize: "1.2rem" }}>Fortsätt skapa mitt CV</button>
        <button type="button" className="secondary-btn" onClick={() => router.push("/swipe")} style={{ width: "min(100%, 31rem)", marginTop: "0.85rem", padding: "1.3rem", fontSize: "1.15rem" }}>Upptäck jobb</button>
      </main>
    );
  }

  // Do not briefly show the first flow to a returning user while their account
  // details are being loaded.
  if (!loading && user && profile?.role === "youth" && (!accountDetailsLoaded || redirectingBetweenFlows)) {
    return (
      <main className="youth-onboarding" style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", background: "#ffffff" }}>
        <p style={{ color: "#737373" }}>Laddar...</p>
      </main>
    );
  }

  /* ── CV preview / edit step ─────────────────────── */
  if (flow === "cv" && showCvMethodChoice) {
    return (
      <main className="youth-onboarding" style={{ display: "flex", flexDirection: "column", minHeight: "100vh", maxWidth: 430, margin: "0 auto", padding: "2rem 1.25rem", background: "var(--color-canvas)" }}>
        <div style={{ marginTop: "auto", marginBottom: "auto" }}>
          <p style={{ margin: 0, color: "var(--accent)", fontSize: ".76rem", fontWeight: 800, letterSpacing: ".08em", textTransform: "uppercase" }}>Ditt CV</p>
          <h1 style={{ margin: ".45rem 0 0", color: "var(--text-primary)", fontSize: "2.2rem", letterSpacing: "-.06em", lineHeight: 1 }}>Hur vill du skapa ditt CV?</h1>
          <p style={{ margin: "1rem 0 1.6rem", color: "var(--text-secondary)", lineHeight: 1.55 }}>Välj det som passar dig. Du kan alltid uppdatera ditt CV senare.</p>

          <div style={{ display: "grid", gap: ".75rem" }}>
            <button type="button" onClick={() => router.push("/youth/cv/create")} style={{ display: "grid", gap: ".3rem", padding: "1.15rem", border: 0, borderRadius: 16, color: "var(--color-on-brand)", background: "var(--accent)", font: "inherit", textAlign: "left", cursor: "pointer" }}>
              <strong style={{ fontSize: "1rem" }}>Skapa CV i Employo</strong>
              <span style={{ fontSize: ".82rem", opacity: .9 }}>Svara på några frågor så bygger vi CV:t tillsammans.</span>
            </button>
            <Link href="/voice-cv" style={{ position: "relative", display: "grid", gap: ".3rem", padding: "1.15rem", border: "1px solid var(--color-brand)", borderRadius: 16, color: "var(--text-primary)", background: "var(--surface)", textDecoration: "none", overflow: "hidden" }}>
              <span style={{ position: "absolute", top: 14, right: -35, width: 126, padding: ".28rem 0", color: "#ffffff", background: "#ec4899", fontSize: ".68rem", fontWeight: 800, letterSpacing: ".08em", lineHeight: 1, textAlign: "center", textTransform: "uppercase", transform: "rotate(45deg)", transformOrigin: "center", boxShadow: "0 2px 6px rgba(190,24,93,.28)" }}>Beta</span>
              <strong style={{ fontSize: "1rem" }}>Skapa CV med röstsamtal</strong>
              <span style={{ color: "var(--text-secondary)", fontSize: ".82rem" }}>Prata med AI:n och svara på frågorna med din röst.</span>
            </Link>
            <label style={{ display: "grid", gap: ".3rem", padding: "1.15rem", border: "1px solid var(--border)", borderRadius: 16, color: "var(--text-primary)", background: "var(--surface)", cursor: docUploading ? "wait" : "pointer" }}>
              <input type="file" accept="application/pdf,.pdf" onChange={(event) => void handleUploadedCvFinish(event)} disabled={docUploading} style={{ display: "none" }} />
              <strong style={{ fontSize: "1rem" }}>{docUploading ? "Laddar upp PDF..." : "Bifoga eget CV som PDF"}</strong>
              <span style={{ color: "var(--text-secondary)", fontSize: ".82rem" }}>Klart direkt - du behöver inte svara på fler frågor.</span>
            </label>
          </div>
          {error && <p style={{ margin: "1rem 0 0", color: "var(--color-danger)", fontSize: ".85rem" }}>{error}</p>}
        </div>
      </main>
    );
  }

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
        {cameraOpen && <div role="dialog" aria-modal="true" style={{ position: "fixed", zIndex: 20, inset: 0, display: "grid", placeItems: "center", padding: "1.25rem", background: "rgba(0,0,0,.65)" }}><div style={{ width: "min(100%, 25rem)", display: "grid", gap: ".8rem", padding: "1rem", borderRadius: 16, background: "#fff" }}><h2 style={{ margin: 0, fontSize: "1.1rem" }}>Ta en profilbild</h2><video ref={cameraVideoRef} autoPlay playsInline muted style={{ width: "100%", aspectRatio: "1 / 1", objectFit: "cover", borderRadius: 12, background: "#111" }} /><div style={{ display: "flex", gap: ".6rem" }}><button type="button" onClick={closeCamera} style={{ flex: 1, padding: ".8rem", border: "1px solid #ddd", borderRadius: 10, background: "#fff", font: "inherit", fontWeight: 700 }}>Avbryt</button><button type="button" onClick={takeCameraPhoto} style={{ flex: 1, padding: ".8rem", border: 0, borderRadius: 10, color: "#fff", background: "#111", font: "inherit", fontWeight: 700 }}>Ta bild</button></div></div></div>}
        {cropSource && <div role="dialog" aria-modal="true" style={{ position: "fixed", zIndex: 21, inset: 0, display: "grid", placeItems: "center", padding: "1.25rem", background: "rgba(0,0,0,.65)" }}><div style={{ width: "min(100%, 25rem)", display: "grid", gap: ".8rem", padding: "1rem", borderRadius: 16, background: "#fff" }}><h2 style={{ margin: 0, fontSize: "1.1rem" }}>Beskär din profilbild</h2><div style={{ position: "relative", width: "100%", aspectRatio: "1 / 1", overflow: "hidden", background: "#ddd" }}><img src={cropSource} alt="Förhandsgranskning" style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${cropZoom}) translate(${cropOffset.x * 20}%, ${cropOffset.y * 20}%)` }} /><div style={{ position: "absolute", inset: 12, border: "2px solid #fff", borderRadius: "50%", boxShadow: "0 0 0 999px rgba(0,0,0,.45)", pointerEvents: "none" }} /></div><label style={{ display: "grid", gap: ".3rem", fontSize: ".8rem", fontWeight: 700 }}>Zoom<input type="range" min="1" max="3" step=".01" value={cropZoom} onChange={(e) => setCropZoom(Number(e.target.value))} /></label><div style={{ display: "flex", gap: ".6rem" }}><button type="button" onClick={() => { URL.revokeObjectURL(cropSource); setCropSource(""); }} style={{ flex: 1, padding: ".8rem", border: "1px solid #ddd", borderRadius: 10, background: "#fff", font: "inherit", fontWeight: 700 }}>Avbryt</button><button type="button" onClick={() => void saveCroppedProfileImage()} disabled={docUploading} style={{ flex: 1, padding: ".8rem", border: 0, borderRadius: 10, color: "#fff", background: "#111", font: "inherit", fontWeight: 700 }}>Använd bild</button></div></div></div>}
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
            {saving ? "Sparar CV och PDF..." : "Spara mitt CV"}
          </button>
        </div>
      </main>
    );
  }

  /* ── Document upload step (optional) ──────────────────── */
  if (showDocStep && !cropSource) {
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
        {cameraOpen && <div role="dialog" aria-modal="true" style={{ position: "fixed", zIndex: 20, inset: 0, display: "grid", placeItems: "center", padding: "1.25rem", background: "rgba(0,0,0,.65)" }}><div style={{ width: "min(100%, 25rem)", display: "grid", gap: ".8rem", padding: "1rem", borderRadius: 16, background: "#fff" }}><h2 style={{ margin: 0, fontSize: "1.1rem" }}>Ta en profilbild</h2><video ref={cameraVideoRef} autoPlay playsInline muted style={{ width: "100%", aspectRatio: "1 / 1", objectFit: "cover", borderRadius: 12, background: "#111" }} /><div style={{ display: "flex", gap: ".6rem" }}><button type="button" onClick={closeCamera} style={{ flex: 1, padding: ".8rem", border: "1px solid #ddd", borderRadius: 10, background: "#fff", font: "inherit", fontWeight: 700 }}>Avbryt</button><button type="button" onClick={takeCameraPhoto} style={{ flex: 1, padding: ".8rem", border: 0, borderRadius: 10, color: "#fff", background: "#111", font: "inherit", fontWeight: 700 }}>Ta bild</button></div></div></div>}
        {cropSource && <div role="dialog" aria-modal="true" style={{ position: "fixed", zIndex: 21, inset: 0, display: "grid", placeItems: "center", padding: "1.25rem", background: "rgba(0,0,0,.65)" }}><div style={{ width: "min(100%, 25rem)", display: "grid", gap: ".8rem", padding: "1rem", borderRadius: 16, background: "#fff" }}><h2 style={{ margin: 0, fontSize: "1.1rem" }}>Beskär din profilbild</h2><div style={{ position: "relative", width: "100%", aspectRatio: "1 / 1", overflow: "hidden", background: "#ddd" }}><img src={cropSource} alt="Förhandsgranskning" style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${cropZoom}) translate(${cropOffset.x * 20}%, ${cropOffset.y * 20}%)` }} /><div style={{ position: "absolute", inset: 12, border: "2px solid #fff", borderRadius: "50%", boxShadow: "0 0 0 999px rgba(0,0,0,.45)", pointerEvents: "none" }} /></div><label style={{ display: "grid", gap: ".3rem", fontSize: ".8rem", fontWeight: 700 }}>Zoom<input type="range" min="1" max="3" step=".01" value={cropZoom} onChange={(e) => setCropZoom(Number(e.target.value))} /></label><label style={{ display: "grid", gap: ".3rem", fontSize: ".8rem", fontWeight: 700 }}>Flytta vågrätt<input type="range" min="-1" max="1" step=".01" value={cropOffset.x} onChange={(e) => setCropOffset((previous) => ({ ...previous, x: Number(e.target.value) }))} /></label><label style={{ display: "grid", gap: ".3rem", fontSize: ".8rem", fontWeight: 700 }}>Flytta lodrätt<input type="range" min="-1" max="1" step=".01" value={cropOffset.y} onChange={(e) => setCropOffset((previous) => ({ ...previous, y: Number(e.target.value) }))} /></label><div style={{ display: "flex", gap: ".6rem" }}><button type="button" onClick={() => { URL.revokeObjectURL(cropSource); setCropSource(""); }} style={{ flex: 1, padding: ".8rem", border: "1px solid #ddd", borderRadius: 10, background: "#fff", font: "inherit", fontWeight: 700 }}>Avbryt</button><button type="button" onClick={() => void saveCroppedProfileImage()} disabled={docUploading} style={{ flex: 1, padding: ".8rem", border: 0, borderRadius: 10, color: "#fff", background: "#111", font: "inherit", fontWeight: 700 }}>Använd bild</button></div></div></div>}
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
              Visa vem du är! En profilbild ger arbetsgivare ett bättre första intryck (valfritt)
            </p>
          </div>
          <p style={{ fontSize: "0.85rem", color: "#737373", marginTop: "0.75rem", lineHeight: 1.55 }}>
            Välj en bild eller ta en ny med kameran. Du kan sedan beskära den till din profilbild.
          </p>
        </div>

        <div style={{ display: "grid", gap: ".75rem", marginBottom: "1rem" }}>
          <div style={{ width: "100%", aspectRatio: "1 / 1", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: ".7rem", border: "1.5px dashed #d1d1d1", borderRadius: 16, color: "#737373", overflow: "hidden", background: "#fafafa" }}>
            {answers.profile_image ? <img src={answers.profile_image} alt="Profilbild" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <><span style={{ fontSize: "2.2rem" }}>👤</span><span style={{ fontSize: ".9rem", fontWeight: 600 }}>Välj eller ta en profilbild</span></>}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: ".65rem" }}>
            <label style={{ display: "grid", placeItems: "center", padding: ".8rem", border: "1.5px solid #49636a", borderRadius: 10, color: "#49636a", fontSize: ".85rem", fontWeight: 700, cursor: docUploading ? "wait" : "pointer" }}><input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleProfileImageSelect} disabled={docUploading} style={{ display: "none" }} />Bifoga bild</label>
            <button type="button" onClick={() => void openCamera()} disabled={docUploading} style={{ display: "grid", placeItems: "center", padding: ".8rem", border: 0, borderRadius: 10, color: "#fff", background: "#111", font: "inherit", fontSize: ".85rem", fontWeight: 700, cursor: docUploading ? "wait" : "pointer" }}>Ta bild</button>
          </div>
        </div>
        <div style={{ display: "none" }} aria-hidden="true">
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

        </div>
        {error && (
          <p style={{ fontSize: "0.85rem", color: "#c0392b", marginBottom: "0.75rem" }}>{error}</p>
        )}
        {cameraError && <p style={{ fontSize: "0.85rem", color: "#c0392b", marginBottom: "0.75rem" }}>{cameraError}</p>}

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
            onClick={() => router.replace("/swipe")}
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
            Hoppa över
          </button>
        </div>
      </main>
    );
  }

  function handleTextChange(val: string) {
    setAnswers((prev) => ({ ...prev, [current.field]: val }));
  }

  function setSelectedValues(field: "strengths" | "languages", values: string[]) {
    const value = values.join(", ");
    if (field === "strengths") setSelectedStrengths(values);
    else setSelectedLanguages(values);
    setAnswers((previous) => ({ ...previous, [field]: value }));
  }

  function toggleSelectedValue(field: "strengths" | "languages", value: string) {
    const selected = field === "strengths" ? selectedStrengths : selectedLanguages;
    setSelectedValues(field, selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value]);
  }

  function saveCustomValue(field: "strengths" | "languages") {
    const value = (field === "strengths" ? strengthInput : languageInput).trim();
    if (!value) return;
    const selected = field === "strengths" ? selectedStrengths : selectedLanguages;
    setSelectedValues(field, selected.includes(value) ? selected : [...selected, value]);
    if (field === "strengths") setStrengthInput("");
    else setLanguageInput("");
  }

  const isCompleteMonth = (value: string) => /^\d{4}-\d{2}$/.test(value);
  const hasValidDateRange = (startDate: string, endDate: string) =>
    !isCompleteMonth(startDate) || !isCompleteMonth(endDate) || startDate <= endDate;
  const canSelectDatePart = (
    field: "start_date" | "end_date",
    part: "month" | "year",
    value: string,
    startDate: string,
    endDate: string,
  ) => {
    const currentDate = field === "start_date" ? startDate : endDate;
    const [currentYear = "", currentMonth = ""] = currentDate.split("-");
    const nextDate = `${part === "year" ? value : currentYear}-${part === "month" ? value : currentMonth}`;
    return field === "start_date"
      ? hasValidDateRange(nextDate, endDate)
      : hasValidDateRange(startDate, nextDate);
  };
  const workExperienceIsComplete = (experience: WorkExperience) =>
    Boolean(experience.title.trim() && experience.company.trim() && experience.location.trim() && experience.location_type && experience.employment_type && isCompleteMonth(experience.start_date) && (experience.is_current || isCompleteMonth(experience.end_date)) && (experience.is_current || hasValidDateRange(experience.start_date, experience.end_date)) && experience.description.trim());
  const educationIsComplete = (education: EducationEntry) =>
    Boolean(education.school.trim() && education.degree.trim() && education.subject.trim() && isCompleteMonth(education.start_date) && isCompleteMonth(education.end_date) && hasValidDateRange(education.start_date, education.end_date) && education.description.trim());
  const certificateIsComplete = (certificate: CertificateEntry) =>
    Boolean(certificate.name.trim() && certificate.issuer.trim() && certificate.category && certificate.issue_date && certificate.expiry_date && certificate.credential_url.trim() && certificate.description.trim());

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
        [experience.start_date, experience.is_current ? "Nuvarande" : experience.end_date].filter(Boolean).join(" – "),
        [experience.location, experience.location_type].filter(Boolean).join(" · "),
        experience.description,
      ].filter(Boolean).join("\n"))
      .join("\n\n");
  }

  function formatEducations() {
    return educations.filter((education) => Object.values(education).some(Boolean)).map((education) => [
      [education.degree, education.school].filter(Boolean).join(" · "),
      education.subject,
      [education.start_date, education.end_date].filter(Boolean).join(" – "),
      education.description,
    ].filter(Boolean).join("\n")).join("\n\n");
  }

  function formatCertificates() {
    return certificates.filter((certificate) => Object.values(certificate).some(Boolean)).map((certificate) => [
      [certificate.name, certificate.issuer].filter(Boolean).join(" · "),
      certificate.category,
      [certificate.issue_date, certificate.expiry_date].filter(Boolean).join(" – "),
      certificate.credential_url,
      certificate.description,
      certificate.pdf_url,
    ].filter(Boolean).join("\n")).join("\n\n");
  }

  function updateEducationDate(index: number, field: "start_date" | "end_date", part: "month" | "year", value: string) {
    setEducations((previous) => previous.map((item, itemIndex) => {
      if (itemIndex !== index) return item;
      const [currentYear = "", currentMonth = ""] = item[field].split("-");
      const year = part === "year" ? value : currentYear;
      const month = part === "month" ? value : currentMonth;
      const nextDate = year || month ? `${year}-${month}` : "";
      const next = { ...item, [field]: nextDate };
      if (!hasValidDateRange(next.start_date, next.end_date)) {
        setError("Slutdatum kan inte vara före startdatum.");
        return item;
      }
      setError("");
      return next;
    }));
  }

  function updateExperienceDate(index: number, field: "start_date" | "end_date", part: "month" | "year", value: string) {
    setWorkExperiences((previous) => previous.map((item, itemIndex) => {
      if (itemIndex !== index) return item;
      const [currentYear = "", currentMonth = ""] = item[field].split("-");
      const year = part === "year" ? value : currentYear;
      const month = part === "month" ? value : currentMonth;
      const nextDate = year || month ? `${year}-${month}` : "";
      const next = { ...item, [field]: nextDate };
      if (!hasValidDateRange(next.start_date, next.end_date)) {
        setError("Slutdatum kan inte vara före startdatum.");
        return item;
      }
      setError("");
      return next;
    }));
  }

  function updateCertificateDate(index: number, field: "issue_date" | "expiry_date", part: "month" | "year", value: string) {
    setCertificates((previous) => previous.map((item, itemIndex) => {
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
        setAccountDetailsSaved(true);
        // The identity steps are a one-way gate. Continue directly to the CV
        // method choice so browser history cannot return to those questions.
        router.replace("/youth/cv");
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : "Kunde inte spara dina uppgifter.");
      } finally {
        setSaving(false);
      }
      return;
    }
    if (current.field === "work_experience") {
      const missingRequiredExperience = workExperiences.some((experience, index) => !workExperienceIsComplete(experience) || !savedWorkExperiences[index]);
      if (missingRequiredExperience) {
        setError("Fyll i alla fält och spara varje arbetserfarenhet innan du går vidare.");
        return;
      }
    }
    if (current.field === "education") {
      const missingEducation = educations.some((education, index) => !educationIsComplete(education) || !savedEducations[index]);
      if (missingEducation) {
        setError("Fyll i alla fält och spara varje utbildning innan du går vidare.");
        return;
      }
    }
    if (current.field === "certificates") {
      const missingCertificate = certificates.some((certificate, index) => !certificateIsComplete(certificate) || !savedCertificates[index]);
      if (missingCertificate) {
        setError("Fyll i alla fält och spara varje certifikat innan du går vidare.");
        return;
      }
    }
    if (!isLast) {
      setError("");
      setStep((s) => s + 1);
      return;
    }
    const formattedWorkExperience = formatWorkExperiences();
    const formattedEducation = formatEducations();
    const formattedCertificates = formatCertificates();
    const coreAreas = [
      { field: "strengths" as const, label: "egenskaper", value: answers.strengths.trim() },
      { field: "languages" as const, label: "språk", value: answers.languages.trim() },
      { field: "work_experience" as const, label: "erfarenhet", value: formattedWorkExperience || answers.work_experience.trim() },
      { field: "education" as const, label: "utbildning", value: formattedEducation || answers.education.trim() },
      { field: "certificates" as const, label: "certifikat eller licenser", value: formattedCertificates || answers.certificates.trim() },
    ];
    const answeredAreaCount = coreAreas.filter((area) => area.value).length;
    if (answeredAreaCount < 3) {
      const firstMissingArea = coreAreas.find((area) => !area.value);
      const missingLabels = coreAreas.filter((area) => !area.value).map((area) => area.label).join(", ");
      if (firstMissingArea) setStep(STEPS.findIndex((candidate) => candidate.field === firstMissingArea.field));
      setError(`Svara på minst 3 av de 5 CV-områdena innan CV:t skapas. Du har svarat på ${answeredAreaCount}. Komplettera till exempel: ${missingLabels}.`);
      return;
    }
    // Generate the CV only after the frontend has enough real information.
    setSaving(true);
    setError("");
    let generated = "";
    const answersForCv = {
      ...answers,
      extracurriculars: formatOtherEntries(),
      work_experience: formattedWorkExperience || answers.work_experience,
      education: formattedEducation || answers.education,
      certificates: formattedCertificates || answers.certificates,
    };
    const cvPayload = {
      ...answersForCv,
      work_experiences: workExperiences.map(({ title, company, location, location_type, employment_type, start_date, end_date, is_current, description }) => ({ title, company, location, location_type, employment_type, start_date, end_date, is_current, description })),
      educations: educations.map(({ school, degree, subject, start_date, end_date, description }) => ({ school, degree, subject, start_date, end_date, description })),
      certificate_entries: certificates.map(({ name, issuer, category, issue_date, expiry_date, credential_url, description }) => ({ name, issuer, category, issue_date, expiry_date, credential_url, description })),
      other_entries: otherEntries.map(({ title, type, value }) => ({ title, type, value })),
    };
    try {
      const res = await fetch("/api/youth/cv/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cvPayload),
      });
      if (res.ok) {
        const data = (await res.json()) as { cv: string; structured?: StructuredCvData };
        generated = data.cv;
        if (data.structured) setStructuredCv(data.structured);
      }
    } catch {
      // silently fall through to local template
    }
    if (!generated) {
      generated = buildStructuredCvFallback(answersForCv);
      setStructuredCv(structuredCvFromForm(cvPayload));
    }
    setAnswers(answersForCv);
    setSaving(false);
    setCvText(generated);
    setShowCvStep(true);
  }

  async function handleSaveCv() {
    await handleSaveWithDocs();
  }

  async function handleUploadedCvFinish(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      setError("Välj en PDF-fil för ditt CV.");
      return;
    }

    setDocUploading(true);
    setError("");
    try {
      const url = await uploadYouthDocument(file);
      await saveUploadedCvToProfile({ name: file.name, url, type: "cv" });
      sessionStorage.removeItem(cvDraftStorageKey);
      router.replace("/swipe");
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Kunde inte spara ditt CV.");
    } finally {
      setDocUploading(false);
      event.target.value = "";
    }
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

  function handleProfileImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    const source = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => setCropDimensions({ width: image.naturalWidth, height: image.naturalHeight });
    image.src = source;
    setCropZoom(1);
    setCropOffset({ x: 0, y: 0 });
    setCropSource(source);
    e.target.value = "";
  }

  async function openCamera() {
    setCameraError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      cameraStreamRef.current = stream;
      setCameraOpen(true);
      window.setTimeout(() => {
        if (cameraVideoRef.current) {
          cameraVideoRef.current.srcObject = stream;
          void cameraVideoRef.current.play();
        }
      }, 0);
    } catch {
      setCameraError("Kameran kunde inte öppnas. Kontrollera att du har gett webbläsaren kameratillstånd.");
    }
  }

  function closeCamera() {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    setCameraOpen(false);
  }

  function takeCameraPhoto() {
    const video = cameraVideoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const source = URL.createObjectURL(blob);
      setCropDimensions({ width: video.videoWidth, height: video.videoHeight });
      setCropZoom(1);
      setCropOffset({ x: 0, y: 0 });
      setCropSource(source);
      closeCamera();
    }, "image/jpeg", 0.92);
  }

  function startCropDrag(event: React.PointerEvent<HTMLDivElement>) {
    cropDragRef.current = { x: event.clientX, y: event.clientY, offsetX: cropOffset.x, offsetY: cropOffset.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveCropDrag(event: React.PointerEvent<HTMLDivElement>) {
    const drag = cropDragRef.current;
    if (!drag) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    setCropOffset({
      x: Math.max(-1, Math.min(1, drag.offsetX + (event.clientX - drag.x) / (bounds.width / 2))),
      y: Math.max(-1, Math.min(1, drag.offsetY + (event.clientY - drag.y) / (bounds.height / 2))),
    });
  }

  function endCropDrag() {
    cropDragRef.current = null;
  }

  function formatOtherEntries() {
    return otherEntries.map((entry) => [entry.title, entry.value || entry.file?.url].filter(Boolean).join(" · ")).join("\n\n");
  }

  function saveOtherEntry() {
    const value = otherType === "write" ? answers.extracurriculars.trim() : otherType === "link" ? otherLink.trim() : otherPdf?.url ?? "";
    if (!otherType || !otherTitle.trim() || !value) {
      setError("Välj ett sätt att lägga till innehåll och fyll i titel samt innehåll.");
      return;
    }
    setOtherEntries((previous) => [...previous, { title: otherTitle.trim(), type: otherType, value, file: otherPdf ?? undefined }]);
    setAnswers((previous) => ({ ...previous, extracurriculars: "" }));
    setOtherTitle("");
    setOtherLink("");
    setOtherPdf(null);
    setOtherType("");
    setError("");
  }

  async function saveCroppedProfileImage() {
    if (!cropSource || !cropDimensions.width || !cropDimensions.height) return;
    const cropSize = 280;
    const outputSize = 512;
    const baseScale = Math.max(cropSize / cropDimensions.width, cropSize / cropDimensions.height);
    const imageWidth = cropDimensions.width * baseScale * cropZoom;
    const imageHeight = cropDimensions.height * baseScale * cropZoom;
    const maxX = Math.max(0, (imageWidth - cropSize) / 2);
    const maxY = Math.max(0, (imageHeight - cropSize) / 2);
    const left = (cropSize - imageWidth) / 2 + cropOffset.x * maxX;
    const top = (cropSize - imageHeight) / 2 + cropOffset.y * maxY;
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Kunde inte läsa bilden."));
      image.src = cropSource;
    });
    const canvas = document.createElement("canvas");
    canvas.width = outputSize;
    canvas.height = outputSize;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.beginPath();
    context.arc(outputSize / 2, outputSize / 2, outputSize / 2, 0, Math.PI * 2);
    context.clip();
    const factor = outputSize / cropSize;
    context.drawImage(image, left * factor, top * factor, imageWidth * factor, imageHeight * factor);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) return;
    setDocUploading(true);
    setError("");
    try {
      const url = await uploadYouthDocument(new File([blob], "profilbild.png", { type: "image/png" }));
      setAnswers((previous) => ({ ...previous, profile_image: url }));
      URL.revokeObjectURL(cropSource);
      setCropSource("");
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Kunde inte ladda upp profilbilden.");
    } finally {
      setDocUploading(false);
    }
  }

  async function handleOtherPdfSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setDocUploading(true);
    setError("");
    try {
      const url = await uploadYouthDocument(file);
      setOtherPdf({ name: file.name, url, type: "other" });
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Kunde inte ladda upp PDF-filen.");
    } finally {
      setDocUploading(false);
      e.target.value = "";
    }
  }

  async function handleCertificatePdfSelect(index: number, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setDocUploading(true);
    setError("");
    try {
      const url = await uploadYouthDocument(file);
      setCertificates((previous) => previous.map((item, itemIndex) => itemIndex === index ? { ...item, pdf_url: url } : item));
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
      // Every Employo-created CV is saved as both editable text and a PDF.
      // This makes the PDF available from the profile without requiring a
      // separate download action during onboarding.
      const pdfFile = await createCvPdfFile(cvText, answers.full_name);
      const pdfUrl = await uploadYouthDocument(pdfFile);
      const generatedCvDocument: YouthDocument = { name: pdfFile.name, url: pdfUrl, type: "generated_cv" };
      const otherDocuments = otherEntries.flatMap((entry) => entry.file ? [entry.file] : []);

      await completeYouthOnboarding({
        ...answers,
        extracurriculars: formatOtherEntries(),
        work_experience: formatWorkExperiences() || answers.work_experience,
        education: formatEducations() || answers.education,
        certificates: formatCertificates() || answers.certificates,
        cv_text: cvText,
        cv_structured: structuredCv ?? structuredCvFromForm({
          ...answers,
          work_experiences: workExperiences,
          educations,
          certificate_entries: certificates,
          other_entries: otherEntries,
        }),
        documents: [
          ...documents.filter((document) => document.type !== "generated_cv"),
          ...otherDocuments,
          generatedCvDocument,
        ],
      });
      sessionStorage.removeItem(cvDraftStorageKey);
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
  const selectionField = current.field === "strengths" || current.field === "languages" ? current.field : null;
  const cropSize = 280;
  const cropBaseScale = cropDimensions.width && cropDimensions.height ? Math.max(cropSize / cropDimensions.width, cropSize / cropDimensions.height) : 1;
  const cropImageWidth = cropDimensions.width * cropBaseScale * cropZoom;
  const cropImageHeight = cropDimensions.height * cropBaseScale * cropZoom;
  const cropImageLeft = (cropSize - cropImageWidth) / 2 + cropOffset.x * Math.max(0, (cropImageWidth - cropSize) / 2);
  const cropImageTop = (cropSize - cropImageHeight) / 2 + cropOffset.y * Math.max(0, (cropImageHeight - cropSize) / 2);

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
      <style>{'label:has(input[type="file"][accept*=".pdf"]) { color: #a3a3a3 !important; font-size: .85rem !important; font-weight: 400 !important; }'}</style>
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
      {cropSource && (
        <div role="dialog" aria-modal="true" aria-label="Beskär profilbild" style={{ position: "fixed", zIndex: 10, inset: 0, display: "grid", placeItems: "center", padding: "1.25rem", background: "rgba(0, 0, 0, .62)" }}>
          <div style={{ width: "min(100%, 25rem)", display: "grid", gap: "1rem", padding: "1.25rem", borderRadius: 16, background: "#fff" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: "1.15rem", color: "#111" }}>Beskär din profilbild</h2>
              <p style={{ margin: ".35rem 0 0", color: "#737373", fontSize: ".82rem", lineHeight: 1.45 }}>Cirkeln visar den bild som kommer att användas i din profil.</p>
            </div>
            <div onPointerDown={startCropDrag} onPointerMove={moveCropDrag} onPointerUp={endCropDrag} onPointerCancel={endCropDrag} style={{ width: cropSize, height: cropSize, maxWidth: "100%", justifySelf: "center", position: "relative", overflow: "hidden", background: "#e8e8e8", cursor: "grab", touchAction: "none" }}>
              <img src={cropSource} alt="Förhandsgranskning för beskärning" style={{ position: "absolute", width: cropImageWidth, height: cropImageHeight, maxWidth: "none", left: cropImageLeft, top: cropImageTop, userSelect: "none", pointerEvents: "none" }} />
              <div aria-hidden="true" style={{ position: "absolute", inset: 10, border: "2px solid #fff", borderRadius: "50%", boxShadow: "0 0 0 999px rgba(0,0,0,.46)", pointerEvents: "none" }} />
            </div>
            <label style={{ display: "grid", gap: ".35rem", color: "#555", fontSize: ".8rem", fontWeight: 700 }}>Zoom<input type="range" min="1" max="3" step="0.01" value={cropZoom} onChange={(e) => setCropZoom(Number(e.target.value))} /></label>
            <label style={{ display: "grid", gap: ".35rem", color: "#555", fontSize: ".8rem", fontWeight: 700 }}>Flytta vågrätt<input type="range" min="-1" max="1" step="0.01" value={cropOffset.x} onChange={(e) => setCropOffset((previous) => ({ ...previous, x: Number(e.target.value) }))} /></label>
            <label style={{ display: "grid", gap: ".35rem", color: "#555", fontSize: ".8rem", fontWeight: 700 }}>Flytta lodrätt<input type="range" min="-1" max="1" step="0.01" value={cropOffset.y} onChange={(e) => setCropOffset((previous) => ({ ...previous, y: Number(e.target.value) }))} /></label>
            <div style={{ display: "flex", gap: ".65rem" }}>
              <button type="button" onClick={() => { URL.revokeObjectURL(cropSource); setCropSource(""); }} style={{ flex: 1, padding: ".8rem", border: "1px solid #ddd", borderRadius: 10, background: "#fff", font: "inherit", fontWeight: 700, cursor: "pointer" }}>Avbryt</button>
              <button type="button" onClick={() => void saveCroppedProfileImage()} disabled={docUploading} style={{ flex: 1, padding: ".8rem", border: 0, borderRadius: 10, color: "#fff", background: "#111", font: "inherit", fontWeight: 700, cursor: docUploading ? "wait" : "pointer" }}>{docUploading ? "Sparar..." : "Använd bild"}</button>
            </div>
          </div>
        </div>
      )}
      {/* Progress bar */}
      <div style={{ paddingTop: "3rem", paddingBottom: "2.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem" }}>
          <span style={{ fontSize: "0.95rem", color: "#737373", fontWeight: 700, letterSpacing: "0.05em" }}>
            {flowStep} / {flowTotal}
          </span>
          {((isAccountDetailsFlow && !accountDetailsSaved && step > 0) || (!voiceFinalize && !isAccountDetailsFlow && (step > FIRST_CV_STEP || cvBuilder))) && (
            <button
              type="button"
              onClick={() => {
                setError("");
                if (!isAccountDetailsFlow && step === FIRST_CV_STEP) router.push("/youth/cv");
                else setStep((currentStep) => currentStep - 1);
              }}
              aria-label={step === FIRST_CV_STEP ? "Tillbaka till CV-val" : "Tillbaka"}
              title={step === FIRST_CV_STEP ? "Tillbaka till CV-val" : "Tillbaka"}
              style={{ minWidth: step === FIRST_CV_STEP ? 32 : undefined, minHeight: step === FIRST_CV_STEP ? 32 : undefined, fontSize: "0.8rem", color: "#737373", background: "none", border: "none", cursor: "pointer", padding: step === FIRST_CV_STEP ? 0 : undefined }}
            >
              {step === FIRST_CV_STEP ? "←" : "← Tillbaka"}
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
            display: current.type === "image" ? "block" : "inline-block",
            background: current.type === "image" ? "transparent" : "#f5f5f5",
            borderRadius: current.type === "image" ? 0 : "4px 16px 16px 16px",
            padding: current.type === "image" ? 0 : "1rem 1.25rem",
            maxWidth: current.type === "image" ? "100%" : "88%",
          }}
        >
          {current.type === "image" ? (
            <h1 style={{ margin: 0, fontSize: "1.55rem", fontWeight: 700, color: "#111111", lineHeight: 1.35, letterSpacing: "-0.03em" }}>
              {current.question}
            </h1>
          ) : (
            <p className="onboarding-question-title" style={{ margin: 0, fontSize: "1.55rem", fontWeight: 700, color: "#111111", lineHeight: 1.5, whiteSpace: "pre-line" }}>
              {current.question}
            </p>
          )}
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
          <div style={{ display: "grid", gap: ".75rem" }}>
            <div style={{ width: "100%", aspectRatio: "1 / 1", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: ".7rem", border: "1.5px dashed #d1d1d1", borderRadius: 16, color: "#737373", overflow: "hidden", background: "#fafafa" }}>
              {answers.profile_image ? <img src={answers.profile_image} alt="Profilbild" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <><span style={{ fontSize: "2.2rem" }}>👤</span><span style={{ fontSize: ".9rem", fontWeight: 600 }}>Välj eller ta en profilbild</span></>}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: ".65rem" }}>
              <label style={{ display: "grid", placeItems: "center", padding: ".8rem", border: "1.5px solid #49636a", borderRadius: 10, color: "#49636a", fontSize: ".85rem", fontWeight: 700, cursor: docUploading ? "wait" : "pointer" }}><input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleProfileImageSelect} disabled={docUploading} style={{ display: "none" }} />Bifoga bild</label>
              <label style={{ display: "grid", placeItems: "center", padding: ".8rem", border: 0, borderRadius: 10, color: "#fff", background: "#111", fontSize: ".85rem", fontWeight: 700, cursor: docUploading ? "wait" : "pointer" }}><input type="file" accept="image/jpeg,image/png,image/webp" capture="user" onChange={handleProfileImageSelect} disabled={docUploading} style={{ display: "none" }} />Ta bild</label>
            </div>
            <p style={{ margin: 0, color: "#737373", fontSize: ".75rem", textAlign: "center" }}>När du har valt en bild kan du beskära den till profilbilden.</p>
          </div>
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
                  </>
                ) : <>
                <p style={{ margin: 0, color: "#737373", fontSize: "0.78rem", fontWeight: 700 }}>Arbetserfarenhet {index + 1}</p>
                {workExperiences.length > 1 && <button type="button" onClick={() => { setWorkExperiences((previous) => previous.filter((_, experienceIndex) => experienceIndex !== index)); setSavedWorkExperiences((previous) => previous.filter((_, experienceIndex) => experienceIndex !== index)); }} aria-label={`Ta bort arbetserfarenhet ${index + 1}`} style={{ position: "absolute", top: "0.65rem", right: "0.65rem", display: "grid", width: "1.8rem", height: "1.8rem", placeItems: "center", border: "1px solid #e8e8e8", borderRadius: "50%", color: "#737373", background: "#ffffff", fontSize: "1rem", cursor: "pointer" }}>×</button>}
                {(["title", "company", "location"] as const).map((field) => <label key={field} style={{ display: "grid", gap: "0.3rem", color: "#a3a3a3", fontSize: "0.72rem", fontWeight: 600 }}>{field === "title" ? "Titel" : field === "company" ? "Arbetsgivare" : "Plats"}<input type="text" list={field === "title" ? "youth-job-title-suggestions" : field === "company" ? "youth-company-name-suggestions" : "youth-city-suggestions"} value={experience[field]} onChange={(e) => setWorkExperiences((previous) => previous.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: e.target.value } : item))} placeholder={field === "title" ? "T.ex. Butiksmedarbetare" : field === "company" ? "T.ex. ICA" : "T.ex. Stockholm"} style={{ width: "100%", boxSizing: "border-box", height: "3rem", padding: "0 1rem", borderRadius: 10, border: "1.5px solid #e8e8e8", fontSize: "1rem", outline: "none", fontFamily: "inherit", color: "#111111", background: "#ffffff" }} /></label>)}
                <label style={{ display: "grid", gap: "0.3rem", color: "#a3a3a3", fontSize: "0.72rem", fontWeight: 600 }}>Platstyp<select value={experience.location_type} onChange={(e) => setWorkExperiences((previous) => previous.map((item, itemIndex) => itemIndex === index ? { ...item, location_type: e.target.value } : item))} style={{ width: "100%", height: "3rem", padding: "0 1rem", borderRadius: 10, border: "1.5px solid #e8e8e8", color: experience.location_type ? "#111" : "#a3a3a3", background: "#fff", font: "inherit", fontSize: "1rem" }}><option value="">Välj</option><option value="På plats">På plats</option><option value="Hybrid">Hybrid</option><option value="Distans">Distans</option></select></label>
                <label style={{ display: "grid", gap: "0.3rem", color: "#a3a3a3", fontSize: "0.72rem", fontWeight: 600 }}>Anställningstyp<select value={experience.employment_type} onChange={(e) => setWorkExperiences((previous) => previous.map((item, itemIndex) => itemIndex === index ? { ...item, employment_type: e.target.value } : item))} style={{ width: "100%", height: "3rem", padding: "0 1rem", borderRadius: 10, border: "1.5px solid #e8e8e8", color: experience.employment_type ? "#111" : "#a3a3a3", background: "#fff", font: "inherit", fontSize: "1rem" }}><option value="">Välj</option><option value="Deltid">Deltid</option><option value="Heltid">Heltid</option><option value="Sommarjobb">Sommarjobb</option><option value="Praktik">Praktik</option><option value="Extraarbete">Extraarbete</option></select></label>
                <label style={{ display: "flex", alignItems: "center", gap: ".5rem", color: "#737373", fontSize: ".8rem", cursor: "pointer" }}><input type="checkbox" checked={experience.is_current} onChange={(e) => setWorkExperiences((previous) => previous.map((item, itemIndex) => itemIndex === index ? { ...item, is_current: e.target.checked, end_date: e.target.checked ? "" : item.end_date } : item))} /> Detta är min nuvarande arbetsplats</label>
                <div style={{ display: "grid", gridTemplateColumns: experience.is_current ? "1fr" : "1fr 1fr", gap: "0.6rem" }}>
                  {((experience.is_current ? ["start_date"] : ["start_date", "end_date"]) as Array<"start_date" | "end_date">).map((dateField) => {
                    const [year = "", month = ""] = experience[dateField].split("-");
                    return <div key={dateField} style={{ color: "#737373", fontSize: "0.75rem" }}>
                      <span>{dateField === "start_date" ? "Startdatum" : "Slutdatum"}</span>
                      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.9fr", gap: "0.4rem", marginTop: "0.3rem" }}>
                        <select value={month} onChange={(e) => updateExperienceDate(index, dateField, "month", e.target.value)} aria-label={`${dateField === "start_date" ? "Startdatum" : "Slutdatum"} månad`} style={{ width: "100%", boxSizing: "border-box", height: "3rem", padding: "0 0.4rem", borderRadius: 10, border: "1.5px solid #e8e8e8", color: "#111", background: "#fff", font: "inherit" }}><option value="">Månad</option>{BIRTH_MONTHS.map((monthName, monthIndex) => { const value = String(monthIndex + 1).padStart(2, "0"); return <option key={monthName} value={value} disabled={!canSelectDatePart(dateField, "month", value, experience.start_date, experience.end_date)}>{monthName}</option>; })}</select>
                        <select value={year} onChange={(e) => updateExperienceDate(index, dateField, "year", e.target.value)} aria-label={`${dateField === "start_date" ? "Startdatum" : "Slutdatum"} år`} style={{ width: "100%", boxSizing: "border-box", height: "3rem", padding: "0 0.4rem", borderRadius: 10, border: "1.5px solid #e8e8e8", color: "#111", background: "#fff", font: "inherit" }}><option value="">År{dateField === "start_date" ? " *" : ""}</option>{WORK_YEARS.map((workYear) => <option key={workYear} value={workYear} disabled={!canSelectDatePart(dateField, "year", workYear, experience.start_date, experience.end_date)}>{workYear}</option>)}</select>
                      </div>
                    </div>;
                  })}
                </div>
                <label style={{ display: "grid", gap: "0.3rem", color: "#a3a3a3", fontSize: "0.72rem", fontWeight: 600 }}>Beskrivning<textarea value={experience.description} onChange={(e) => setWorkExperiences((previous) => previous.map((item, itemIndex) => itemIndex === index ? { ...item, description: e.target.value } : item))} placeholder="T.ex. Jag hjälpte kunder och fyllde på varor" rows={3} style={{ width: "100%", boxSizing: "border-box", padding: "0.875rem 1rem", borderRadius: 10, border: "1.5px solid #e8e8e8", fontSize: "1rem", outline: "none", resize: "vertical", fontFamily: "inherit", color: "#111111", background: "#ffffff" }} /></label>
                <button type="button" onClick={() => { if (!workExperienceIsComplete(experience)) { setError("Fyll i alla fält för att spara erfarenheten."); return; } setError(""); setSavedWorkExperiences((previous) => previous.map((saved, savedIndex) => savedIndex === index ? true : saved)); }} style={{ justifySelf: "start", padding: "0.55rem 0.8rem", border: 0, borderRadius: 8, color: "#fff", background: "#111", font: "inherit", fontSize: "0.8rem", fontWeight: 700, cursor: "pointer" }}>Spara erfarenhet</button>
                </>}
              </div>
            ))}
            <button type="button" onClick={() => { setWorkExperiences((previous) => [...previous, emptyWorkExperience()]); setSavedWorkExperiences((previous) => [...previous, false]); }} style={{ justifySelf: "start", padding: "0.65rem 0.9rem", border: "1.5px solid #49636a", borderRadius: 10, color: "#49636a", background: "#ffffff", font: "inherit", fontSize: "0.85rem", fontWeight: 700, cursor: "pointer" }}>+ Lägg till arbetserfarenhet</button>
          </div>
        ) : current.field === "education" ? (
          <div style={{ display: "grid", gap: "0.9rem" }}>
            <p style={{ margin: 0, color: "#737373", fontSize: ".88rem", lineHeight: 1.5 }}>{current.description}</p>
            {educations.map((education, index) => (
              <div key={index} style={{ position: "relative", display: "grid", gap: "0.7rem", padding: "1rem", border: "1.5px solid #e8e8e8", borderRadius: 14 }}>
                {savedEducations[index] ? <>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem" }}><div><p style={{ margin: 0, color: "#111", fontSize: "1.05rem", fontWeight: 700 }}>{education.school || "Utbildning"}</p><p style={{ margin: "0.2rem 0 0", color: "#737373", fontSize: "0.82rem" }}>{[education.degree, education.subject].filter(Boolean).join(" · ") || "Examen ej angiven"}</p></div><button type="button" onClick={() => setSavedEducations((previous) => previous.map((saved, savedIndex) => savedIndex === index ? false : saved))} style={{ border: 0, background: "none", color: "#49636a", font: "inherit", fontSize: "0.78rem", fontWeight: 700, cursor: "pointer" }}>Redigera</button></div>
                  <p style={{ margin: 0, color: "#555", fontSize: "0.82rem" }}>{[education.start_date, education.end_date].filter(Boolean).join(" – ") || "Datum ej angivet"}</p>
                  {education.description && <p style={{ margin: 0, color: "#555", fontSize: "0.85rem", lineHeight: 1.45 }}>{education.description}</p>}
                </> : <>
                  <p style={{ margin: 0, color: "#737373", fontSize: "0.78rem", fontWeight: 700 }}>Utbildning {index + 1}</p>
                  {educations.length > 1 && <button type="button" onClick={() => { setEducations((previous) => previous.filter((_, itemIndex) => itemIndex !== index)); setSavedEducations((previous) => previous.filter((_, itemIndex) => itemIndex !== index)); }} aria-label={`Ta bort utbildning ${index + 1}`} style={{ position: "absolute", top: "0.65rem", right: "0.65rem", display: "grid", width: "1.8rem", height: "1.8rem", placeItems: "center", border: "1px solid #e8e8e8", borderRadius: "50%", color: "#737373", background: "#fff", fontSize: "1rem", cursor: "pointer" }}>×</button>}
                  <label style={{ display: "grid", gap: ".3rem", color: "#a3a3a3", fontSize: ".72rem", fontWeight: 600 }}>Examen *<input type="text" value={education.degree} onChange={(e) => setEducations((previous) => previous.map((item, itemIndex) => itemIndex === index ? { ...item, degree: e.target.value } : item))} placeholder="T.ex. gymnasium, universitet eller yrkesutbildning" style={{ width: "100%", boxSizing: "border-box", height: "3rem", padding: "0 1rem", borderRadius: 10, border: "1.5px solid #e8e8e8", fontSize: "1rem", outline: "none", fontFamily: "inherit", color: "#111", background: "#fff" }} /></label>
                  <label style={{ display: "grid", gap: ".3rem", color: "#a3a3a3", fontSize: ".72rem", fontWeight: 600 }}>Skola *<input type="text" value={education.school} onChange={(e) => setEducations((previous) => previous.map((item, itemIndex) => itemIndex === index ? { ...item, school: e.target.value } : item))} placeholder="Kungsholmens Gymnasium" style={{ width: "100%", boxSizing: "border-box", height: "3rem", padding: "0 1rem", borderRadius: 10, border: "1.5px solid #e8e8e8", fontSize: "1rem", outline: "none", fontFamily: "inherit", color: "#111", background: "#fff" }} /></label>
                  <label style={{ display: "grid", gap: ".3rem", color: "#a3a3a3", fontSize: ".72rem", fontWeight: 600 }}>Ämnesområde *<input type="text" value={education.subject} onChange={(e) => setEducations((previous) => previous.map((item, itemIndex) => itemIndex === index ? { ...item, subject: e.target.value } : item))} placeholder="T.ex. Ekonomi" style={{ width: "100%", boxSizing: "border-box", height: "3rem", padding: "0 1rem", borderRadius: 10, border: "1.5px solid #e8e8e8", fontSize: "1rem", outline: "none", fontFamily: "inherit", color: "#111", background: "#fff" }} /></label>
                  <div style={{ display: "grid", gap: ".3rem" }}>
                    <span style={{ color: "#737373", fontSize: ".72rem", fontWeight: 600 }}>Tid *</span>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
                      {(["start_date", "end_date"] as const).map((dateField) => {
                        const [year = "", month = ""] = education[dateField].split("-");
                        return <div key={dateField} style={{ color: "#737373", fontSize: "0.75rem" }}>
                          <span>{dateField === "start_date" ? "Startdatum" : "Slutdatum (eller förväntat)"}</span>
                          <div style={{ display: "grid", gridTemplateColumns: "1.2fr .9fr", gap: ".4rem", marginTop: ".3rem" }}>
                            <select value={month} onChange={(e) => updateEducationDate(index, dateField, "month", e.target.value)} style={{ height: "3rem", border: "1.5px solid #e8e8e8", borderRadius: 10, font: "inherit" }}>
                              <option value="">Månad</option>
                              {BIRTH_MONTHS.map((monthName, monthIndex) => {
                                const value = String(monthIndex + 1).padStart(2, "0");
                                return <option key={monthName} value={value} disabled={!canSelectDatePart(dateField, "month", value, education.start_date, education.end_date)}>{monthName}</option>;
                              })}
                            </select>
                            <select value={year} onChange={(e) => updateEducationDate(index, dateField, "year", e.target.value)} style={{ height: "3rem", border: "1.5px solid #e8e8e8", borderRadius: 10, font: "inherit" }}>
                              <option value="">År</option>
                              {WORK_YEARS.map((workYear) => <option key={workYear} value={workYear} disabled={!canSelectDatePart(dateField, "year", workYear, education.start_date, education.end_date)}>{workYear}</option>)}
                            </select>
                          </div>
                        </div>;
                      })}
                    </div>
                  </div>
                  <textarea value={education.description} onChange={(e) => setEducations((previous) => previous.map((item, itemIndex) => itemIndex === index ? { ...item, description: e.target.value } : item))} placeholder="Beskrivning *" rows={3} style={{ width: "100%", boxSizing: "border-box", padding: ".875rem 1rem", borderRadius: 10, border: "1.5px solid #e8e8e8", font: "inherit", resize: "vertical" }} />
                  <button type="button" onClick={() => { if (!educationIsComplete(education)) { setError("Fyll i alla fält för att spara utbildningen."); return; } setError(""); setSavedEducations((previous) => previous.map((saved, savedIndex) => savedIndex === index ? true : saved)); }} style={{ width: "100%", padding: ".85rem", border: 0, borderRadius: 10, color: "#fff", background: "#111", font: "inherit", fontWeight: 700, cursor: "pointer" }}>Spara utbildning</button>
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
                  {certificate.pdf_url && <p style={{ margin: 0, color: "#49636a", fontSize: "0.8rem", fontWeight: 600 }}>PDF-intyg bifogat</p>}
                </> : <>
                  <p style={{ margin: 0, color: "#737373", fontSize: "0.78rem", fontWeight: 700 }}>Certifikat {index + 1}</p>
                  {certificates.length > 1 && <button type="button" onClick={() => { setCertificates((previous) => previous.filter((_, itemIndex) => itemIndex !== index)); setSavedCertificates((previous) => previous.filter((_, itemIndex) => itemIndex !== index)); }} aria-label={`Ta bort certifikat ${index + 1}`} style={{ position: "absolute", top: "0.65rem", right: "0.65rem", display: "grid", width: "1.8rem", height: "1.8rem", placeItems: "center", border: "1px solid #e8e8e8", borderRadius: "50%", color: "#737373", background: "#fff", fontSize: "1rem", cursor: "pointer" }}>×</button>}
                  {(["name", "issuer"] as const).map((field) => <label key={field} style={{ display: "grid", gap: ".3rem", color: "#a3a3a3", fontSize: ".72rem", fontWeight: 600 }}>{field === "name" ? "Namn *" : "Utfärdande organisation *"}<input type="text" value={certificate[field]} onChange={(e) => setCertificates((previous) => previous.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: e.target.value } : item))} placeholder={field === "name" ? "T.ex. HLR-certifikat" : "T.ex. Röda Korset"} style={{ width: "100%", boxSizing: "border-box", height: "3rem", padding: "0 1rem", borderRadius: 10, border: "1.5px solid #e8e8e8", fontSize: "1rem", outline: "none", fontFamily: "inherit", color: "#111", background: "#fff" }} /></label>)}
                  <label style={{ display: "grid", gap: ".3rem", color: "#a3a3a3", fontSize: ".72rem", fontWeight: 600 }}>Typ<select value={certificate.category} onChange={(e) => setCertificates((previous) => previous.map((item, itemIndex) => itemIndex === index ? { ...item, category: e.target.value } : item))} style={{ width: "100%", height: "3rem", padding: "0 1rem", border: "1.5px solid #e8e8e8", borderRadius: 10, color: certificate.category ? "#111" : "#a3a3a3", background: "#fff", font: "inherit", fontSize: "1rem" }}><option value="">Välj</option><option value="Certifikat">Certifikat</option><option value="Stipendium">Stipendium</option><option value="Licens">Licens</option><option value="Annat">Annat</option></select></label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: ".6rem" }}>
                    {(["issue_date", "expiry_date"] as const).map((field) => {
                      const [year = "", month = ""] = certificate[field].split("-");
                      return <label key={field} style={{ display: "grid", gap: ".3rem", color: "#a3a3a3", fontSize: ".72rem", fontWeight: 600 }}>
                        {field === "issue_date" ? "Utfärdandedatum *" : "Giltig till *"}
                        <div style={{ display: "grid", gridTemplateColumns: "1.2fr .9fr", gap: ".4rem" }}>
                          <select value={month} onChange={(e) => updateCertificateDate(index, field, "month", e.target.value)} style={{ height: "3rem", border: "1.5px solid #e8e8e8", borderRadius: 10, font: "inherit" }}><option value="">Månad</option>{BIRTH_MONTHS.map((monthName, monthIndex) => <option key={monthName} value={String(monthIndex + 1).padStart(2, "0")}>{monthName}</option>)}</select>
                          <select value={year} onChange={(e) => updateCertificateDate(index, field, "year", e.target.value)} style={{ height: "3rem", border: "1.5px solid #e8e8e8", borderRadius: 10, font: "inherit" }}><option value="">År</option>{WORK_YEARS.map((workYear) => <option key={workYear} value={workYear}>{workYear}</option>)}</select>
                        </div>
                      </label>;
                    })}
                  </div>
                  <div style={{ display: "grid", gap: ".55rem" }}><p style={{ margin: 0, color: "#a3a3a3", fontSize: ".72rem", fontWeight: 700 }}>Bifoga ett intyg</p><label style={{ display: "grid", gap: ".3rem", color: "#a3a3a3", fontSize: ".72rem", fontWeight: 600 }}><input type="url" value={certificate.credential_url} onChange={(e) => setCertificates((previous) => previous.map((item, itemIndex) => itemIndex === index ? { ...item, credential_url: e.target.value } : item))} placeholder="Klistra in en länk till intyget, t.ex. https://..." style={{ width: "100%", height: "3rem", color: "#a3a3a3", boxSizing: "border-box", padding: "0 1rem", border: "1.5px solid #e8e8e8", borderRadius: 10, font: "inherit" }} /></label><label style={{ display: "flex", alignItems: "center", gap: ".5rem", padding: ".8rem", border: "1.5px solid #e8e8e8", borderRadius: 10, color: "#a3a3a3", fontSize: ".85rem", fontWeight: 400, cursor: docUploading ? "wait" : "pointer" }}><input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,text/plain" onChange={(e) => void handleCertificatePdfSelect(index, e)} disabled={docUploading} style={{ display: "none" }} />Bifoga fil som intyg</label></div>
                  <label style={{ display: "grid", gap: ".3rem", color: "#a3a3a3", fontSize: ".72rem", fontWeight: 600 }}>Beskrivning<textarea value={certificate.description} onChange={(e) => setCertificates((previous) => previous.map((item, itemIndex) => itemIndex === index ? { ...item, description: e.target.value } : item))} placeholder="T.ex. Vad certifikatet eller stipendiet gällde" rows={2} style={{ width: "100%", boxSizing: "border-box", padding: ".7rem 1rem", border: "1.5px solid #e8e8e8", borderRadius: 10, font: "inherit", resize: "vertical" }} /></label>
                  {false && (
                  <label style={{ display: "flex", alignItems: "center", gap: ".5rem", padding: ".8rem", border: "1.5px dashed #d1d1d1", borderRadius: 10, color: "#49636a", fontSize: ".85rem", fontWeight: 600, cursor: docUploading ? "wait" : "pointer" }}><input type="file" accept="application/pdf" onChange={(e) => void handleCertificatePdfSelect(index, e)} disabled={docUploading} style={{ display: "none" }} />📎 {certificate.pdf_url ? "PDF-intyg bifogat – byt fil" : "Bifoga PDF-intyg (valfritt)"}</label>
                  )}
                  <button type="button" onClick={() => { if (!certificateIsComplete(certificate)) { setError("Fyll i alla fält för att spara certifikatet."); return; } setError(""); setSavedCertificates((previous) => previous.map((saved, savedIndex) => savedIndex === index ? true : saved)); }} style={{ justifySelf: "start", padding: ".55rem .8rem", border: 0, borderRadius: 8, color: "#fff", background: "#111", font: "inherit", fontSize: ".8rem", fontWeight: 700, cursor: "pointer" }}>Spara certifikat</button>
                </>}
              </div>
            ))}
            <button type="button" onClick={() => { setCertificates((previous) => [...previous, emptyCertificate()]); setSavedCertificates((previous) => [...previous, false]); }} style={{ justifySelf: "start", padding: ".65rem .9rem", border: "1.5px solid #49636a", borderRadius: 10, color: "#49636a", background: "#fff", font: "inherit", fontSize: ".85rem", fontWeight: 700, cursor: "pointer" }}>+ Lägg till certifikat eller stipendium</button>
          </div>
        ) : selectionField ? (
          <div style={{ display: "grid", gap: ".8rem" }}>
            <div style={{ display: "flex", width: selectionField === "strengths" ? "min(100%, 24rem)" : "100%", gap: ".5rem", order: selectionField === "strengths" ? 3 : undefined }}>
              <input
                type="text"
                value={selectionField === "strengths" ? strengthInput : languageInput}
                onChange={(e) => selectionField === "strengths" ? setStrengthInput(e.target.value) : setLanguageInput(e.target.value)}
                placeholder={current.placeholder}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); saveCustomValue(selectionField); } }}
                autoFocus
                style={{ width: "100%", boxSizing: "border-box", height: "3rem", padding: "0 1rem", borderRadius: 10, border: "1.5px solid #e8e8e8", fontSize: "1rem", outline: "none", fontFamily: "inherit", color: "#111", background: "#fff" }}
              />
              <button type="button" onClick={() => saveCustomValue(selectionField)} aria-label="Lägg till" style={{ minWidth: "3rem", padding: "0 0.9rem", border: 0, borderRadius: 10, color: "#fff", background: "#111", font: "inherit", fontSize: "1.35rem", fontWeight: 500, cursor: "pointer" }}>+</button>
            </div>
            <p style={{ margin: 0, color: "#737373", fontSize: ".78rem", order: selectionField === "strengths" ? 2 : undefined }}>Skriv en egen och tryck på +, eller välj bland förslagen.</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: ".5rem", order: selectionField === "strengths" ? 1 : undefined }}>
              {[...new Set([...(selectionField === "strengths" ? STRENGTH_TIPS : LANGUAGE_TIPS.map((item) => item.label)), ...(selectionField === "strengths" ? selectedStrengths : selectedLanguages)])].map((value) => {
                const selected = (selectionField === "strengths" ? selectedStrengths : selectedLanguages).includes(value);
                const flag = selectionField === "languages" ? getLanguageFlag(value) : undefined;
                return <button key={value} type="button" onClick={() => toggleSelectedValue(selectionField, value)} style={{ display: "inline-flex", alignItems: "center", gap: ".35rem", padding: ".5rem .8rem", borderRadius: 999, border: selected ? "none" : "1.5px solid #e8e8e8", background: selected ? "#111" : "#fff", color: selected ? "#fff" : "#111", font: "inherit", fontSize: ".8rem", fontWeight: 600, cursor: "pointer" }}>{flag && <span aria-hidden="true">{flag}</span>}{value}</button>;
              })}
            </div>
          </div>
        ) : current.field === "extracurriculars" ? (
          <div style={{ display: "grid", gap: ".8rem" }}>
            <p style={{ margin: 0, color: "#737373", fontSize: ".88rem", lineHeight: 1.5 }}>{current.description}</p>
            {otherEntries.map((entry, index) => <div key={`${entry.title}-${index}`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: ".7rem", padding: ".85rem", border: "1.5px solid #e8e8e8", borderRadius: 12 }}><div><strong style={{ color: "#111", fontSize: ".9rem" }}>{entry.title}</strong><p style={{ margin: ".2rem 0 0", color: "#737373", fontSize: ".78rem" }}>{entry.type === "write" ? entry.value : entry.type === "link" ? "Länk bifogad" : "PDF bifogad"}</p></div><button type="button" onClick={() => setOtherEntries((previous) => previous.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Ta bort ${entry.title}`} style={{ border: 0, background: "none", color: "#737373", fontSize: "1.2rem", cursor: "pointer" }}>×</button></div>)}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: ".5rem" }}>
              {([ ["write", "Skriva"], ["link", "Bifoga länk"], ["pdf", "Bifoga PDF"] ] as const).map(([type, label]) => <button key={type} type="button" onClick={() => { setError(""); setOtherType(type); }} style={{ minHeight: "3.1rem", padding: ".55rem", borderRadius: 10, border: otherType === type ? "none" : "1.5px solid #e8e8e8", background: otherType === type ? "#111" : "#fff", color: otherType === type ? "#fff" : "#111", font: "inherit", fontSize: ".78rem", fontWeight: 700, cursor: "pointer" }}>{label}</button>)}
            </div>
            {otherType && <input type="text" value={otherTitle} onChange={(e) => setOtherTitle(e.target.value)} placeholder="Titel" style={{ width: "100%", boxSizing: "border-box", height: "3rem", padding: "0 1rem", borderRadius: 10, border: "1.5px solid #e8e8e8", font: "inherit" }} />}
            {otherType === "write" && <textarea value={answers.extracurriculars} onChange={(e) => handleTextChange(e.target.value)} placeholder="Skriv ditt tillägg här" rows={4} style={{ width: "100%", boxSizing: "border-box", padding: ".875rem 1rem", borderRadius: 12, border: "1.5px solid #e8e8e8", font: "inherit", resize: "vertical" }} />}
            {otherType === "link" && <input type="url" value={otherLink} onChange={(e) => setOtherLink(e.target.value)} placeholder="https://linkedin.com/in/..." style={{ width: "100%", boxSizing: "border-box", height: "3rem", padding: "0 1rem", borderRadius: 10, border: "1.5px solid #e8e8e8", font: "inherit" }} />}
            {otherType === "pdf" && <label style={{ display: "grid", placeItems: "center", gap: ".4rem", minHeight: "8rem", padding: "1rem", border: "1.5px dashed #d1d1d1", borderRadius: 12, color: "#49636a", fontSize: ".85rem", fontWeight: 700, cursor: docUploading ? "wait" : "pointer" }}><input type="file" accept="application/pdf" onChange={(e) => void handleOtherPdfSelect(e)} disabled={docUploading} style={{ display: "none" }} />📎 {docUploading ? "Laddar upp..." : otherPdf ? `PDF bifogad: ${otherPdf.name}` : "Tryck för att bifoga en PDF"}</label>}
            <button type="button" onClick={saveOtherEntry} style={{ justifySelf: "start", padding: ".65rem .9rem", border: 0, borderRadius: 10, color: "#fff", background: "#111", font: "inherit", fontSize: ".85rem", fontWeight: 700, cursor: "pointer" }}>Spara tillägg</button>
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

        {current.optional && !isLast && (
          <button
            type="button"
            onClick={() => {
              setError("");
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
