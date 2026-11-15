import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
function load(file, imports = {}) {
  const source = fs.readFileSync(new URL(file, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
  const module = { exports: {} };
  new Function("require", "module", "exports", compiled)(
    (name) => imports[name] ?? require(name),
    module,
    module.exports,
  );
  return module.exports;
}
const old = load("../lib/demo-data.ts");
const {
  youthJobs,
  emptyYouthFilters: filters,
  filterYouthJobs: find,
} = load("../lib/youth-demo-data.ts", { "./demo-data": old });
assert.ok(youthJobs.length >= 8);
assert.equal(new Set(youthJobs.map((j) => j.id)).size, youthJobs.length);
assert.equal(find("   ", filters, 18).length, youthJobs.length);
assert.equal(find("GRÖNA", filters, 18)[0].id, "shop");
assert.equal(find("Årsta", filters, 18)[0].id, "bakery");
assert.ok(
  find("", { ...filters, suitableAge: true }, 15).every((j) => j.minAge <= 15),
);
assert.ok(
  !find("", { ...filters, suitableAge: true }, 15).some((j) => j.id === "cafe"),
);
assert.ok(
  find("", { ...filters, suitableAge: true }, 16).some((j) => j.id === "cafe"),
);
assert.ok(
  !find("", { ...filters, suitableAge: true }, 17).some(
    (j) => j.id === "cinema",
  ),
);
assert.ok(
  find("", { ...filters, suitableAge: true }, 18).some(
    (j) => j.id === "cinema",
  ),
);
assert.deepEqual(
  find(
    "",
    {
      ...filters,
      area: "Nacka",
      schedule: "Sommar",
      category: "Barn & idrott",
    },
    16,
  ).map((j) => j.id),
  ["sports"],
);
assert.equal(find("omöjligt-sökord", filters, 18).length, 0);
assert.equal(
  find("", { ...filters, area: "Vasastan", schedule: "Sommar" }, 18).length,
  0,
);
for (const job of youthJobs) {
  assert.ok(job.question.length > 10);
  assert.ok(job.tasks.length > 0);
  assert.equal(Number(job.age.match(/\d+/)[0]), job.minAge);
}
console.log(
  "Youth demo: search, combined filters, age boundaries, empty results and all example jobs passed.",
);

const { demoProfileQuestions, buildDemoProfile, initialYouthProfile } = load(
  "../lib/youth-demo-data.ts", { "./demo-data": old },
);
assert.equal(demoProfileQuestions.length, 4);
assert.ok(demoProfileQuestions.every(question => question.options.length === 3));
const original = structuredClone(initialYouthProfile);
const answers = demoProfileQuestions.map(question => question.options[2]);
const built = buildDemoProfile(initialYouthProfile, answers);
assert.equal(built.interest, "Idrott & aktiviteter");
assert.equal(built.experience, "Jag har haft ett sommarjobb");
assert.deepEqual(built.availability, ["Sommar"]);
assert.equal(built.strengths, "Nyfiken och snabblärd");
assert.ok(built.bio.includes("idrott & aktiviteter"));
assert.ok(built.bio.includes("sommarjobb"));
assert.ok(built.bio.includes("nyfiken och snabblärd"));
assert.ok(built.bio.includes("under sommarlovet"));
assert.deepEqual(initialYouthProfile, original, "Building a profile must not change existing application snapshots");
const alternate = buildDemoProfile(initialYouthProfile, demoProfileQuestions.map(question => question.options[0]));
assert.deepEqual(alternate.availability, ["Helger"]);
assert.notEqual(alternate.bio, built.bio);
console.log("Profile assistant: four questions, three answers each, selected details, availability and immutable snapshots passed.");
