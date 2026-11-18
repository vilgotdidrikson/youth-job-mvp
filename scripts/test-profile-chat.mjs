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
