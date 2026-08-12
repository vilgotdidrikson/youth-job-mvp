import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

async function post(form) {
  const response = await fetch("http://localhost:3000/api/voice/turn", { method: "POST", body: form });
  const result = await response.json();
  if (!response.ok) throw new Error(`Voice API failed (${response.status}): ${result.error ?? "unknown error"}`);
  return result;
}

const initialCv = {
  personalInfo: { name: "Testperson", city: "Teststad" },
  profile: { strengths: [], traits: [], interests: [], targetRoles: [], differentiators: [], sourceNotes: [] },
  workExperience: [], education: [], projects: [], skills: [], certifications: [], languages: [], otherExperience: [],
};
const startForm = new FormData();
startForm.set("start", "true");
startForm.set("structuredCv", JSON.stringify(initialCv));
let turn = await post(startForm);
if (turn.state.currentArea !== "profile" || turn.state.askedQuestionIds.length !== 1) throw new Error("Voice interview did not start with strengths.");
console.log(`voice-interview: started with ${turn.nextQuestion}`);

const audioPath = process.env.VOICE_TEST_AUDIO ?? join(tmpdir(), "voice-depth-test.mp3");
const audio = await readFile(audioPath);
const answerForm = new FormData();
answerForm.set("audio", new Blob([audio], { type: "audio/mpeg" }), "answer.mp3");
answerForm.set("state", JSON.stringify(turn.state));
turn = await post(answerForm);
const sourceNotes = turn.structured.profile.sourceNotes ?? [];
if (!sourceNotes.includes(turn.transcript)) throw new Error("The exact transcript was not retained as evidence.");
if (new Set(turn.state.askedQuestionIds).size !== turn.state.askedQuestionIds.length) throw new Error("A question ID was repeated.");
if (!turn.nextQuestion || turn.state.askedQuestionIds.length < 2) throw new Error("Missing information did not produce a follow-up or next-area question.");
console.log(`voice-interview: evidence retained; next area ${turn.state.currentArea}`);

let safety = 0;
while (!turn.complete && safety < 15) {
  const skipForm = new FormData();
  skipForm.set("skip", "true");
  skipForm.set("state", JSON.stringify(turn.state));
  turn = await post(skipForm);
  safety += 1;
  console.log(`voice-interview: advanced to ${turn.state.currentArea} (${safety})`);
}
if (!turn.complete) throw new Error("Voice interview did not complete all areas.");
if (new Set(turn.state.askedQuestionIds).size !== turn.state.askedQuestionIds.length) throw new Error("Question IDs were repeated across the interview.");
if (!/lägga till något extra efter intervjun/i.test(turn.nextQuestion)) throw new Error("Completion did not explain that extras can be added after the interview.");
if (/tyska/i.test(JSON.stringify(turn.structured)) && !/tyska/i.test(sourceNotes.join(" "))) throw new Error("An unsupported language was added.");
console.log(`voice-interview: completed, ${turn.state.askedQuestionIds.length} unique questions, evidence retained, no unsupported German`);