import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire, Module } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
Module._extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(readFileSync(filename, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
const { structuredCvFromForm, renderStructuredCv } = require("../lib/structured-cv.ts");
const { guardCvPrecision, cvReviewSnapshot, hasApprovedCv, cvFactFields, updateCvFact, cvSourceText } = require("../lib/cv-fact-review.ts");

const source = structuredCvFromForm({ full_name: "Alex QA F02", work_experience: "Jag praktiserade på Testbutiken våren 2026 och fyllde på varor.", languages: "Svenska flytande, Engelska grundläggande" });
const proposal = structuredClone(source);
Object.assign(proposal.workExperience[0], { employer: "Testbutiken", role: "Butikschef", startDate: "2026-03", endDate: "2026-05", duration: "våren 2026" });
proposal.languages = [{ name: "Svenska", level: "Modersmål", abilities: [], evidence: "Svenska flytande" }, { name: "Engelska", level: "Flytande", abilities: [], evidence: "Engelska grundläggande" }];
const guarded = guardCvPrecision(proposal, source);
assert.equal(guarded.workExperience[0].startDate, "");
assert.equal(guarded.workExperience[0].endDate, "");
assert.equal(guarded.workExperience[0].duration, "våren 2026");
assert.equal(guarded.languages[0].level, undefined);
assert.equal(guarded.languages[1].level, undefined);
assert.equal(proposal.workExperience[0].startDate, "2026-03", "Guard never mutates proposal/source");

const supported = structuredClone(proposal);
supported.languages[0].level = "Flytande";
supported.languages[1].level = "Grundläggande";
assert.equal(guardCvPrecision(supported, source).languages[0].level, "Flytande");
assert.equal(guardCvPrecision(supported, source).languages[1].level, "Grundläggande");
assert.equal(guardCvPrecision(proposal, source, [{ question: "Är svenska ditt modersmål?", answer: "Nej" }]).languages[0].level, undefined, "Interviewer question is not evidence");
assert.equal(guardCvPrecision(proposal, structuredCvFromForm({ languages: "Svenska är inte mitt modersmål" })).languages[0].level, undefined);
const datedSource = structuredCvFromForm({ work_experiences: [{ company: "Test", title: "Praktikant", start_date: "2026-03", end_date: "2026-05" }], languages: "Svenska modersmål" });
assert.equal(guardCvPrecision(proposal, datedSource).workExperience[0].startDate, "2026-03");
assert.equal(guardCvPrecision(proposal, datedSource).languages[0].level, "Modersmål");

const text = renderStructuredCv(guarded);
assert(!hasApprovedCv(null, text, guarded), "AI proposal cannot be saved before approval, including invented role");
const approval = cvReviewSnapshot(text, guarded);
assert(hasApprovedCv(approval, text, guarded));
assert(!hasApprovedCv(approval, text + " rättat", guarded), "Text edit invalidates approval");
const corrected = updateCvFact(guarded, ["workExperience", "0", "role"], "Praktikant");
assert(!hasApprovedCv(approval, text, corrected), "Hidden profile-field edit invalidates approval");
assert.equal(corrected.workExperience[0].role, "Praktikant");
assert.equal(guarded.workExperience[0].role, "Butikschef");
assert(!hasApprovedCv(approval, "", guarded));
const fields = cvFactFields(guarded);
assert(fields.some((field) => field.label.includes("Roll") && field.value === "Butikschef"));
assert(fields.some((field) => field.path.join(".") === "workExperience.0.startDate"));
assert(!fields.some((field) => field.path.includes("sourceNotes")));
assert(cvSourceText(source).includes("våren 2026") && cvSourceText(source).includes("Svenska flytande"));

// Exercise the actual writer with a schema-valid hostile model response, no paid API.
let responseBody;
const originalLoad = Module._load;
Module._load = function(request, ...args) {
  if (request === "openai") return { __esModule: true, default: class {
    responses = { create: async (input) => {
      assert(input.instructions.includes("våren 2026") && input.instructions.includes("Modersmål"));
      return { status: "completed", output_text: JSON.stringify(responseBody) };
    } };
  } };
  return originalLoad.call(this, request, ...args);
};
const { writeCv, CV_WRITING_SCHEMA } = require("../lib/cv-generation.ts");
const empty = (schema) => schema.type === "string" ? "" : schema.type === "array" ? [] : Object.fromEntries(Object.entries(schema.properties).map(([key, child]) => [key, empty(child)]));
responseBody = empty(CV_WRITING_SCHEMA);
responseBody.summary = "Erfaren praktikant.";
responseBody.workExperience = [{ ...empty(CV_WRITING_SCHEMA.properties.workExperience.items), employer: "Testbutiken", role: "Butikschef", startDate: "2026-03", endDate: "2026-05", duration: "våren 2026" }];
responseBody.languages = [{ ...empty(CV_WRITING_SCHEMA.properties.languages.items), name: "Svenska", level: "Modersmål" }];
const written = await writeCv(source, AbortSignal.timeout(1000));
assert.equal(written.workExperience[0].startDate, "");
assert.equal(written.languages[0].level, undefined);
assert(!hasApprovedCv(null, renderStructuredCv(written), written));
Module._load = originalLoad;

for (const path of ["components/youth-cv-hub.tsx", "components/youth-onboarding-flow.tsx"]) {
  const code = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  assert(code.includes("<CvFactReview"), `${path}: explicit facts review must be visible`);
  assert(code.includes("hasApprovedCv"), `${path}: approval must cover text and structured facts`);
  assert(/if \(!cvFactsApproved\)|if \(!factsApproved/.test(code), `${path}: save handler itself must refuse unapproved data`);
}
console.log("PASS F02: approximate dates, explicit dates, per-language levels, negative answers, question isolation, writer guard, complete fact review, immutable corrections and exact-version approval");
