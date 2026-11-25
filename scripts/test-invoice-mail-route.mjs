import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";

// Run the actual route. No database or external SMTP connection is made.
const require = createRequire(import.meta.url);
const envNames = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "MNW_INVOICE_SMTP_PASSWORD"];
const saved = Object.fromEntries(envNames.map(name => [name, process.env[name]]));
const secret = "QA_PRIVATE_SMTP_OR_DATABASE_DETAIL";
let state;
const reset = () => {
  Object.assign(process.env, { NEXT_PUBLIC_SUPABASE_URL: "https://qa.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "qa", MNW_INVOICE_SMTP_PASSWORD: "qa" });
  state = { dev: true, scope: "billing@example.invalid", rpcThrows: false, smtpThrows: false, processThrows: false, calls: 0, transports: 0 };
};
const aliases = {
  "@supabase/supabase-js": { createClient: () => ({ rpc: async () => {
    state.calls++;
    if (state.rpcThrows) throw Error(secret);
    return { data: state.scope, error: null };
  } }) },
  "nodemailer": { createTransport: () => {
    state.transports++;
    if (state.smtpThrows) throw Error(secret);
    return { sendMail: async () => ({ accepted: [] }) };
  } },
  "@/lib/hire-invoice-mail": { processHireInvoiceMail: async () => {
    if (state.processThrows) throw Error(secret);
    return "idle";
  } },
  "@/lib/product-copy": { CONTACT_EMAIL: "info@matchnwork.se" },
  "@/lib/invoice-pilot": { isInvoicePilotDev: () => state.dev },
};
const code = ts.transpileModule(readFileSync("app/api/internal/hire-invoice-mail/route.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;
const mod = { exports: {} };
new Function("module", "exports", "require", code)(mod, mod.exports, name => aliases[name] ?? require(name));
const request = (token = "a".repeat(64), host = "dev.example.invalid") => new Request(`https://${host}/api/internal/hire-invoice-mail`, {
  method: "POST", headers: { authorization: `Bearer ${token}` },
});
async function check(status, req = request()) {
  const response = await mod.exports.POST(req);
  assert.equal(response.status, status);
  assert.ok(!(await response.text()).includes(secret));
}
try {
  reset(); await check(401, request("invalid")); assert.equal(state.calls, 0);
  reset(); delete process.env.MNW_INVOICE_SMTP_PASSWORD; await check(503); assert.equal(state.calls, 0);
  reset(); state.dev = false; await check(404); assert.equal(state.calls, 0);
  reset(); state.scope = false; await check(401); assert.equal(state.transports, 0);
  reset(); state.scope = "injected@example.invalid,other@example.invalid"; await check(401); assert.equal(state.transports, 0);
  reset(); await check(200);
  reset(); state.dev = false; state.scope = true; await check(200, request("a".repeat(64), "matchnwork.se"));
  for (const key of ["rpcThrows", "smtpThrows", "processThrows"]) {
    reset(); state[key] = true; await check(503);
  }
  console.log("PASS invoice mail route: auth, configuration, environment, recipient and private transport failure responses (10 cases). No external delivery.");
} finally {
  for (const name of envNames) {
    if (saved[name] === undefined) delete process.env[name]; else process.env[name] = saved[name];
  }
}
