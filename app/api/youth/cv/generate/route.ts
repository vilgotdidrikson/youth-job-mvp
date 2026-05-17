import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

// Groq is OpenAI-compatible and completely free — just swap the baseURL and key.
// Get a free API key at https://console.groq.com/keys
const groq = new OpenAI({
  baseURL: "https://api.groq.com/openai/v1",
  apiKey: process.env.GROQ_API_KEY ?? "",
});

interface CvInput {
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

export async function POST(req: NextRequest) {
  const body = (await req.json()) as CvInput;

  const facts = [
    body.full_name && `Namn: ${body.full_name}`,
    body.age && `Ålder: ${body.age} år`,
    body.city && `Stad: ${body.city}`,
    body.desired_roles.length && `Önskade roller: ${body.desired_roles.join(", ")}`,
    body.strengths && `Styrkor: ${body.strengths}`,
    body.work_experience && `Tidigare erfarenhet: ${body.work_experience}`,
    body.education && `Utbildning: ${body.education}`,
    body.languages && `Språk: ${body.languages}`,
    body.employment_preferences.length &&
      `Tillgänglighet: ${body.employment_preferences.join(", ")}`,
  ]
    .filter(Boolean)
    .join("\n");

  const prompt = `Du är en erfaren CV-skrivare som hjälper unga personer att söka sina första jobb i Sverige.

Skriv ett kort, personligt och professionellt CV på svenska baserat på nedanstående fakta. 

Regler:
- Skriv i jag-form med flytande, naturlig text – inga rubriker, inga punktlistor
- Inled med namn i versaler och ålder/stad på rad två
- Dela upp texten i 3–4 korta stycken med blankrad emellan: (1) vem du är och vad du söker, (2) erfarenhet, (3) utbildning + språk, (4) tillgänglighet
- Håll det kort: max 180 ord totalt
- Låt personligheten lysa igenom – undvik generiska fraser
- Skriv ENBART CV-texten, ingen inledning eller förklaring

Fakta om kandidaten:
${facts}`;

  if (!process.env.GROQ_API_KEY) {
    // No key configured — fall back to local template
    return NextResponse.json({ cv: "" });
  }

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [{ role: "user", content: prompt }],
    max_tokens: 400,
    temperature: 0.8,
  });

  const cv = completion.choices[0]?.message?.content?.trim() ?? "";
  return NextResponse.json({ cv });
}
