import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const instructions = [
  "Du håller ett varmt, naturligt svenskt röstsamtal för att skapa ett CV. Du leder intervjun hela vägen och tappar aldrig bort vilka områden som återstår.",
  "Samtala fritt, lyssna och ställ en kort naturlig följdfråga åt gången när svaret saknar viktig CV-information. Gå vidare när området har tillräckligt med information.",
  "Du ska behandla exakt fem områden: egenskaper, språk, tidigare jobb eller hjälp, utbildning, samt certifikat/stipendier/licenser.",
  "När användaren berättar om ett jobb eller en roll, följ upp naturligt om det saknas: arbetsuppgifter, ungefärlig period eller hur länge arbetet pågick. Fråga inte om sådant som användaren redan har berättat.",
  "För egenskaper, be om ett kort exempel om egenskapen annars blir otydlig. För språk, fråga om nivå bara om den saknas. För utbildning, fråga om inriktning eller pågående/avslutad bara om det saknas.",
  "Fråga aldrig om namn, födelsedatum, adress, stad, intressen, önskade roller, tillgänglighet eller andra tillägg.",
  "Ett område är behandlat först när användaren har fått frågan och svarat, även om svaret är att erfarenhet eller ett certifikat saknas. Sammanfatta inte mellan frågorna.",
  "Fortsätt samtalet tills alla fem områden har behandlats. Anropa aldrig finish_cv_interview automatiskt och anropa det aldrig under den första modellen av samtalet.",
  "Anropa finish_cv_interview endast när användaren uttryckligen vill slutföra och alla fem områden har behandlats. Skicka med ett icke-tomt svar för varje område och endast användarens fakta. Säg inte avslutningsfrasen före anropet; appen validerar först.",
  "Om användaren vill avsluta för tidigt, förklara kort vilket område som återstår och ställ sedan just den frågan.",
  "När intervjun är klar, berätta att personen kan lägga till något extra efter intervjun om den vill.",
  "Hitta aldrig på fakta.",
  "Prata naturligt och kort, utan att läsa upp listor eller kalla det formulär.",
].join(" ");

const session = {
  type: "realtime",
  model: process.env.OPENAI_REALTIME_MODEL ?? "gpt-realtime",
  output_modalities: ["audio"],
  instructions,
  max_output_tokens: 192,
  audio: {
    input: {
      noise_reduction: { type: "near_field" },
      turn_detection: { type: "semantic_vad", eagerness: "low", create_response: false, interrupt_response: false },
    },
    output: { voice: "marin", speed: 1.04 },
  },
  tools: [{
    type: "function",
    name: "finish_cv_interview",
    description: "Call only after the user explicitly asks to finish and has answered questions about every area. Provide a non-empty user-provided answer for every area.",
    parameters: {
      type: "object",
      properties: {
        strengths: { type: "string" }, languages: { type: "string" }, work_experience: { type: "string" }, education: { type: "string" }, certificates: { type: "string" },
      },
      additionalProperties: false,
    },
  }],
};

export async function POST(request: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "OPENAI_API_KEY saknas på servern." }, { status: 503 });
  const sdp = await request.text();
  if (!sdp.trim()) return NextResponse.json({ error: "Kunde inte starta röstsamtalet." }, { status: 400 });

  const formData = new FormData();
  // OpenAI expects the SDP as a multipart text field. Sending it as a File/Blob
  // makes the field invisible to the Realtime calls endpoint.
  formData.set("sdp", sdp);
  formData.set("session", JSON.stringify(session));
  try {
    const response = await fetch("https://api.openai.com/v1/realtime/calls", { method: "POST", headers: { Authorization: `Bearer ${apiKey}` }, body: formData });
    const answer = await response.text();
    if (!response.ok) {
      console.error("OpenAI Realtime session failed.", response.status, answer);
      return NextResponse.json({ error: "Kunde inte ansluta röstsamtalet." }, { status: 502 });
    }
    return new NextResponse(answer, { headers: { "Content-Type": "application/sdp" } });
  } catch (error) {
    console.error("OpenAI Realtime session failed.", error);
    return NextResponse.json({ error: "Rösttjänsten kunde inte nås." }, { status: 502 });
  }
}
