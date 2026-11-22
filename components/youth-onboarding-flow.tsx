"use client";
import styles from "./youth-cv-entry.module.css";
import formStyles from "./youth-cv-forms.module.css";
import onboardingStyles from "./youth-onboarding-flow.module.css";
import { PageLoading } from "@/components/page-loading";

import { VOICE_CV_ENABLED } from "@/lib/feature-flags";

import { voiceCvStorageKey } from "@/lib/voice-cv-storage";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ModalDialog } from "@/components/modal-dialog";
import { UiIcon } from "@/components/ui-icon";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { AuthGateMessage } from "@/components/auth-gate-message";
import { MISSING_FULL_NAME_MESSAGE, completeYouthOnboarding, getYouthProfile, normalizeFullName, saveUploadedCvToProfile, saveYouthAccountDetails } from "@/lib/onboarding";
import { createCvPdfFile } from "@/lib/cv-pdf";
import { getYouthDocumentSignedUrl, uploadYouthDocument } from "@/lib/storage";
import { authenticatedHeaders } from "@/lib/api-client";
import { ADDRESS_SUGGESTIONS, CITY_SUGGESTIONS, COMPANY_NAME_SUGGESTIONS, JOB_TITLE_SUGGESTIONS } from "@/lib/form-suggestions";
import type { YouthDocument, YouthDocumentType } from "@/lib/types";
import { renderStructuredCv, structuredCvFromForm, structuredCvToLegacy, type StructuredCvData } from "@/lib/structured-cv";
import { CvFactReview } from "./cv-fact-review";
import { cvReviewSnapshot, cvSourceText, hasApprovedCv } from "@/lib/cv-fact-review";

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
const SKILL_TIPS = [
  { label: "Excel", mark: "X", id: "excel" },
  { label: "Word", mark: "W", id: "word" },
  { label: "PowerPoint", mark: "P", id: "powerpoint" },
  { label: "React", mark: "⚛", id: "react" },
  { label: "Canva", mark: "C", id: "canva" },
  { label: "Figma", mark: "F", id: "figma" },
  { label: "Photoshop", mark: "Ps", id: "photoshop" },
  { label: "Teams", mark: "T", id: "teams" },
  { label: "Slack", mark: "S", id: "slack" },
  { label: "Instagram", mark: "◎", id: "instagram" },
  { label: "TikTok", mark: "♪", id: "tiktok" },
  { label: "Google Drive", mark: "D", id: "google-drive" },
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
const FUTURE_YEAR_COUNT = 10;
const PAST_YEAR_COUNT = 90;

// Built from the current date instead of a hard-coded year so pupils graduating
// after this year can pick a correct end date, and so the list rolls over on its
// own when the calendar year changes.
function buildSelectableYears(reference: Date = new Date()): string[] {
  const latestYear = reference.getFullYear() + FUTURE_YEAR_COUNT;
  return Array.from({ length: FUTURE_YEAR_COUNT + PAST_YEAR_COUNT + 1 }, (_, index) => String(latestYear - index));
}
const MISSING_NAME_PARTS_MESSAGE = "Fyll i både förnamn och efternamn för att fortsätta.";
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

const DOC_TYPE_LABELS: Record<YouthDocumentType, string> = {
  grades: "Betyg",
  recommendation: "Rekommendationsbrev",
  certificate: "Intyg",
  cv: "Eget CV",
  generated_cv: "MatchnWork-CV",
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

export function YouthOnboardingFlow({ flow, cvBuilder = false, voiceFinalize = false }: { flow: "account" | "cv"; cvBuilder?: boolean; voiceFinalize?: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnJobId = searchParams.get("job");
  const returnJobTitle = searchParams.get("title");
  const returnPath = returnJobId && /^[0-9a-f-]{36}$/i.test(returnJobId) ? `/jobb/${returnJobId}` : "/swipe";
  const cvQuery = returnJobId && /^[0-9a-f-]{36}$/i.test(returnJobId) ? `?job=${encodeURIComponent(returnJobId)}${returnJobTitle ? `&title=${encodeURIComponent(returnJobTitle)}` : ""}` : "";
  const { user, profile, loading, status: authStatus, error: sessionError } = useRequireAuth();
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
  const [nameError, setNameError] = useState("");
  const workYears = useMemo(() => buildSelectableYears(), []);
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
  const [profileImagePreview, setProfileImagePreview] = useState("");
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
  const [approvedCvSnapshot, setApprovedCvSnapshot] = useState<string | null>(null);
  const [cvReviewSource, setCvReviewSource] = useState("");
  const reviewCv = structuredCv ?? structuredCvFromForm({ ...answers, work_experiences: workExperiences, educations, certificate_entries: certificates, other_entries: otherEntries });
  const cvFactsApproved = hasApprovedCv(approvedCvSnapshot, cvText, reviewCv);
  const [documents, setDocuments] = useState<YouthDocument[]>([]);
  const [docType, setDocType] = useState<YouthDocumentType>("grades");
  const [docUploading, setDocUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
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
            profile_image: savedProfile.profile_image_url ?? "",
          }));
          if (savedProfile.profile_image_url) {
            void getYouthDocumentSignedUrl(savedProfile.profile_image_url).then(setProfileImagePreview).catch(() => setProfileImagePreview(""));
          }
          setAdditionalAddresses(Array.isArray(savedProfile.additional_addresses) ? savedProfile.additional_addresses : []);
          setDocuments(Array.isArray(savedProfile.documents) ? savedProfile.documents : []);
          setAccountDetailsSaved(hasAccountDetails(savedProfile));
        }
        if (voiceFinalize) {
          try {
            const savedVoiceAnswers = JSON.parse(sessionStorage.getItem(voiceCvStorageKey("employo-voice-cv-answers", user?.id)) ?? "{}") as Partial<Pick<Answers, "strengths" | "languages" | "work_experience" | "education" | "certificates">>;
            setAnswers((previous) => ({ ...previous, ...savedVoiceAnswers }));
            const savedStructuredCv = JSON.parse(sessionStorage.getItem(voiceCvStorageKey("employo-voice-cv-structured", user?.id)) ?? "null") as StructuredCvData | null;
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
              structuredCv?: StructuredCvData;
              cvReviewSource?: string;
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
              setStructuredCv(draft.structuredCv ?? null);
              setCvReviewSource(draft.cvReviewSource ?? "");
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
      structuredCv,
      cvReviewSource,
    }));
  }, [accountDetailsLoaded, answers, certificates, cvBuilder, cvDraftStorageKey, cvText, structuredCv, cvReviewSource, educations, flow, otherEntries, savedCertificates, savedEducations, savedWorkExperiences, selectedLanguages, selectedStrengths, showCvStep, step, voiceFinalize, workExperiences]);

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
      <main className={`mobile-shell mnw-onboarding-success ${styles.success}`} >
        <span className="mnw-onboarding-success-mark"><UiIcon name="check" width="32" height="32" /></span>
        <p className={styles.eyebrow}>Välkommen till MatchnWork</p>
        <h1 className={styles.successTitle}>Kontot är skapat!</h1>
        <p className={styles.successText}>Vill du fortsätta skapa ditt CV nu eller gå in på ditt konto?</p>
        <button type="button" className={`cta-btn ${styles.primary}`} onClick={() => router.push("/youth/cv")} >Fortsätt skapa mitt CV</button>
        <button type="button" className={`secondary-btn ${styles.secondary}`} onClick={() => router.push("/swipe")} >Upptäck jobb</button>
      </main>
    );
  }

  // Do not briefly show the first flow to a returning user while their account
  // details are being loaded.
  if (!loading && user && profile?.role === "youth" && (!accountDetailsLoaded || redirectingBetweenFlows)) {
    return <PageLoading label="Laddar…" />;
  }

  /* ── CV preview / edit step ─────────────────────── */
  if (flow === "cv" && showCvMethodChoice) {
    return (
      <main className={`youth-onboarding mnw-onboarding-methods ${styles.methods}`} >
        <div className={styles.content}>
          <p className={styles.kicker}>Ditt CV</p>
          <h1 className={styles.title}>Hur vill du skapa ditt CV?</h1>
          <p className={styles.intro}>Välj det som passar dig. Du kan alltid uppdatera ditt CV senare.</p>

          <div className={styles.choices}>
            {returnJobId && <div className={styles.job}>Ansökan gäller: <strong>{returnJobTitle || "valt jobb"}</strong><Link href={returnPath} className={styles.back}>Tillbaka till jobbet</Link></div>}
            <button type="button" className={`cv-method-card ${styles.card}`} onClick={() => router.push(`/youth/cv/create${cvQuery}`)} >
              <span className="mnw-cv-method-icon"><UiIcon name="file" /></span><strong className={styles.cardTitle}>Skapa CV i MatchnWork</strong>
              <span className={styles.cardText}>Svara på några frågor så bygger vi CV:t tillsammans.</span>
            </button>
            {VOICE_CV_ENABLED && <Link href={`/voice-cv${cvQuery}`} className={`cv-method-card ${styles.voice}`} >
              <span className={styles.beta}>Beta</span>
              <span className="mnw-cv-method-icon"><UiIcon name="microphone" /></span><strong className={styles.voiceTitle}>Skapa CV med röstsamtal</strong>
              <span className={styles.voiceText}>Prata med AI:n och svara på frågorna med din röst.</span>
            </Link>}
            <label className={`cv-method-card ${styles.upload}`} data-uploading={docUploading} >
              <input type="file" accept="application/pdf,.pdf" onChange={(event) => void handleUploadedCvFinish(event)} disabled={docUploading} className="mnw-cv-file-input" />
              <span className="mnw-cv-method-icon"><UiIcon name="upload" /></span><strong className={styles.uploadTitle}>{docUploading ? "Laddar upp PDF..." : "Bifoga eget CV som PDF"}</strong>
              <span className={styles.uploadText}>Använd ditt befintliga CV som underlag för dina ansökningar.</span>
            </label>
          </div>
          {error && <p role="alert" className={styles.error}>{error}</p>}
        </div>
      </main>
    );
  }

  if (showCvStep) {
    return (
      <main
        className={`youth-onboarding ${formStyles.review}`}
      >
        {cameraOpen && (
          <ModalDialog label="Ta en profilbild" onClose={closeCamera} className={formStyles.photoDialog}>
            <div className={formStyles.photoPanel}>
              <h2 className={formStyles.photoTitle}>Ta en profilbild</h2>
              <video ref={cameraVideoRef} autoPlay playsInline muted className={formStyles.cameraPreview} />
              <div className={formStyles.photoActions}>
                <button type="button" onClick={closeCamera} className={formStyles.photoCancel}>Avbryt</button>
                <button type="button" onClick={takeCameraPhoto} className={formStyles.photoConfirm}>Ta bild</button>
              </div>
            </div>
          </ModalDialog>
        )}
        {cropSource && <ModalDialog label="Beskär din profilbild" busy={docUploading} onClose={() => { URL.revokeObjectURL(cropSource); setCropSource(""); }} className={formStyles.photoDialog}><div className={formStyles.photoPanel}><h2 className={formStyles.photoTitle}>Beskär din profilbild</h2><div className={formStyles.cropSquare}><img src={cropSource} alt="Förhandsgranskning" className={formStyles.cropPreview} style={{ transform: `scale(${cropZoom}) translate(${cropOffset.x * 20}%, ${cropOffset.y * 20}%)` }} /><div className={formStyles.cropMask} /></div><label className={formStyles.cropControl}>Zoom<input type="range" min="1" max="3" step=".01" value={cropZoom} onChange={(e) => setCropZoom(Number(e.target.value))} /></label><div className={formStyles.photoActions}><button type="button" onClick={() => { URL.revokeObjectURL(cropSource); setCropSource(""); }} className={formStyles.photoCancel}>Avbryt</button><button type="button" onClick={() => void saveCroppedProfileImage()} disabled={docUploading} className={formStyles.photoConfirm}>Använd bild</button></div></div></ModalDialog>}
        <div className={formStyles.reviewHeader}>
          <p className={formStyles.reviewKicker}>
            Ditt CV är klart!
          </p>
          <h1 className={formStyles.reviewTitle}>
            Granska ditt CV
          </h1>
          <p className={formStyles.reviewHint}>
            Redigera texten nedan om du vill ändra något.
          </p>
        </div>

        <textarea
          aria-label="CV-text att granska och redigera"
          value={cvText}
          disabled={saving}
          onChange={(e) => { setApprovedCvSnapshot(null); setCvText(e.target.value); }}
          rows={18}
          className={formStyles.reviewText}
        />

        <CvFactReview text={cvText} onSync={(cv) => { setApprovedCvSnapshot(null); setCvReviewSource(cvText); setStructuredCv(cv); }} cv={reviewCv} sourceText={cvReviewSource || cvSourceText(structuredCvFromForm({ ...answers, work_experiences: workExperiences, educations, certificate_entries: certificates, other_entries: otherEntries }))}
          approved={cvFactsApproved} disabled={saving}
          onApprove={(approved) => setApprovedCvSnapshot(approved ? cvReviewSnapshot(cvText, reviewCv) : null)}
          onChange={(cv) => { setApprovedCvSnapshot(null); setStructuredCv(cv); setCvText(renderStructuredCv(cv)); }} />

        {error && (
          <p role="alert" className={formStyles.reviewError}>{error}</p>
        )}

        <div className={formStyles.reviewActions}>
          <button
            type="button"
            onClick={() => void handleSaveCv()}
            disabled={saving || !cvFactsApproved}
            aria-busy={saving}
            className={formStyles.reviewSave}
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
        className={["youth-onboarding", onboardingStyles.documentPage].join(" ")}

      >
        {cameraOpen && (
          <ModalDialog label="Ta en profilbild" onClose={closeCamera} className={formStyles.photoDialog}>
            <div className={formStyles.photoPanel}>
              <h2 className={formStyles.photoTitle}>Ta en profilbild</h2>
              <video ref={cameraVideoRef} autoPlay playsInline muted className={formStyles.cameraPreview} />
              <div className={formStyles.photoActions}>
                <button type="button" onClick={closeCamera} className={formStyles.photoCancel}>Avbryt</button>
                <button type="button" onClick={takeCameraPhoto} className={formStyles.photoConfirm}>Ta bild</button>
              </div>
            </div>
          </ModalDialog>
        )}
        {cropSource && <ModalDialog label="Beskär din profilbild" busy={docUploading} onClose={() => { URL.revokeObjectURL(cropSource); setCropSource(""); }} className={formStyles.photoDialog}><div className={formStyles.photoPanel}><h2 className={formStyles.photoTitle}>Beskär din profilbild</h2><div className={formStyles.cropSquare}><img src={cropSource} alt="Förhandsgranskning" className={formStyles.cropPreview} style={{ transform: `scale(${cropZoom}) translate(${cropOffset.x * 20}%, ${cropOffset.y * 20}%)` }} /><div className={formStyles.cropMask} /></div><label className={formStyles.cropControl}>Zoom<input type="range" min="1" max="3" step=".01" value={cropZoom} onChange={(e) => setCropZoom(Number(e.target.value))} /></label><label className={formStyles.cropControl}>Flytta vågrätt<input type="range" min="-1" max="1" step=".01" value={cropOffset.x} onChange={(e) => setCropOffset((previous) => ({ ...previous, x: Number(e.target.value) }))} /></label><label className={formStyles.cropControl}>Flytta lodrätt<input type="range" min="-1" max="1" step=".01" value={cropOffset.y} onChange={(e) => setCropOffset((previous) => ({ ...previous, y: Number(e.target.value) }))} /></label><div className={formStyles.photoActions}><button type="button" onClick={() => { URL.revokeObjectURL(cropSource); setCropSource(""); }} className={formStyles.photoCancel}>Avbryt</button><button type="button" onClick={() => void saveCroppedProfileImage()} disabled={docUploading} className={formStyles.photoConfirm}>Använd bild</button></div></div></ModalDialog>}
        <div className={onboardingStyles.documentHeader}>
          <div
            className={onboardingStyles.photoIntro}
          >
            <p className={onboardingStyles.photoIntroText}>
              Visa vem du är! En profilbild ger arbetsgivare ett bättre första intryck (valfritt)
            </p>
          </div>
          <p className={onboardingStyles.photoIntroHint}>
            Välj en bild eller ta en ny med kameran. Du kan sedan beskära den till din profilbild.
          </p>
        </div>

        <div className={onboardingStyles.documentPhotoGroup}>
          <div className={onboardingStyles.photoSquare}>
            {profileImagePreview ? <img src={profileImagePreview} alt="Profilbild" className={onboardingStyles.photoImage} /> : <><span className={onboardingStyles.photoPlaceholderIcon}>👤</span><span className={onboardingStyles.photoPlaceholderText}>Välj eller ta en profilbild</span></>}
          </div>
          <div className={onboardingStyles.photoButtons}>
            <label className={[onboardingStyles.photoUpload, (docUploading) ? onboardingStyles.photoUploadActive : ""].join(" ")}><input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleProfileImageSelect} disabled={docUploading} className={onboardingStyles.fileInput} />Bifoga bild</label>
            <button type="button" onClick={() => void openCamera()} disabled={docUploading} className={[onboardingStyles.photoCapture, (docUploading) ? onboardingStyles.photoCaptureActive : ""].join(" ")}>Ta bild</button>
          </div>
        </div>
        <div className={onboardingStyles.visuallyHidden} aria-hidden="true">
        {/* Type selector + file picker */}
        <div className={onboardingStyles.documentPicker}>
          <select
            value={docType}
            onChange={(e) => setDocType(e.target.value as YouthDocumentType)}
            className={onboardingStyles.documentType}
          >
            <option value="grades">Betyg</option>
            <option value="recommendation">Rekommendationsbrev</option>
            <option value="certificate">Intyg</option>
            <option value="other">Övrigt</option>
          </select>
          <label
            className={[onboardingStyles.documentUpload, (docUploading) ? onboardingStyles.documentUploadActive : ""].join(" ")}
          >
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              className={onboardingStyles.fileInput}
              disabled={docUploading}
              onChange={(e) => void handleFileSelect(e)}
            />
            <span className={onboardingStyles.documentIcon}>📎</span>
            <p className={onboardingStyles.documentUploadText}>
              {docUploading ? "Laddar upp..." : "Tryck för att välja fil"}
            </p>
            <p className={onboardingStyles.documentUploadHint}>PDF, JPG eller PNG · max 5 MB</p>
          </label>
        </div>

        {/* Uploaded docs list */}
        {documents.length > 0 && (
          <div className={onboardingStyles.documentList}>
            {documents.map((doc, i) => (
              <div
                key={i}
                className={onboardingStyles.documentRow}
              >
                <span className={onboardingStyles.documentRowIcon}>📎</span>
                <div className={onboardingStyles.documentRowText}>
                  <p className={onboardingStyles.documentName}>
                    {doc.name}
                  </p>
                  <p className={onboardingStyles.documentKind}>{DOC_TYPE_LABELS[doc.type]}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setDocuments((d) => d.filter((_, j) => j !== i))}
                  className={onboardingStyles.documentRemove}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        </div>
        {error && (
          <p className={onboardingStyles.documentError}>{error}</p>
        )}
        {cameraError && <p className={onboardingStyles.documentError}>{cameraError}</p>}

        <div className={onboardingStyles.documentActions}>
          <button
            type="button"
            onClick={() => void handleSaveWithDocs()}
            disabled={saving || docUploading}
            className={[onboardingStyles.documentContinue, (saving || docUploading) ? onboardingStyles.documentContinueActive : ""].join(" ")}
          >
            {saving ? "Sparar..." : "Spara och börja swipa"}
          </button>
          <button
            type="button"
            onClick={() => router.replace("/swipe")}
            className={onboardingStyles.documentSkip}
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
    field: "start_date" | "end_date" | "issue_date" | "expiry_date",
    part: "month" | "year",
    value: string,
    startDate: string,
    endDate: string,
  ) => {
    // issue_date/expiry_date are the certificate equivalents of start/end.
    const isRangeStart = field === "start_date" || field === "issue_date";
    const currentDate = isRangeStart ? startDate : endDate;
    const [currentYear = "", currentMonth = ""] = currentDate.split("-");
    const nextDate = `${part === "year" ? value : currentYear}-${part === "month" ? value : currentMonth}`;
    return isRangeStart
      ? hasValidDateRange(nextDate, endDate)
      : hasValidDateRange(startDate, nextDate);
  };
  const workExperienceIsComplete = (experience: WorkExperience) =>
    Boolean(experience.title.trim() && experience.company.trim() && experience.location.trim() && experience.location_type && experience.employment_type && isCompleteMonth(experience.start_date) && (experience.is_current || isCompleteMonth(experience.end_date)) && (experience.is_current || hasValidDateRange(experience.start_date, experience.end_date)) && experience.description.trim());
  const educationIsComplete = (education: EducationEntry) =>
    Boolean(education.school.trim() && education.degree.trim() && education.subject.trim() && isCompleteMonth(education.start_date) && isCompleteMonth(education.end_date) && hasValidDateRange(education.start_date, education.end_date) && education.description.trim());
  const certificateIsComplete = (certificate: CertificateEntry) =>
    Boolean(certificate.name.trim() && certificate.issuer.trim() && certificate.category && isCompleteMonth(certificate.issue_date) && isCompleteMonth(certificate.expiry_date) && hasValidDateRange(certificate.issue_date, certificate.expiry_date) && certificate.credential_url.trim() && certificate.description.trim());

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
      const nextDate = year || month ? `${year}-${month}` : "";
      const next = { ...item, [field]: nextDate };
      // Mirrors the education and work-experience pickers: a certificate cannot
      // stop being valid before it was issued.
      if (!hasValidDateRange(next.issue_date, next.expiry_date)) {
        setError("Giltig till kan inte vara före utfärdandedatum.");
        return item;
      }
      setError("");
      return next;
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

  function toggleSkill(skill: string) {
    setAnswers((previous) => {
      const skills = previous.skills_text.split(",").map((item) => item.trim()).filter(Boolean);
      const nextSkills = skills.includes(skill) ? skills.filter((item) => item !== skill) : [...skills, skill];
      return { ...previous, skills_text: nextSkills.join(", ") };
    });
  }

  async function handleNext() {
    if (current.field === "full_name") {
      // Both parts are checked separately. Validating only the joined string let
      // a blank surname through, because "Anna" + "" still trims to a non-empty
      // name, and a surname of only spaces collapsed to the same thing.
      const normalizedFirstName = normalizeFullName(firstName);
      const normalizedLastName = normalizeFullName(lastName);
      if (!normalizedFirstName || !normalizedLastName) {
        setNameError(MISSING_NAME_PARTS_MESSAGE);
        return;
      }
      setNameError("");
      setAnswers((previous) => ({ ...previous, full_name: `${normalizedFirstName} ${normalizedLastName}` }));
    }
    if (step === 2) {
      const hasIncompleteAdditionalAddress = additionalAddresses.some((item) => !item.city.trim() || !item.address.trim() || !item.postal_code.trim());
      const normalizedName = normalizeFullName(answers.full_name);
      if (!normalizedName) {
        setNameError(MISSING_FULL_NAME_MESSAGE);
        setStep(STEPS.findIndex((candidate) => candidate.field === "full_name"));
        setError(MISSING_FULL_NAME_MESSAGE);
        return;
      }
      if (!answers.date_of_birth || !answers.city.trim() || !answers.address.trim() || !answers.postal_code.trim() || hasIncompleteAdditionalAddress) {
        setError("Fyll i födelsedatum, stad, adress och postnummer för att fortsätta.");
        return;
      }
      setSaving(true);
      setError("");
      try {
        const savedAccount = await saveYouthAccountDetails({
          full_name: normalizedName,
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
    if (answeredAreaCount < 3 && !voiceFinalize) {
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
    let voiceConversation: unknown[] = [];
    if (voiceFinalize) {
      try { voiceConversation = JSON.parse(sessionStorage.getItem(voiceCvStorageKey("employo-voice-cv-conversation", user?.id)) ?? "[]"); } catch { /* The structured source still retains the original notes. */ }
    }
    const cvPayload = {
      ...answersForCv,
      ...(voiceFinalize && structuredCv ? { structured: structuredCv, conversation: voiceConversation } : {}),
      work_experiences: workExperiences.map(({ title, company, location, location_type, employment_type, start_date, end_date, is_current, description }) => ({ title, company, location, location_type, employment_type, start_date, end_date, is_current, description })),
      educations: educations.map(({ school, degree, subject, start_date, end_date, description }) => ({ school, degree, subject, start_date, end_date, description })),
      certificate_entries: certificates.map(({ name, issuer, category, issue_date, expiry_date, credential_url, description }) => ({ name, issuer, category, issue_date, expiry_date, credential_url, description })),
      other_entries: otherEntries.map(({ title, type, value }) => ({ title, type, value })),
    };
    setApprovedCvSnapshot(null);
    setCvReviewSource(cvSourceText(voiceFinalize && structuredCv ? structuredCv : structuredCvFromForm(cvPayload), voiceConversation));
    try {
      const res = await fetch("/api/youth/cv/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await authenticatedHeaders()) },
        body: JSON.stringify(cvPayload),
      });
      const data = (await res.json()) as { cv: string; structured?: StructuredCvData; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Kunde inte bearbeta CV:t. Försök igen.");
      if (!data.cv?.trim() || !data.structured) throw new Error("CV:t kunde inte färdigställas. Dina svar finns kvar, försök igen.");
      if (res.ok) {
        generated = data.cv;
        if (data.structured) setStructuredCv(data.structured);
      }
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : "Kunde inte bearbeta CV:t. Försök igen.");
      setSaving(false);
      return;
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
      router.replace(returnPath);
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
      const path = await uploadYouthDocument(new File([blob], "profilbild.png", { type: "image/png" }));
      setAnswers((previous) => ({ ...previous, profile_image: path }));
      setProfileImagePreview(await getYouthDocumentSignedUrl(path));
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
    if (!cvFactsApproved) { setError("Granska och godkänn CV-texten och profilfakta innan du sparar."); setShowCvStep(true); return; }
    setSaving(true);
    setError("");
    try {
      // Every MatchnWork-created CV is saved as both editable text and a PDF.
      // This makes the PDF available from the profile without requiring a
      // separate download action during onboarding.
      const pdfFile = await createCvPdfFile(cvText, answers.full_name);
      const pdfUrl = await uploadYouthDocument(pdfFile);
      const generatedCvDocument: YouthDocument = { name: pdfFile.name, url: pdfUrl, type: "generated_cv" };
      const otherDocuments = otherEntries.flatMap((entry) => entry.file ? [entry.file] : []);
      const writtenFields = structuredCv ? structuredCvToLegacy(structuredCv) : null;

      await completeYouthOnboarding({
        ...answers,
        extracurriculars: formatOtherEntries(),
        work_experience: formatWorkExperiences() || answers.work_experience,
        education: formatEducations() || answers.education,
        certificates: formatCertificates() || answers.certificates,
        ...(writtenFields ? { strengths: writtenFields.strengths.join(", "), languages: writtenFields.languages.join(", "), work_experience: writtenFields.workExperience.join("\n"), education: writtenFields.education.join("\n"), certificates: writtenFields.certificates.join("\n"), extracurriculars: writtenFields.extracurriculars.join("\n") } : {}),
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
      if (voiceFinalize) {
        for (const key of ["employo-voice-cv-answers", "employo-voice-cv-structured", "employo-voice-cv-conversation", "employo-voice-cv-draft"]) sessionStorage.removeItem(voiceCvStorageKey(key, user?.id));
      }
      router.replace(returnPath);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Kunde inte spara profilen.");
      setSaving(false);
    }
  }

  if (authStatus !== "ready") return <AuthGateMessage status={authStatus} error={sessionError} />;

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
      className={["youth-onboarding youth-onboarding-pink", onboardingStyles.onboardingPage].join(" ")}

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
      {cropSource && (
        <ModalDialog label="Beskär din profilbild" busy={docUploading} onClose={() => { URL.revokeObjectURL(cropSource); setCropSource(""); }} className={formStyles.photoDialog}>
          <div className={formStyles.photoPanel}>
            <div>
              <h2 className={formStyles.photoTitle}>Beskär din profilbild</h2>
              <p className={formStyles.photoDescription}>Cirkeln visar den bild som kommer att användas i din profil.</p>
            </div>
            <div onPointerDown={startCropDrag} onPointerMove={moveCropDrag} onPointerUp={endCropDrag} onPointerCancel={endCropDrag} className={formStyles.cropDrag} style={{ width: cropSize, height: cropSize }}>
              <img src={cropSource} alt="Förhandsgranskning för beskärning" className={formStyles.cropDragImage} style={{ width: cropImageWidth, height: cropImageHeight, left: cropImageLeft, top: cropImageTop }} />
              <div aria-hidden="true" className={formStyles.cropMask} />
            </div>
            <label className={formStyles.cropControl}>Zoom<input type="range" min="1" max="3" step="0.01" value={cropZoom} onChange={(e) => setCropZoom(Number(e.target.value))} /></label>
            <label className={formStyles.cropControl}>Flytta vågrätt<input type="range" min="-1" max="1" step="0.01" value={cropOffset.x} onChange={(e) => setCropOffset((previous) => ({ ...previous, x: Number(e.target.value) }))} /></label>
            <label className={formStyles.cropControl}>Flytta lodrätt<input type="range" min="-1" max="1" step="0.01" value={cropOffset.y} onChange={(e) => setCropOffset((previous) => ({ ...previous, y: Number(e.target.value) }))} /></label>
            <div className={formStyles.photoActions}>
              <button type="button" onClick={() => { URL.revokeObjectURL(cropSource); setCropSource(""); }} className={formStyles.photoCancel}>Avbryt</button>
              <button type="button" onClick={() => void saveCroppedProfileImage()} disabled={docUploading} className={formStyles.photoConfirm}>{docUploading ? "Sparar..." : "Använd bild"}</button>
            </div>
          </div>
        </ModalDialog>
      )}
      {/* Progress bar */}
      <div className={formStyles.progress}>
        <div className={formStyles.progressHeader}>
          <span className={formStyles.progressCount}>
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
              className={formStyles.progressBack}
            >
              {step === FIRST_CV_STEP ? "←" : "← Tillbaka"}
            </button>
          )}
        </div>
        <div className={formStyles.progressTrack} role="progressbar" aria-label="Steg i formuläret" aria-valuemin={0} aria-valuemax={flowTotal} aria-valuenow={flowStep}>
          <div
            className={formStyles.progressValue}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Question bubble */}
      <div className={onboardingStyles.promptSection}>
        <div
          className={current.type === "image" ? `${onboardingStyles.promptBubble} ${onboardingStyles.promptBubbleActive}` : onboardingStyles.promptBubble}
        >
          {current.type === "image" ? (
            <h1 className={onboardingStyles.promptHeading}>
              {current.question}
            </h1>
          ) : (
            <p className={onboardingStyles.promptText}>
              {current.question}
            </p>
          )}
        </div>
      </div>

      {/* Input area */}
      <div className={onboardingStyles.stepContent}>
        {current.field === "full_name" ? (
          <div className={onboardingStyles.nameFields}>
          <div className={onboardingStyles.nameGrid}>
            <input
              type="text"
              value={firstName}
              onChange={(e) => {
                const value = e.target.value;
                setFirstName(value);
                setNameError("");
                setAnswers((prev) => ({ ...prev, full_name: normalizeFullName(`${value} ${lastName}`) }));
              }}
              placeholder="Namn"
              autoComplete="given-name"
              aria-invalid={nameError && !normalizeFullName(firstName) ? true : undefined}
              aria-describedby={nameError ? "youth-name-error" : undefined}
              autoFocus
              className={[onboardingStyles.givenNameInput, (nameError && !normalizeFullName(firstName)) ? onboardingStyles.givenNameInputActive : ""].join(" ")}
            />
            <input
              type="text"
              value={lastName}
              onChange={(e) => {
                const value = e.target.value;
                setLastName(value);
                setNameError("");
                setAnswers((prev) => ({ ...prev, full_name: normalizeFullName(`${firstName} ${value}`) }));
              }}
              placeholder="Efternamn"
              autoComplete="family-name"
              aria-invalid={nameError && !normalizeFullName(lastName) ? true : undefined}
              aria-describedby={nameError ? "youth-name-error" : undefined}
              className={[onboardingStyles.familyNameInput, (nameError && !normalizeFullName(lastName)) ? onboardingStyles.familyNameInputActive : ""].join(" ")}
            />
          </div>
          {nameError && (
            <p id="youth-name-error" role="alert" className={onboardingStyles.nameError}>{nameError}</p>
          )}
          </div>
        ) : current.field === "date_of_birth" ? (
          <div className={onboardingStyles.birthDateGrid}>
            <select value={birthDateParts.day} onChange={(e) => updateBirthDate("day", e.target.value)} aria-label="Dag" className={onboardingStyles.birthDateSelect}><option value="">Dag</option>{BIRTH_DAYS.map((day) => <option key={day} value={day}>{day}</option>)}</select>
            <select value={birthDateParts.month} onChange={(e) => updateBirthDate("month", e.target.value)} aria-label="Månad" className={onboardingStyles.birthDateSelect}><option value="">Månad</option>{BIRTH_MONTHS.map((month, index) => <option key={month} value={String(index + 1)}>{month}</option>)}</select>
            <select value={birthDateParts.year} onChange={(e) => updateBirthDate("year", e.target.value)} aria-label="År" className={onboardingStyles.birthDateSelect}><option value="">År</option>{BIRTH_YEARS.map((year) => <option key={year} value={year}>{year}</option>)}</select>
          </div>
        ) : current.field === "address" ? (
          <div className={onboardingStyles.addressList}>
            <div className={onboardingStyles.addressCard}>
              <p className={onboardingStyles.addressTitle}>Adress 1</p>
              <input type="text" value={answers.city} onChange={(e) => setAnswers((previous) => ({ ...previous, city: e.target.value }))} placeholder="Stad" autoComplete="address-level2" list="youth-city-suggestions" autoFocus className={onboardingStyles.addressInput} />
              <input type="text" value={answers.address} onChange={(e) => setAnswers((previous) => ({ ...previous, address: e.target.value }))} placeholder="Adress" autoComplete="street-address" list="youth-address-suggestions" className={onboardingStyles.addressInput} />
              <input type="text" inputMode="numeric" value={answers.postal_code} onChange={(e) => setAnswers((previous) => ({ ...previous, postal_code: e.target.value }))} placeholder="Postnummer" autoComplete="postal-code" className={onboardingStyles.addressInput} />
            </div>
            {additionalAddresses.map((item, index) => (
              <div key={index} className={onboardingStyles.additionalAddress}>
                <p className={onboardingStyles.addressNumber}>Adress {index + 2}</p>
                <button type="button" onClick={() => setAdditionalAddresses((previous) => previous.filter((_, addressIndex) => addressIndex !== index))} aria-label={`Ta bort adress ${index + 2}`} className={onboardingStyles.removeEntry}>×</button>
                {(["city", "address", "postal_code"] as const).map((field) => <input key={field} type="text" inputMode={field === "postal_code" ? "numeric" : undefined} list={field === "city" ? "youth-city-suggestions" : field === "address" ? "youth-address-suggestions" : undefined} value={item[field]} onChange={(e) => setAdditionalAddresses((previous) => previous.map((address, addressIndex) => addressIndex === index ? { ...address, [field]: e.target.value } : address))} placeholder={field === "city" ? "Stad" : field === "address" ? "Adress" : "Postnummer"} className={onboardingStyles.addressInput} />)}
              </div>
            ))}
            <button type="button" onClick={() => setAdditionalAddresses((previous) => [...previous, { city: "", address: "", postal_code: "" }])} className={onboardingStyles.addAddress}>+ Lägg till en ytterligare adress</button>
          </div>
        ) : current.type === "image" ? (
          <div className={onboardingStyles.photoGroup}>
            <div className={onboardingStyles.photoSquare}>
              {profileImagePreview ? <img src={profileImagePreview} alt="Profilbild" className={onboardingStyles.photoImage} /> : <><span className={onboardingStyles.photoPlaceholderIcon}>👤</span><span className={onboardingStyles.photoPlaceholderText}>Välj eller ta en profilbild</span></>}
            </div>
            <div className={onboardingStyles.photoButtons}>
              <label className={[onboardingStyles.photoUpload, (docUploading) ? onboardingStyles.photoUploadActive : ""].join(" ")}><input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleProfileImageSelect} disabled={docUploading} className={onboardingStyles.fileInput} />Bifoga bild</label>
              <label className={[onboardingStyles.photoCaptureLabel, (docUploading) ? onboardingStyles.photoCaptureLabelActive : ""].join(" ")}><input type="file" accept="image/jpeg,image/png,image/webp" capture="user" onChange={handleProfileImageSelect} disabled={docUploading} className={onboardingStyles.fileInput} />Ta bild</label>
            </div>
            <p className={onboardingStyles.photoHelp}>När du har valt en bild kan du beskära den till profilbilden.</p>
          </div>
        ) : current.type === "chips" ? (
          <div>
            <div className={onboardingStyles.choiceList}>
            {[...new Set([...current.chips!, ...currentChipsValue])].map((chip) => {
              const selected = (answers[current.field] as string[]).includes(chip);
              return (
                <button
                  key={chip}
                  type="button"
                  onClick={() => toggleChip(chip)}
                  className={[onboardingStyles.choiceButton, (selected) ? onboardingStyles.choiceButtonActive : ""].join(" ")}
                >
                  {chip}
                </button>
              );
            })}
            </div>
          </div>
        ) : current.field === "work_experience" ? (
          <div className={onboardingStyles.entryList}>
            {workExperiences.map((experience, index) => (
              <div key={index} className={onboardingStyles.entryCard}>
                {savedWorkExperiences[index] ? (
                  <>
                    <div className={onboardingStyles.workSummary}>
                      <div><p className={onboardingStyles.entryTitle}>{experience.title || "Arbetserfarenhet"}</p><p className={onboardingStyles.entrySubtitle}>{[experience.company, experience.employment_type].filter(Boolean).join(" · ") || "Företag ej angivet"}</p></div>
                      <button type="button" onClick={() => setSavedWorkExperiences((previous) => previous.map((saved, savedIndex) => savedIndex === index ? false : saved))} className={onboardingStyles.editEntry}>Redigera</button>
                    </div>
                    <p className={onboardingStyles.entryDates}>{[experience.start_date, experience.end_date].filter(Boolean).join(" – ") || "Datum ej angivet"}</p>
                    {experience.description && <p className={onboardingStyles.entryDescription}>{experience.description}</p>}
                    <p className={onboardingStyles.entryContext}>{[experience.location, experience.location_type].filter(Boolean).join(" · ") || "Plats ej angiven"}</p>
                  </>
                ) : <>
                <p className={onboardingStyles.addressNumber}>Arbetserfarenhet {index + 1}</p>
                {workExperiences.length > 1 && <button type="button" onClick={() => { setWorkExperiences((previous) => previous.filter((_, experienceIndex) => experienceIndex !== index)); setSavedWorkExperiences((previous) => previous.filter((_, experienceIndex) => experienceIndex !== index)); }} aria-label={`Ta bort arbetserfarenhet ${index + 1}`} className={onboardingStyles.removeEntry}>×</button>}
                {(["title", "company", "location"] as const).map((field) => <label key={field} className={onboardingStyles.workField}>{field === "title" ? "Titel" : field === "company" ? "Arbetsgivare" : "Plats"}<input type="text" list={field === "title" ? "youth-job-title-suggestions" : field === "company" ? "youth-company-name-suggestions" : "youth-city-suggestions"} value={experience[field]} onChange={(e) => setWorkExperiences((previous) => previous.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: e.target.value } : item))} placeholder={field === "title" ? "T.ex. Butiksmedarbetare" : field === "company" ? "T.ex. ICA" : "T.ex. Stockholm"} className={onboardingStyles.addressInput} /></label>)}
                <label className={onboardingStyles.workField}>Platstyp<select value={experience.location_type} onChange={(e) => setWorkExperiences((previous) => previous.map((item, itemIndex) => itemIndex === index ? { ...item, location_type: e.target.value } : item))} className={[onboardingStyles.workLocation, (experience.location_type) ? onboardingStyles.workLocationActive : ""].join(" ")}><option value="">Välj</option><option value="På plats">På plats</option><option value="Hybrid">Hybrid</option><option value="Distans">Distans</option></select></label>
                <label className={onboardingStyles.workField}>Anställningstyp<select value={experience.employment_type} onChange={(e) => setWorkExperiences((previous) => previous.map((item, itemIndex) => itemIndex === index ? { ...item, employment_type: e.target.value } : item))} className={[onboardingStyles.workEmployment, (experience.employment_type) ? onboardingStyles.workEmploymentActive : ""].join(" ")}><option value="">Välj</option><option value="Deltid">Deltid</option><option value="Heltid">Heltid</option><option value="Sommarjobb">Sommarjobb</option><option value="Praktik">Praktik</option><option value="Extraarbete">Extraarbete</option></select></label>
                <label className={onboardingStyles.currentWork}><input type="checkbox" checked={experience.is_current} onChange={(e) => setWorkExperiences((previous) => previous.map((item, itemIndex) => itemIndex === index ? { ...item, is_current: e.target.checked, end_date: e.target.checked ? "" : item.end_date } : item))} /> Detta är min nuvarande arbetsplats</label>
                <div className={experience.is_current ? onboardingStyles.workDateGridActive + " " + onboardingStyles.workDateGrid : onboardingStyles.workDateGrid} >
                  {((experience.is_current ? ["start_date"] : ["start_date", "end_date"]) as Array<"start_date" | "end_date">).map((dateField) => {
                    const [year = "", month = ""] = experience[dateField].split("-");
                    return <div key={dateField} className={onboardingStyles.dateCaption}>
                      <span>{dateField === "start_date" ? "Startdatum" : "Slutdatum"}</span>
                      <div className={onboardingStyles.dateFields}>
                        <select value={month} onChange={(e) => updateExperienceDate(index, dateField, "month", e.target.value)} aria-label={`${dateField === "start_date" ? "Startdatum" : "Slutdatum"} månad`} className={onboardingStyles.monthYearSelect}><option value="">Månad</option>{BIRTH_MONTHS.map((monthName, monthIndex) => { const value = String(monthIndex + 1).padStart(2, "0"); return <option key={monthName} value={value} disabled={!canSelectDatePart(dateField, "month", value, experience.start_date, experience.end_date)}>{monthName}</option>; })}</select>
                        <select value={year} onChange={(e) => updateExperienceDate(index, dateField, "year", e.target.value)} aria-label={`${dateField === "start_date" ? "Startdatum" : "Slutdatum"} år`} className={onboardingStyles.monthYearSelect}><option value="">År{dateField === "start_date" ? " *" : ""}</option>{workYears.map((workYear) => <option key={workYear} value={workYear} disabled={!canSelectDatePart(dateField, "year", workYear, experience.start_date, experience.end_date)}>{workYear}</option>)}</select>
                      </div>
                    </div>;
                  })}
                </div>
                <label className={onboardingStyles.workField}>Beskrivning<textarea value={experience.description} onChange={(e) => setWorkExperiences((previous) => previous.map((item, itemIndex) => itemIndex === index ? { ...item, description: e.target.value } : item))} placeholder="T.ex. Jag hjälpte kunder och fyllde på varor" rows={3} className={onboardingStyles.workDescription} /></label>
                <button type="button" onClick={() => { if (!workExperienceIsComplete(experience)) { setError("Fyll i alla fält för att spara erfarenheten."); return; } setError(""); setSavedWorkExperiences((previous) => previous.map((saved, savedIndex) => savedIndex === index ? true : saved)); }} className={onboardingStyles.saveWork}>Spara erfarenhet</button>
                </>}
              </div>
            ))}
            <button type="button" onClick={() => { setWorkExperiences((previous) => [...previous, emptyWorkExperience()]); setSavedWorkExperiences((previous) => [...previous, false]); }} className={onboardingStyles.addWork}>+ Lägg till arbetserfarenhet</button>
          </div>
        ) : current.field === "education" ? (
          <div className={onboardingStyles.entryList}>
            <p className={onboardingStyles.stepDescription}>{current.description}</p>
            {educations.map((education, index) => (
              <div key={index} className={onboardingStyles.entryCard}>
                {savedEducations[index] ? <>
                  <div className={onboardingStyles.entrySummary}><div><p className={onboardingStyles.entryTitle}>{education.school || "Utbildning"}</p><p className={onboardingStyles.entrySubtitle}>{[education.degree, education.subject].filter(Boolean).join(" · ") || "Examen ej angiven"}</p></div><button type="button" onClick={() => setSavedEducations((previous) => previous.map((saved, savedIndex) => savedIndex === index ? false : saved))} className={onboardingStyles.editEntry}>Redigera</button></div>
                  <p className={onboardingStyles.entryDates}>{[education.start_date, education.end_date].filter(Boolean).join(" – ") || "Datum ej angivet"}</p>
                  {education.description && <p className={onboardingStyles.entryDescription}>{education.description}</p>}
                </> : <>
                  <p className={onboardingStyles.addressNumber}>Utbildning {index + 1}</p>
                  {educations.length > 1 && <button type="button" onClick={() => { setEducations((previous) => previous.filter((_, itemIndex) => itemIndex !== index)); setSavedEducations((previous) => previous.filter((_, itemIndex) => itemIndex !== index)); }} aria-label={`Ta bort utbildning ${index + 1}`} className={onboardingStyles.removeMerit}>×</button>}
                  <label className={onboardingStyles.meritField}>Examen *<input type="text" value={education.degree} onChange={(e) => setEducations((previous) => previous.map((item, itemIndex) => itemIndex === index ? { ...item, degree: e.target.value } : item))} placeholder="T.ex. gymnasium, universitet eller yrkesutbildning" className={onboardingStyles.meritInput} /></label>
                  <label className={onboardingStyles.meritField}>Skola *<input type="text" value={education.school} onChange={(e) => setEducations((previous) => previous.map((item, itemIndex) => itemIndex === index ? { ...item, school: e.target.value } : item))} placeholder="Kungsholmens Gymnasium" className={onboardingStyles.meritInput} /></label>
                  <label className={onboardingStyles.meritField}>Ämnesområde *<input type="text" value={education.subject} onChange={(e) => setEducations((previous) => previous.map((item, itemIndex) => itemIndex === index ? { ...item, subject: e.target.value } : item))} placeholder="T.ex. Ekonomi" className={onboardingStyles.meritInput} /></label>
                  <div className={onboardingStyles.educationDateLabel}>
                    <span className={onboardingStyles.educationDateTitle}>Tid *</span>
                    <div className={onboardingStyles.educationDates}>
                      {(["start_date", "end_date"] as const).map((dateField) => {
                        const [year = "", month = ""] = education[dateField].split("-");
                        return <div key={dateField} className={onboardingStyles.dateCaption}>
                          <span>{dateField === "start_date" ? "Startdatum" : "Slutdatum (eller förväntat)"}</span>
                          <div className={onboardingStyles.educationDateFields}>
                            <select value={month} onChange={(e) => updateEducationDate(index, dateField, "month", e.target.value)} className={onboardingStyles.meritDateSelect}>
                              <option value="">Månad</option>
                              {BIRTH_MONTHS.map((monthName, monthIndex) => {
                                const value = String(monthIndex + 1).padStart(2, "0");
                                return <option key={monthName} value={value} disabled={!canSelectDatePart(dateField, "month", value, education.start_date, education.end_date)}>{monthName}</option>;
                              })}
                            </select>
                            <select value={year} onChange={(e) => updateEducationDate(index, dateField, "year", e.target.value)} className={onboardingStyles.meritDateSelect}>
                              <option value="">År</option>
                              {workYears.map((workYear) => <option key={workYear} value={workYear} disabled={!canSelectDatePart(dateField, "year", workYear, education.start_date, education.end_date)}>{workYear}</option>)}
                            </select>
                          </div>
                        </div>;
                      })}
                    </div>
                  </div>
                  <textarea value={education.description} onChange={(e) => setEducations((previous) => previous.map((item, itemIndex) => itemIndex === index ? { ...item, description: e.target.value } : item))} placeholder="Beskrivning *" rows={3} className={onboardingStyles.educationDescription} />
                  <button type="button" onClick={() => { if (!educationIsComplete(education)) { setError("Fyll i alla fält för att spara utbildningen."); return; } setError(""); setSavedEducations((previous) => previous.map((saved, savedIndex) => savedIndex === index ? true : saved)); }} className={onboardingStyles.saveEducation}>Spara utbildning</button>
                </>}
              </div>
            ))}
            <button type="button" onClick={() => { setEducations((previous) => [...previous, emptyEducation()]); setSavedEducations((previous) => [...previous, false]); }} className={onboardingStyles.addMerit}>+ Lägg till utbildning</button>
          </div>
        ) : current.field === "certificates" ? (
          <div className={onboardingStyles.entryList}>
            {certificates.map((certificate, index) => (
              <div key={index} className={onboardingStyles.entryCard}>
                {savedCertificates[index] ? <>
                  <div className={onboardingStyles.entrySummary}><div><p className={onboardingStyles.entryTitle}>{certificate.name || "Certifikat"}</p><p className={onboardingStyles.entrySubtitle}>{[certificate.issuer, certificate.category].filter(Boolean).join(" · ") || "Organisation ej angiven"}</p></div><button type="button" onClick={() => setSavedCertificates((previous) => previous.map((saved, savedIndex) => savedIndex === index ? false : saved))} className={onboardingStyles.editEntry}>Redigera</button></div>
                  <p className={onboardingStyles.entryDates}>{[certificate.issue_date, certificate.expiry_date].filter(Boolean).join(" – ") || "Datum ej angivet"}</p>
                  {certificate.description && <p className={onboardingStyles.entryDescription}>{certificate.description}</p>}
                  {certificate.credential_url && <p className={onboardingStyles.credentialLink}>{certificate.credential_url}</p>}
                  {certificate.pdf_url && <p className={onboardingStyles.credentialFile}>PDF-intyg bifogat</p>}
                </> : <>
                  <p className={onboardingStyles.addressNumber}>Certifikat {index + 1}</p>
                  {certificates.length > 1 && <button type="button" onClick={() => { setCertificates((previous) => previous.filter((_, itemIndex) => itemIndex !== index)); setSavedCertificates((previous) => previous.filter((_, itemIndex) => itemIndex !== index)); }} aria-label={`Ta bort certifikat ${index + 1}`} className={onboardingStyles.removeMerit}>×</button>}
                  {(["name", "issuer"] as const).map((field) => <label key={field} className={onboardingStyles.meritField}>{field === "name" ? "Namn *" : "Utfärdande organisation *"}<input type="text" value={certificate[field]} onChange={(e) => setCertificates((previous) => previous.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: e.target.value } : item))} placeholder={field === "name" ? "T.ex. HLR-certifikat" : "T.ex. Röda Korset"} className={onboardingStyles.meritInput} /></label>)}
                  <label className={onboardingStyles.meritField}>Typ<select value={certificate.category} onChange={(e) => setCertificates((previous) => previous.map((item, itemIndex) => itemIndex === index ? { ...item, category: e.target.value } : item))} className={[onboardingStyles.certificateCategory, (certificate.category) ? onboardingStyles.certificateCategoryActive : ""].join(" ")}><option value="">Välj</option><option value="Certifikat">Certifikat</option><option value="Stipendium">Stipendium</option><option value="Licens">Licens</option><option value="Annat">Annat</option></select></label>
                  <div className={onboardingStyles.certificateDates}>
                    {(["issue_date", "expiry_date"] as const).map((field) => {
                      const [year = "", month = ""] = certificate[field].split("-");
                      return <label key={field} className={onboardingStyles.meritField}>
                        {field === "issue_date" ? "Utfärdandedatum *" : "Giltig till *"}
                        <div className={onboardingStyles.certificateDateFields}>
                          <select value={month} onChange={(e) => updateCertificateDate(index, field, "month", e.target.value)} className={onboardingStyles.meritDateSelect}><option value="">Månad</option>{BIRTH_MONTHS.map((monthName, monthIndex) => { const monthValue = String(monthIndex + 1).padStart(2, "0"); return <option key={monthName} value={monthValue} disabled={!canSelectDatePart(field, "month", monthValue, certificate.issue_date, certificate.expiry_date)}>{monthName}</option>; })}</select>
                          <select value={year} onChange={(e) => updateCertificateDate(index, field, "year", e.target.value)} className={onboardingStyles.meritDateSelect}><option value="">År</option>{workYears.map((workYear) => <option key={workYear} value={workYear} disabled={!canSelectDatePart(field, "year", workYear, certificate.issue_date, certificate.expiry_date)}>{workYear}</option>)}</select>
                        </div>
                      </label>;
                    })}
                  </div>
                  <div className={onboardingStyles.certificateUpload}>
                    <p className={onboardingStyles.certificateUploadTitle}>Bifoga ett intyg</p>
                    <label className={onboardingStyles.meritField}><input type="url" value={certificate.credential_url} onChange={(e) => setCertificates((previous) => previous.map((item, itemIndex) => itemIndex === index ? { ...item, credential_url: e.target.value } : item))} placeholder="Klistra in en länk till intyget, t.ex. https://..." className={onboardingStyles.certificateUrl} /></label>
                    <label className={formStyles.filePicker} data-uploading={docUploading}><input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,text/plain" onChange={(e) => void handleCertificatePdfSelect(index, e)} disabled={docUploading} className={onboardingStyles.fileInput} />Bifoga fil som intyg</label>
                  </div>
                  <label className={onboardingStyles.meritField}>Beskrivning<textarea value={certificate.description} onChange={(e) => setCertificates((previous) => previous.map((item, itemIndex) => itemIndex === index ? { ...item, description: e.target.value } : item))} placeholder="T.ex. Vad certifikatet eller stipendiet gällde" rows={2} className={onboardingStyles.certificateDescription} /></label>
                  {false && (
                  <label className={formStyles.filePicker} data-uploading={docUploading}><input type="file" accept="application/pdf" onChange={(e) => void handleCertificatePdfSelect(index, e)} disabled={docUploading} className={onboardingStyles.fileInput} />📎 {certificate.pdf_url ? "PDF-intyg bifogat – byt fil" : "Bifoga PDF-intyg (valfritt)"}</label>
                  )}
                  <button type="button" onClick={() => { if (!certificateIsComplete(certificate)) { setError("Fyll i alla fält för att spara certifikatet."); return; } setError(""); setSavedCertificates((previous) => previous.map((saved, savedIndex) => savedIndex === index ? true : saved)); }} className={onboardingStyles.saveCertificate}>Spara certifikat</button>
                </>}
              </div>
            ))}
            <button type="button" onClick={() => { setCertificates((previous) => [...previous, emptyCertificate()]); setSavedCertificates((previous) => [...previous, false]); }} className={onboardingStyles.addMerit}>+ Lägg till certifikat eller stipendium</button>
          </div>
        ) : selectionField ? (
          <div className={onboardingStyles.selectionGroup}>
            <div className={[onboardingStyles.customChoiceRow, (selectionField === "strengths") ? onboardingStyles.customChoiceRowActive : ""].join(" ")}>
              <input
                type="text"
                value={selectionField === "strengths" ? strengthInput : languageInput}
                onChange={(e) => selectionField === "strengths" ? setStrengthInput(e.target.value) : setLanguageInput(e.target.value)}
                placeholder={current.placeholder}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); saveCustomValue(selectionField); } }}
                autoFocus
              className={onboardingStyles.customChoiceInput}
              />
              <button type="button" onClick={() => saveCustomValue(selectionField)} aria-label="Lägg till" className={onboardingStyles.customChoiceAdd}>+</button>
            </div>
            <p className={[onboardingStyles.customChoiceHelp, (selectionField === "strengths") ? onboardingStyles.customChoiceHelpActive : ""].join(" ")}>Skriv en egen och tryck på +, eller välj bland förslagen.</p>
            <div className={[onboardingStyles.selectionChips, (selectionField === "strengths") ? onboardingStyles.selectionChipsActive : ""].join(" ")}>
              {[...new Set([...(selectionField === "strengths" ? STRENGTH_TIPS : LANGUAGE_TIPS.map((item) => item.label)), ...(selectionField === "strengths" ? selectedStrengths : selectedLanguages)])].map((value) => {
                const selected = (selectionField === "strengths" ? selectedStrengths : selectedLanguages).includes(value);
                const flag = selectionField === "languages" ? getLanguageFlag(value) : undefined;
                return <button key={value} type="button" onClick={() => toggleSelectedValue(selectionField, value)} className={[onboardingStyles.selectionChip, (selected) ? onboardingStyles.selectionChipActive : ""].join(" ")}>{flag && <span aria-hidden="true">{flag}</span>}{value}</button>;
              })}
            </div>
          </div>
        ) : current.field === "extracurriculars" ? (
          <div className={onboardingStyles.selectionGroup}>
            <p className={onboardingStyles.stepDescription}>{current.description}</p>
            {otherEntries.map((entry, index) => <div key={`${entry.title}-${index}`} className={onboardingStyles.otherEntry}><div><strong className={onboardingStyles.otherTitle}>{entry.title}</strong><p className={onboardingStyles.otherDescription}>{entry.type === "write" ? entry.value : entry.type === "link" ? "Länk bifogad" : "PDF bifogad"}</p></div><button type="button" onClick={() => setOtherEntries((previous) => previous.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Ta bort ${entry.title}`} className={onboardingStyles.removeOther}>×</button></div>)}
            <div className={onboardingStyles.otherOptions}>
              {([["write", "Skriva"], ["link", "Bifoga länk"], ["pdf", "Bifoga PDF"] ] as const).map(([type, label]) => <button key={type} type="button" onClick={() => { setError(""); setOtherType(type); }} className={[ onboardingStyles.otherOption, (otherType === type) ? onboardingStyles.otherOptionActive : ""].join(" ")}>{label}</button>)}
            </div>
            {otherType && <input type="text" value={otherTitle} onChange={(e) => setOtherTitle(e.target.value)} placeholder="Titel" className={onboardingStyles.otherInput} />}
            {otherType === "write" && <textarea value={answers.extracurriculars} onChange={(e) => handleTextChange(e.target.value)} placeholder="Skriv ditt tillägg här" rows={4} className={onboardingStyles.otherText} />}
            {otherType === "link" && <input type="url" value={otherLink} onChange={(e) => setOtherLink(e.target.value)} placeholder="https://linkedin.com/in/..." className={onboardingStyles.otherInput} />}
            {otherType === "pdf" && <label className={formStyles.pdfPicker} data-uploading={docUploading}><input type="file" accept="application/pdf" onChange={(e) => void handleOtherPdfSelect(e)} disabled={docUploading} className={onboardingStyles.fileInput} />📎 {docUploading ? "Laddar upp..." : otherPdf ? `PDF bifogad: ${otherPdf.name}` : "Tryck för att bifoga en PDF"}</label>}
            <button type="button" onClick={saveOtherEntry} className={onboardingStyles.saveOther}>Spara tillägg</button>
          </div>
        ) : current.field === "skills_text" ? (
          <div className={onboardingStyles.softwareFields}>
            <div className="skill-logo-options" aria-label="Vanliga kompetenser och verktyg">
              {SKILL_TIPS.map((skill) => {
                const selected = answers.skills_text.split(",").map((item) => item.trim()).includes(skill.label);
                return (
                  <button key={skill.label} type="button" className={`skill-logo-option${selected ? " skill-logo-option-selected" : ""}`} onClick={() => toggleSkill(skill.label)} aria-pressed={selected}>
                    <span className={`skill-logo-mark ${onboardingStyles.softwareIcon}`} data-skill={skill.id} aria-hidden="true">{skill.mark}</span>
                    <span>{skill.label}</span>
                  </button>
                );
              })}
            </div>
            <label className={onboardingStyles.softwareLabel}>
              Andra kompetenser
              <textarea value={currentTextValue} onChange={(e) => handleTextChange(e.target.value)} placeholder="T.ex. kassasystem eller bildredigering" rows={3} className={onboardingStyles.softwareText} />
            </label>
          </div>
        ) : current.type === "textarea" ? (
          <textarea
            value={currentTextValue}
            onChange={(e) => handleTextChange(e.target.value)}
            placeholder={current.placeholder}
            rows={4}
            className={onboardingStyles.freeText}
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
            className={onboardingStyles.questionInput}
          />
        )}

        {error && (
          <p className={onboardingStyles.stepError}>{error}</p>
        )}
      </div>

      {/* Navigation */}
      <div className={onboardingStyles.stepActions}>
        <button
          className={["onboarding-primary-action", onboardingStyles.stepContinue, (saving) ? onboardingStyles.stepContinueActive : ""].join(" ")}
          type="button"
          onClick={() => void handleNext()}
          disabled={saving}

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
            className={onboardingStyles.stepSkip}
          >
            Hoppa över
          </button>
        )}
      </div>
    </main>
  );
}
