import { NextRequest, NextResponse } from "next/server";
import { CvLanguage, CvTone, generateCv } from "@/lib/cv-ai";
import { jsonError, requireUser } from "@/lib/api-auth";
import { readDb } from "@/lib/db";
import {
  applyAnswer,
  completionPercent,
  draftFromProfile,
  firstIncompleteStep,
  nextStep,
  OnboardingDraft,
  questionForStep,
  recommendations,
} from "@/lib/onboarding-flow";
import { JobType, OnboardingStep, YouthProfile } from "@/lib/types";

interface OnboardingAiBody {
  mode?: "init" | "answer";
  step?: OnboardingStep;
  answer?: string;
  draft?: Partial<OnboardingDraft>;
  language?: CvLanguage;
  tone?: CvTone;
  targetJobType?: JobType | "any";
}

function toProfile(baseProfile: YouthProfile, draft: OnboardingDraft): YouthProfile {
  return {
    ...baseProfile,
    name: draft.name,
    age: draft.age,
    city: draft.city,
    targetRole: draft.targetRole,
    interests: draft.interests,
    skills: draft.skills,
    availability: draft.availability,
    experience: draft.experience,
  };
}

function sanitizeDraft(baseDraft: OnboardingDraft, partial?: Partial<OnboardingDraft>): OnboardingDraft {
  if (!partial) return baseDraft;
  return {
    name: partial.name ?? baseDraft.name,
    age: partial.age ?? baseDraft.age,
    city: partial.city ?? baseDraft.city,
    targetRole: partial.targetRole ?? baseDraft.targetRole,
    interests: partial.interests ?? baseDraft.interests,
    skills: partial.skills ?? baseDraft.skills,
    availability: partial.availability ?? baseDraft.availability,
    experience: partial.experience ?? baseDraft.experience,
  };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await requireUser(request, ["youth"]);
  if ("error" in auth) {
    return auth.error;
  }

  const body = (await request.json().catch(() => ({}))) as OnboardingAiBody;
  const mode = body.mode || "init";

  const db = await readDb();
  const profile =
    db.youthProfiles.find((candidate) => candidate.userId === auth.user.id) ||
    ({
      userId: auth.user.id,
      name: "",
      age: null,
      city: "",
      targetRole: "",
      skills: [],
      interests: [],
      experience: [],
      availability: "",
      premiumBadge: false,
      cv: null,
      updatedAt: new Date().toISOString(),
    } satisfies YouthProfile);

  const baseDraft = draftFromProfile(profile);
  let draft = sanitizeDraft(baseDraft, body.draft);
  let step: OnboardingStep | null = body.step || firstIncompleteStep(draft) || "name";
  let validationError = "";

  if (mode === "answer") {
    if (!body.answer || !step) {
      return jsonError("Step and answer are required.");
    }
    const result = applyAnswer({
      draft,
      step,
      answer: body.answer,
      language: body.language || "en",
    });
    draft = result.draft;

    if (!result.accepted) {
      validationError = result.hint || "Please try again.";
    } else {
      step = nextStep(step) || firstIncompleteStep(draft);
    }
  }

  const done = !step;
  const activeStep = step || "experience";
  const mergedProfile = toProfile(profile, draft);
  const generatedCv = generateCv({
    profile: mergedProfile,
    targetRole: draft.targetRole,
    language: body.language || "en",
    tone: body.tone || "professional",
    targetJobType: body.targetJobType || "any",
    prompt: draft.experience.join(". "),
  });

  return NextResponse.json({
    done,
    completion: completionPercent(draft),
    step: done ? "done" : activeStep,
    question:
      done
        ? body.language === "sv"
          ? "Bra. Granska och spara din profil."
          : "Great. Review and save your profile."
        : questionForStep(activeStep, body.language || "en"),
    validationError,
    recommendations: done ? [] : recommendations(activeStep, body.language || "en"),
    draftProfile: draft,
    cv: {
      summary: generatedCv.summary,
      content: generatedCv.content,
      language: generatedCv.language,
      tone: generatedCv.tone,
      targetRole: generatedCv.targetRole,
      qualityScore: generatedCv.qualityScore,
      highlights: generatedCv.highlights,
      keywords: generatedCv.keywords,
      suggestions: generatedCv.suggestions,
    },
  });
}
