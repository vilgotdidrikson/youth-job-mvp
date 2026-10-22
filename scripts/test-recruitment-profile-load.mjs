import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";
import ts from "typescript";

const dir = mkdtempSync(resolve(".profile-load-tests-"));
try {
  for (const name of ["job-categories", "recruitment-profile", "recruitment-profile-loader"]) {
    const compiled = ts.transpileModule(readFileSync(`lib/${name}.ts`, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    }).outputText.replace('"./recruitment-profile"', '"./recruitment-profile.mjs"').replace('"./job-categories"', '"./job-categories.mjs"');
    writeFileSync(`${dir}/${name}.mjs`, compiled);
  }
  const { loadRecruitmentProfile } = await import(pathToFileURL(`${dir}/recruitment-profile-loader.mjs`));
  const { emptyRecruitmentProfile } = await import(pathToFileURL(`${dir}/recruitment-profile.mjs`));
  const supportedColumns = new Set(["recruitment_profile", "recruitment_profile_version", "languages", "certificates", "employment_preferences", "strengths", "cv_structured"]);
  const profile = emptyRecruitmentProfile();
  profile.availability.days = ["sat"];
  profile.examples = [{ strength: "teamwork", context: "QA förening", action: "Hjälpte till tillsammans med andra." }];
  const row = { recruitment_profile: profile, recruitment_profile_version: 4, languages: ["Svenska flytande"], certificates: "HLR", employment_preferences: ["Helgjobb"], strengths: ["Service"], cv_structured: { skills: ["Servering"] } };
  let responseMode = "ok";
  const requests = [];
  const client = createClient("https://qa.invalid", "synthetic-qa-key", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (input, init) => {
      const url = new URL(input);
      requests.push(url);
      assert.equal(url.pathname, "/rest/v1/youth_profiles");
      assert.equal(url.searchParams.get("user_id"), "eq.qa-youth");
      const selected = url.searchParams.get("select").split(",");
      // Reproduce staging's schema: selecting the old working_time column
      // fails the complete request, not just the optional CV facts.
      if (selected.some(column => !supportedColumns.has(column))) {
        return new Response(JSON.stringify({ code: "42703", message: "column does not exist" }), { status: 400 });
      }
      assert.ok(init.signal, "The profile request must have a cancellation/timeout signal");
      if (responseMode === "network") throw new TypeError("Failed to fetch");
      if (responseMode === "missing") return new Response(JSON.stringify({ code: "PGRST116", message: "No rows" }), { status: 406 });
      if (responseMode === "denied") return new Response(JSON.stringify({ code: "42501", message: "Permission denied" }), { status: 403 });
      if (responseMode === "temporary") return new Response(JSON.stringify({ message: "Temporary outage" }), { status: 503 });
      return new Response(JSON.stringify(row), { status: 200, headers: { "content-type": "application/json" } });
    } },
  });
  const load = () => loadRecruitmentProfile(client, "qa-youth", AbortSignal.timeout(1000));
  const loaded = await load();
  assert.deepEqual(loaded.profile, profile, "Saved sections must survive loading");
  assert.equal(loaded.version, 4);
  assert.ok(loaded.cvFacts.includes("Svenska flytande"));
  assert.ok(loaded.cvFacts.includes("HLR"));
  assert.ok(loaded.cvFacts.includes("Servering"));
  assert.ok(!loaded.cvFacts.includes('"skills"'),"CV summary must be readable text, not JSON");
  row.cv_structured={skills:[{name:"Service",sourceNotes:["old secret"]}],languages:[{name:"Svenska",level:"Grundläggande",evidence:"old evidence"}]};
  const current=await load();
  assert.ok(current.cvFacts.includes('Grundläggande'));
  assert.ok(!current.cvFacts.includes('flytande'),"Structured CV takes precedence over legacy summaries");
  assert.ok(!current.cvFacts.includes('secret')&&!current.cvFacts.includes('evidence'));
  assert.deepEqual(current.cvLanguages,[{language:'Svenska',level:'Grundläggande'}]);
  assert.ok(current.cvFacts.split('\n').length>1,'Readable facts need real line breaks');
  for (const mode of ["temporary", "network", "missing", "denied"]) {
    responseMode = mode;
    await assert.rejects(load, /Profiluppgifterna kunde inte hämtas/);
  }
  responseMode = "ok";
  assert.deepEqual((await load()).profile, profile, "Retry after an outage must load the saved profile");
  assert.ok(requests.length >= 6, "SDK retries may add transport attempts");
  console.log("PASS: real Supabase client request, staging schema regression, ownership filter, saved sections, version, CV facts, outages, denied/missing rows and successful retry.");
} finally {
  rmSync(dir, { recursive: true, force: true });
}
