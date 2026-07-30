import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const groq = new OpenAI({
  baseURL: "https://api.groq.com/openai/v1",
  apiKey: process.env.GROQ_API_KEY ?? "",
});

interface CvInput {
  full_name?: string;
  age?: string;
  city?: string;
  desired_roles?: string[];
  strengths?: string;
  languages?: string;
  employment_preferences?: string[];
  work_experiences?: Array<{ title?: string; company?: string; location?: string; location_type?: string; employment_type?: string; start_date?: string; end_date?: string; is_current?: boolean; description?: string }>;
  educations?: Array<{ school?: string; degree?: string; subject?: string; start_date?: string; end_date?: string; description?: string }>;
  certificate_entries?: Array<{ name?: string; issuer?: string; category?: string; issue_date?: string; expiry_date?: string; credential_url?: string; description?: string }>;
  other_entries?: Array<{ title?: string; type?: string; value?: string }>;
}

function present(value?: string) {
  return value?.trim() ?? "";
}

function formatList(items: string[]) {
  return items.filter(Boolean).map((item) => `- ${item}`).join("\n");
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as CvInput;
  const workExperiences = (body.work_experiences ?? []).map((item) => [
    [present(item.title), present(item.company)].filter(Boolean).join(" hos "),
    [present(item.start_date), item.is_current ? "Nuvarande" : present(item.end_date)].filter(Boolean).join(" – "),
    [present(item.location), present(item.location_type)].filter(Boolean).join(", "),
    present(item.employment_type),
    present(item.description),
  ].filter(Boolean).join(" | ")).filter(Boolean);
  const educations = (body.educations ?? []).map((item) => [
    [present(item.degree), present(item.school)].filter(Boolean).join(", "),
    present(item.subject),
    [present(item.start_date), present(item.end_date)].filter(Boolean).join(" – "),
    present(item.description),
  ].filter(Boolean).join(" | ")).filter(Boolean);
  const certificates = (body.certificate_entries ?? []).map((item) => [
    [present(item.name), present(item.issuer)].filter(Boolean).join(", "),
    present(item.category),
    [present(item.issue_date), present(item.expiry_date)].filter(Boolean).join(" – "),
    present(item.description),
  ].filter(Boolean).join(" | ")).filter(Boolean);
  const otherMerits = (body.other_entries ?? []).map((item) => [present(item.title), present(item.value)].filter(Boolean).join(": ")).filter(Boolean);

  const facts = [
    present(body.full_name) && `Namn: ${present(body.full_name)}`,
    present(body.age) && `Ålder: ${present(body.age)} år`,
    present(body.city) && `Ort: ${present(body.city)}`,
    body.desired_roles?.length && `Söker roller inom: ${body.desired_roles.join(", ")}`,
    present(body.strengths) && `Styrkor: ${present(body.strengths)}`,
    body.languages && `Språk: ${present(body.languages)}`,
    body.employment_preferences?.length && `Tillgänglighet: ${body.employment_preferences.join(", ")}`,
    workExperiences.length && `Arbetslivserfarenhet:\n${formatList(workExperiences)}`,
    educations.length && `Utbildning:\n${formatList(educations)}`,
    certificates.length && `Certifikat, stipendier och licenser:\n${formatList(certificates)}`,
    otherMerits.length && `Övriga meriter:\n${formatList(otherMerits)}`,
  ].filter(Boolean).join("\n\n");

  if (!process.env.GROQ_API_KEY) return NextResponse.json({ cv: "" });

  const sections = [
    (present(body.city) || present(body.age) || body.desired_roles?.length || present(body.strengths)) && "PROFIL",
    workExperiences.length && "ARBETSLIVSERFARENHET",
    educations.length && "UTBILDNING",
    (certificates.length || otherMerits.length) && "CERTIFIKAT OCH MERITER",
    present(body.languages) && "SPRÅK",
    body.employment_preferences?.length && "TILLGÄNGLIGHET",
  ].filter(Boolean);

  const prompt = `Du skriver ett professionellt, lättskummat CV på svenska för en ung kandidat.

Skriv först kandidatens namn i VERSALER. Skriv därefter endast följande rubriker, i denna ordning, och bara om de finns i listan: ${sections.join(", ") || "inga rubriker"}.

För varje arbetslivserfarenhet: skriv titel och arbetsplats på en rad, datum på nästa rad och omvandla endast kandidatens egen beskrivning till 1–3 konkreta punktlistor. För utbildning: skriv utbildning, skola, datum och eventuell egen beskrivning. För profil: skriv 2–3 meningar som sammanfattar kandidatens egen ort, önskade roller och styrkor — utan generella påståenden som inte kan stödjas av fakta.

Viktiga regler:
- Använd enbart fakta i underlaget. Hitta aldrig på arbetsuppgifter, resultat, utbildning, färdigheter, datum, nivåer eller kontaktuppgifter.
- Skriv CV:t på svenska, med korrekt stavning och grammatik. 
- Skriv i jag form. 
- Du får inte heller påstå att en kandidat söker vissa specifika typer av roller, om det inte uttryckligen framgår av underlaget.
- En tom rubrik är förbjuden. Om underlag saknas ska både rubriken och innehållet utelämnas.
- Tillgänglighet får bara förekomma om den uttryckligen finns i underlaget.
- Rätta språk, struktur och upprepningar, men ändra inte innebörden.
- Håll CV:t till högst cirka 350 ord och svara enbart med CV-texten.
- Dra egna slutsatser om kandidatens styrkor, erfarenheter och utbildning baserat på fakta i underlaget och lägg till dem i CV:t, men hitta inte på nya fakta.

Kandidatens fakta:
${facts}`;

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 700,
    temperature: 0.35,
  });

  return NextResponse.json({ cv: completion.choices[0]?.message?.content?.trim() ?? "" });
}
