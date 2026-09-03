import { NextRequest, NextResponse } from "next/server";
import { renderStructuredCv, structuredCvFromForm } from "@/lib/structured-cv";

export const runtime = "nodejs";

interface CvInput {
  full_name?: string; age?: string; city?: string; desired_roles?: string[]; strengths?: string; languages?: string; employment_preferences?: string[];
  phone?: string; email?: string; linkedin?: string; portfolio?: string; profile_details?: string; target_job?: string; projects_text?: string; skills_text?: string;
  work_experience?: string; education?: string; certificates?: string; extracurriculars?: string;
  work_experiences?: Array<{ title?: string; company?: string; location?: string; location_type?: string; employment_type?: string; start_date?: string; end_date?: string; is_current?: boolean; description?: string }>;
  educations?: Array<{ school?: string; degree?: string; subject?: string; start_date?: string; end_date?: string; description?: string }>;
  certificate_entries?: Array<{ name?: string; issuer?: string; category?: string; issue_date?: string; expiry_date?: string; credential_url?: string; description?: string }>;
  other_entries?: Array<{ title?: string; type?: string; value?: string }>;
}

const present = (value?: string) => value?.trim() ?? "";
const formatList = (items: string[]) => items.filter(Boolean).map((item) => `- ${item}`).join("\n");

async function generateProfileSummary(facts: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || !facts.trim()) return "";

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.GROQ_CV_MODEL ?? "llama-3.3-70b-versatile",
      temperature: 0.2,
      max_tokens: 140,
      messages: [{
        role: "system",
        content: "Skriv en kort svensk CV-profil på 2-3 meningar utifrån enbart angivna fakta. Hitta aldrig på erfarenhet, utbildning, färdigheter, resultat eller kontaktuppgifter. Om underlaget är för tunt, returnera en tom sträng.",
      }, {
        role: "user",
        content: facts,
      }],
    }),
  });

  if (!response.ok) return "";
  const payload = await response.json() as { choices?: Array<{ message?: { content?: string } }> };
  return payload.choices?.[0]?.message?.content?.trim() ?? "";
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as CvInput;
  const structured = structuredCvFromForm(body);
  const structuredWork = (body.work_experiences ?? []).map((item) => [[present(item.title), present(item.company)].filter(Boolean).join(" hos "), [present(item.start_date), item.is_current ? "Nuvarande" : present(item.end_date)].filter(Boolean).join(" – "), [present(item.location), present(item.location_type)].filter(Boolean).join(", "), present(item.employment_type), present(item.description)].filter(Boolean).join(" | ")).filter(Boolean);
  const structuredEducation = (body.educations ?? []).map((item) => [[present(item.degree), present(item.school)].filter(Boolean).join(", "), present(item.subject), [present(item.start_date), present(item.end_date)].filter(Boolean).join(" – "), present(item.description)].filter(Boolean).join(" | ")).filter(Boolean);
  const structuredCertificates = (body.certificate_entries ?? []).map((item) => [[present(item.name), present(item.issuer)].filter(Boolean).join(", "), present(item.category), [present(item.issue_date), present(item.expiry_date)].filter(Boolean).join(" – "), present(item.description)].filter(Boolean).join(" | ")).filter(Boolean);
  const structuredMerits = (body.other_entries ?? []).map((item) => [present(item.title), present(item.value)].filter(Boolean).join(": ")).filter(Boolean);
  const work = structuredWork.length ? structuredWork : [present(body.work_experience)].filter(Boolean);
  const education = structuredEducation.length ? structuredEducation : [present(body.education)].filter(Boolean);
  const certificates = structuredCertificates.length ? structuredCertificates : [present(body.certificates)].filter(Boolean);
  const merits = structuredMerits.length ? structuredMerits : [present(body.extracurriculars)].filter(Boolean);

  const facts = [
    present(body.full_name) && `Namn: ${present(body.full_name)}`,
    present(body.age) && `Ålder: ${present(body.age)} år`,
    present(body.city) && `Ort: ${present(body.city)}`,
    body.desired_roles?.length && `Söker roller inom: ${body.desired_roles.join(", ")}`,
    present(body.strengths) && `Styrkor: ${present(body.strengths)}`,
    present(body.languages) && `Språk: ${present(body.languages)}`,
    body.employment_preferences?.length && `Tillgänglighet: ${body.employment_preferences.join(", ")}`,
    work.length && `Arbetslivserfarenhet:\n${formatList(work)}`,
    education.length && `Utbildning:\n${formatList(education)}`,
    certificates.length && `Certifikat, stipendier och licenser:\n${formatList(certificates)}`,
    merits.length && `Övriga meriter:\n${formatList(merits)}`,
  ].filter(Boolean).join("\n\n");

  try {
    const profileSummary = await generateProfileSummary(facts);
    if (profileSummary) structured.profile.sourceNotes = [profileSummary];
  } catch {
    // The deterministic structured CV remains available if Groq is unavailable.
  }

  return NextResponse.json({ cv: renderStructuredCv(structured), structured });
}
