import { NextRequest, NextResponse } from "next/server";
import { renderStructuredCv, structuredCvFromForm, type StructuredCvData } from "@/lib/structured-cv";
import { writeCv } from "@/lib/cv-generation";
import { requireApiUser } from "@/lib/api-auth";

export const runtime = "nodejs";
export const maxDuration = 60;
type CvInput = Parameters<typeof structuredCvFromForm>[0] & { structured?: StructuredCvData; conversation?: unknown[] };

export async function POST(request: NextRequest) {
  const auth = await requireApiUser(request, "cv-generate");
  if ("response" in auth) return auth.response;
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "CV-bearbetningen är tillfälligt otillgänglig. Ditt underlag finns kvar, försök igen senare." }, { status: 503 });
  try {
    const text = await request.text();
    if (text.length > 100_000) return NextResponse.json({ error: "CV-underlaget är för långt." }, { status: 413 });
    const body = JSON.parse(text) as CvInput;
    const form = structuredCvFromForm(body);
    const source = body.structured ? structuredClone(body.structured) : form;
    if (body.structured) {
      source.personalInfo = { ...source.personalInfo, ...Object.fromEntries(Object.entries(form.personalInfo).filter(([, value]) => value)) };
      source.profile.targetRoles = [...new Set([...source.profile.targetRoles, ...form.profile.targetRoles])];
      if (body.profile_details?.trim()) source.profile.sourceNotes.push(body.profile_details.trim());
      source.otherExperience.push(...form.otherExperience);
      source.projects.push(...form.projects);
      source.skills.push(...form.skills);
    }
    const structured = await writeCv(source, request.signal, Array.isArray(body.conversation) ? body.conversation.slice(-20) : []);
    if (!structured.profile.summary && ![structured.workExperience, structured.education, structured.projects, structured.skills, structured.certifications, structured.languages, structured.otherExperience].some((items) => items.length)) {
      return NextResponse.json({ error: "Underlaget är för tunt för ett CV. Lägg till något om din utbildning, dina färdigheter eller erfarenheter." }, { status: 422 });
    }
    return NextResponse.json({ cv: renderStructuredCv(structured), structured });
  } catch (error) {
    if (request.signal.aborted) return new NextResponse(null, { status: 499 });
    console.error("CV writing failed", error instanceof Error ? error.name : "Unknown error");
    return NextResponse.json({ error: "Kunde inte bearbeta CV:t just nu. Dina svar finns kvar. Försök igen." }, { status: 502 });
  }
}
