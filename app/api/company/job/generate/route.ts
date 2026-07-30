import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

const groq = new OpenAI({
  baseURL: "https://api.groq.com/openai/v1",
  apiKey: process.env.GROQ_API_KEY ?? "",
});

interface JobInput {
  title: string;
  industry: string;
}

function fallback(title: string, industry: string) {
  return {
    category: "Deltid",
    description: `Vi söker en engagerad person till rollen som ${title || "medarbetare"} inom ${industry || "vår verksamhet"}. Du får arbeta i ett socialt team, utvecklas i rollen och bidra till att våra kunder får en riktigt bra upplevelse.`,
    benefits: "Introduktion, Flexibla tider, Trevligt team",
    requirements: "Ansvarsfull, Social, Kan samarbeta",
  };
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as JobInput;
  const title = body.title?.trim() ?? "";
  const industry = body.industry?.trim() ?? "";

  if (!title) return NextResponse.json({ error: "Ange en jobbtitel först." }, { status: 400 });
  if (!process.env.GROQ_API_KEY) return NextResponse.json(fallback(title, industry));

  const prompt = `Du hjälper ett företag att skriva en svensk jobbannons.
Jobbtitel: ${title}
Bransch: ${industry || "Okänd"}

Svara ENDAST som giltig JSON med exakt dessa fält:
{
  "category": "en av: Deltid, Heltid, Sommarjobb, Helgjobb, Extra vid behov",
  "description": "en kort, varm och tydlig beskrivning på svenska",
  "benefits": "3-5 korta förmåner separerade med kommatecken",
  "requirements": "3-5 korta krav eller egenskaper separerade med kommatecken"
}
Hitta inte på adress, lön eller specifika företagsfakta.`;

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 500,
      temperature: 0.7,
      response_format: { type: "json_object" },
    });
    const content = completion.choices[0]?.message?.content?.trim() ?? "";
    return NextResponse.json({ ...fallback(title, industry), ...JSON.parse(content) });
  } catch {
    return NextResponse.json(fallback(title, industry));
  }
}
