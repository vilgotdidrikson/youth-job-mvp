import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const jobId = "11111111-1111-4111-8111-111111111111";
const youthId = "22222222-2222-4222-8222-222222222222";
const path = youthId + "/synthetic.pdf";
const packet = { revision: 12, cv: { documents: [{ type: "cv", url: path }] } };
const oldEnv = process.env;
process.env = { ...oldEnv, NEXT_PUBLIC_SUPABASE_URL: "https://fixture.invalid", NEXT_PUBLIC_SUPABASE_ANON_KEY: "public-fixture", SUPABASE_SERVICE_ROLE_KEY: "server-fixture" };
let reads = [], downloads = [];
let file = new Blob(["%PDF-1.4\nQA test"]);
let allowed = true;
const dependencies = {
  "@supabase/supabase-js": {
    createClient(_url, key) {
      if (key === "public-fixture") return { async rpc(name, args) {
        assert.equal(name, "get_application_disclosure");
        assert.deepEqual(args, { p_job_id: jobId, p_youth_user_id: youthId });
        return { data: reads.shift() ?? null, error: null };
      } };
      assert.equal(key, "server-fixture");
      return { storage: { from(bucket) {
        assert.equal(bucket, "youth-documents");
        return { async download(path) { downloads.push(path); return { data: file, error: null }; } };
      } } };
    },
  },
  "next/server": { NextResponse: Response },
  "@/lib/api-auth": { async requireApiUser() { return allowed ? { token: "fictional-token" } : { response: new Response(null, { status: 401 }) }; } },
  "@/lib/application-disclosure": { disclosedCvText: () => "Fiktiv CV-text" },
};
function compile(path) {
  const { outputText } = ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } });
  const compiled = { exports: {} };
  new Function("require", "module", "exports", outputText)(name => dependencies[name] ?? require(name), compiled, compiled.exports);
  return compiled.exports;
}
try {
  dependencies["@/lib/cv-document-path"] = compile("lib/cv-document-path.ts");
  const { POST } = compile("app/api/company/candidate-cv/route.ts");
  const req = () => new Request("https://fixture.invalid/api/company/candidate-cv", {
    method: "POST", body: JSON.stringify({ jobId, youthUserId: youthId, path: "foreign-file.pdf" }),
  });
  allowed = false;
  assert.equal((await POST(req())).status, 401);
  allowed = true;
  assert.equal((await POST(req())).status, 403);
  assert.equal(downloads.length, 0, "No service read without applicant disclosure");
  for (const updated of [null, { ...packet, revision: 13 }, { ...packet, cv: { documents: [] } }]) {
    reads = [packet, updated];
    assert.equal((await POST(req())).status, 403, "Revocation or correction during load must win");
  }
  reads = [packet, packet];
  downloads = [];
  const pdf = await POST(req());
  assert.equal(pdf.status, 200);
  assert.equal(pdf.headers.get("content-type"), "application/pdf");
  assert.equal(pdf.headers.get("vercel-cdn-cache-control"), "no-store");
  assert.match(await pdf.text(), /^%PDF-/);
  assert.deepEqual(downloads, [path], "Stored path only");
  reads = [packet];
  file = new Blob(["not a PDF"]);
  assert.equal((await POST(req())).status, 404);
  reads = [{ cv: { documents: [] } }];
  assert.deepEqual(await (await POST(req())).json(), { kind: "text", text: "Fiktiv CV-text" });
  console.log("PASS: candidate CV proxy denies unauthorized and stale reads, returns uncached PDF bytes, and preserves text CV.");
} finally {
  process.env = oldEnv;
}
