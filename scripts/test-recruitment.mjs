import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const directory = mkdtempSync(resolve(".recruitment-tests-"));
try {
  const modulePath = `${directory}/recruitment-types.mjs`;
  writeFileSync(modulePath, ts.transpileModule(readFileSync("lib/recruitment-types.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText);
  const { withVerifiedExperience, experiencePeriod, needsRecruitmentReview } = await import(pathToFileURL(modulePath));
  const experience = { match_id: "hire-1", company_name: "Testföretag", role_name: "Butiksmedarbetare", start_date: "2026-10-01", show_on_profile: true, include_in_cv: true };
  const today = "2026-10-09";
  const original = "VILGOT\n\nPROFIL\nMitt eget CV med mina egna formuleringar.";
  const composed = withVerifiedExperience(original, [experience], today);
  assert.ok(composed.startsWith(original));
  assert.ok(composed.includes("Butiksmedarbetare – Testföretag"));
  assert.ok(composed.includes("arbetsgivaren via MatchnWork"));
  assert.equal(withVerifiedExperience(composed, [experience], today), composed, "Repeated exports must not duplicate the experience");
  assert.equal(withVerifiedExperience(original, [experience, experience], today), composed, "Duplicate records must not duplicate CV entries");
  assert.equal(withVerifiedExperience(composed, [], today), original, "Revoked CV sharing must remove previous composed experience");
  assert.equal(withVerifiedExperience(original, [{ ...experience, include_in_cv: false }], today), original, "Profile sharing must not imply CV sharing");
  assert.equal(withVerifiedExperience(withVerifiedExperience("", [experience], today), [], today), "", "Experience-only CV must also respect revoked sharing");
  assert.ok(experiencePeriod("2026-11-01", today).includes("Planerad start"), "A future start is not past work experience");
  assert.ok(experiencePeriod("2026-10-01", today).includes("pågående"));
  assert.equal(needsRecruitmentReview({ reported_at: today, review_state: "open" }), true);
  assert.equal(needsRecruitmentReview({ reported_at: today, review_state: "resolved" }), false);
  assert.equal(needsRecruitmentReview({ employment: { response: "pending" }, review_state: "open" }), false);
  assert.equal(needsRecruitmentReview({ employment: { response: "disputed" }, review_state: "open" }), true);
  console.log("Recruitment CV and review tests passed (14 assertions).");
} finally { rmSync(directory, { recursive: true, force: true }); }
