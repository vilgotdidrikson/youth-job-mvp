import { NextRequest, NextResponse } from "next/server";
import { jsonError, requireUser } from "@/lib/api-auth";
import { updateDb } from "@/lib/db";
import { CvChatMessage, CvLanguage, CvTone, generateCv } from "@/lib/cv-ai";
import { JobType } from "@/lib/types";

interface CvBody {
  prompt?: string;
  messages?: CvChatMessage[];
  targetRole?: string;
  targetJobType?: JobType | "any";
  language?: CvLanguage;
  tone?: CvTone;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await requireUser(request, ["youth"]);
  if ("error" in auth) {
    return auth.error;
  }

  const body = (await request.json().catch(() => ({}))) as CvBody;
  const prompt = body.prompt?.trim();
  const targetRole = body.targetRole?.trim();
  const language = body.language || "en";
  const tone = body.tone || "professional";
  const targetJobType = body.targetJobType || "any";

  try {
    const generated = await updateDb((db) => {
      const profile = db.youthProfiles.find(
        (candidate) => candidate.userId === auth.user.id,
      );
      if (!profile) {
        throw new Error("PROFILE_NOT_FOUND");
      }

      const cv = generateCv({
        profile,
        prompt,
        messages: body.messages,
        targetRole,
        targetJobType,
        language,
        tone,
      });

      profile.cv = {
        summary: cv.summary,
        content: cv.content,
        qualityScore: cv.qualityScore,
        highlights: cv.highlights,
        keywords: cv.keywords,
        suggestions: cv.suggestions,
        language: cv.language,
        tone: cv.tone,
        targetRole: cv.targetRole,
        updatedAt: new Date().toISOString(),
      };
      profile.updatedAt = new Date().toISOString();
      return profile.cv;
    });

    if (!generated) {
      return jsonError("Could not generate CV.", 500);
    }

    return NextResponse.json({ cv: generated });
  } catch (error) {
    if (error instanceof Error && error.message === "PROFILE_NOT_FOUND") {
      return jsonError("Create your youth profile before generating a CV.", 404);
    }
    return jsonError("Could not generate CV.", 500);
  }
}
