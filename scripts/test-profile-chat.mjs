import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire, Module } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
Module._extensions[".ts"] = (module, file) => module._compile(ts.transpileModule(readFileSync(file, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, file);
const load = Module._load;
Module._load = function (request, parent, ...rest) {
  return load.call(this, request.startsWith("./") && parent?.filename?.includes("/lib/") && !request.endsWith(".ts") ? request + ".ts" : request, parent, ...rest);
};
const { emptyRecruitmentProfile } = require("../lib/recruitment-profile.ts");
const { renderStructuredCv } = require("../lib/structured-cv.ts");
const { hasProfileChatAnswer, profileFromChat, cvFromProfileChat, readProfileChatDraft } = require("../lib/profile-chat.ts");
Module._load = load;
const existing = emptyRecruitmentProfile();
existing.availability.days = ["sat"];
existing.preferences.roles = ["Caféarbete"];
existing.savedAnswers = [{ text: "Kan jobba söndag", question: "Helger?", savedAt: "2026-11-18", source: "fixture" }];
const answers = { roles: "Caféarbete\nCaféarbete", locations: "Bromma", languages: "Svenska – Modersmål", experience: "Planerade träningar\nHjälpte till i skolbiblioteket", education: "Gymnasium\nMusikskola" };
const draft = readProfileChatDraft(JSON.parse(JSON.stringify({ ...answers, rejected: "hemlig" })));
assert.deepEqual(draft, answers);
assert.equal(hasProfileChatAnswer("availability", existing), true);
const proposal = profileFromChat(existing, draft);
assert.deepEqual(proposal.savedAnswers, existing.savedAnswers);
assert.deepEqual(proposal.preferences.roles, ["Caféarbete"]);
assert.deepEqual(proposal.availability.days, ["sat"]);
assert.deepEqual(profileFromChat(proposal, draft), proposal);
assert.throws(() => profileFromChat(existing, { languages: "Svenska" }), /språk och nivå/);
const cv = cvFromProfileChat(draft);
assert.equal(cv.otherExperience.length, 2);
assert.equal(cv.education.length, 2);
assert.match(renderStructuredCv(cv), /Planerade träningar/);
assert.match(renderStructuredCv(cv), /Svenska.*Modersmål/);
assert.deepEqual(cvFromProfileChat(draft, cv), cv);
console.log("Profile chat: shared draft, known facts, validation and separate CV entries passed.");

// Drive the real guide callbacks with a versioned profile and separate CV persistence.
Module._extensions[".tsx"] = (module, file) => module._compile(ts.transpileModule(readFileSync(file, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText, file);
const settled = () => new Promise(resolve => setImmediate(resolve));
const state = [], refs = [], effects = new Map(), local = new Map(), versions = [], cvWrites = [];
let index = 0, pending = [], dbVersion = 3;
let dbCv = cvFromProfileChat({ experience: "Tidigare meriter" });
const owner = "qa-n19-n20";
const react = {
  useState(initial) {
    const pos = index++;
    if (!(pos in state)) state[pos] = initial;
    return [state[pos], value => { state[pos] = typeof value === "function" ? value(state[pos]) : value; }];
  },
  useRef(initial) { const pos = index++; return refs[pos] ??= { current: initial }; },
  useEffect(run, dependencies) {
    const pos = index++;
    if (!effects.has(pos)) { effects.set(pos, dependencies); pending.push(run); }
  },
};
const jsx = (type, props) => ({ type, props });
const database = {
  auth: { getUser: async () => ({ data: { user: { id: owner } } }) },
  from: () => ({
    update: () => {
      let expected;
      const query = {
        eq(key, value) { if (key === "recruitment_profile_version") expected = value; return query; },
        select: () => query, abortSignal: () => query,
        async maybeSingle() {
          versions.push(expected);
          return { data: expected === dbVersion ? { user_id: owner, recruitment_profile_version: ++dbVersion } : null };
        },
      };
      return query;
    },
  }),
};
globalThis.window = { localStorage: { getItem: key => local.get(key) ?? null, setItem: (key, value) => local.set(key, value) } };
Module._load = function (name, parent, ...rest) {
  if (name === "react") return react;
  if (name === "react/jsx-runtime") return { jsx, jsxs: jsx, Fragment: "fragment" };
  if (name === "next/link") return "Link";
  if (name === "./cv-fact-review") return { CvFactReview: "CvFactReview" };
  if (name.endsWith(".css")) return {};
  if (name === "@/lib/onboarding") return { getYouthProfile: async () => ({ cv_structured: dbCv, full_name: "QA" }) };
  if (name === "@/lib/supabase") return { getSupabaseClient: () => database };
  if (name === "@/lib/cv-save-workflow") return { createCvSave: (_owner, input) => ({ async save() {
    cvWrites.push(input);
    dbCv = input.structured;
  } }) };
  if (name.startsWith("@/lib/")) return require("../" + name.slice(2) + ".ts");
  return load.call(this, name.startsWith("./") && parent?.filename?.includes("/lib/") && !name.endsWith(".ts") ? name + ".ts" : name, parent, ...rest);
};
const nodes = value => Array.isArray(value) ? value.flatMap(nodes) : value?.props ? [value, ...nodes(value.props.children)] : [];
const find = (view, predicate) => { const node = nodes(view).find(predicate); assert.ok(node); return node.props; };
const button = (view, label) => find(view, node => node.type === "button" && node.props.children === label);
const approveProfile = view => find(view, node => node.type === "input" && node.props.type === "checkbox").onChange({ target: { checked: true } });
const field = (view, key, value) => find(view, node => node.props.id === "profile-chat-" + key).onChange({ target: { value } });
const review = view => find(view, node => node.type === "CvFactReview");
try {
  const { ProfileChat } = require("../components/profile-chat.tsx");
  const { setCvItemIncluded } = require("../lib/structured-cv.ts");
  const props = { owner, initialMode: "form", profile: existing, version: 3 };
  const render = () => { index = 0; const result = ProfileChat(props); pending.splice(0).forEach(run => run()); return result; };
  render();
  await settled();
  button(render(), "Granska utkastet").onClick();
  assert.equal(review(render()).cv.otherExperience[0].title, "Tidigare meriter", "can review an unchanged existing CV");
  button(render(), "Ändra svaren").onClick();
  field(render(), "motivation", "Vill hjälpa kunder");
  field(render(), "experience", "Original från utkast");
  button(render(), "Granska utkastet").onClick();
  approveProfile(render());
  const save = button(render(), "Spara jobbprofil").onClick;
  save(); save();
  await settled();
  assert.deepEqual(versions, [3]);
  assert.equal(cvWrites.length, 0, "profile approval does not save a CV");
  button(render(), "Ändra svaren").onClick();
  field(render(), "motivation", "Vill arbeta med service");
  button(render(), "Granska utkastet").onClick();
  assert.equal(button(render(), "Spara jobbprofil").disabled, true);
  approveProfile(render());
  button(render(), "Spara jobbprofil").onClick();
  await settled();
  assert.deepEqual(versions, [3, 4], "next review saves against the acknowledged version");
  const draftCv = review(render()).cv;
  const corrected = setCvItemIncluded({ ...draftCv, otherExperience: [draftCv.otherExperience[0], { ...draftCv.otherExperience[1], title: "Rättad uppgift" }] }, "otherExperience", 0, false);
  review(render()).onChange(corrected);
  button(render(), "Ändra svaren").onClick();
  field(render(), "motivation", "Vill lära mig mer");
  button(render(), "Granska utkastet").onClick();
  assert.match(review(render()).text, /Rättad uppgift/);
  assert.doesNotMatch(review(render()).text, /Tidigare meriter/);
  review(render()).onApprove(true);
  button(render(), "Spara CV").onClick();
  await settled();
  assert.equal(cvWrites.length, 1);
  assert.equal(cvWrites[0].structured.otherExperience.length, 2, "hidden CV facts stay in the profile");
  assert.doesNotMatch(review(render()).text, /Original från utkast/);
  assert.equal(button(render(), "Spara jobbprofil").disabled, true, "a CV approval cannot approve the profile");
  // Simulate a later visit loading the saved CV and the device-local draft.
  state.length = 0; refs.length = 0; effects.clear();
  render();
  await settled();
  button(render(), "Granska utkastet").onClick();
  assert.doesNotMatch(review(render()).text, /Original från utkast/);
  assert.equal(button(render(), "Spara CV").disabled, true);
  console.log("Profile chat UI: review existing selection, repeat versioned save, independent approvals and no restored duplicate passed (simulated persistence).");
} finally {
  Module._load = load;
  delete globalThis.window;
}
