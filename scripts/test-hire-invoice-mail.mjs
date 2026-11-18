import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createServer } from "node:net";
import { createRequire } from "node:module";
import nodemailer from "nodemailer";
import ts from "typescript";

const require = createRequire(import.meta.url);
function load(path, aliases = {}) {
  const code = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const mod = { exports: {} };
  new Function("module", "exports", "require", code)(mod, mod.exports, name => aliases[name] ?? require(name));
  return mod.exports;
}
const { processHireInvoiceMail } = load("lib/hire-invoice-mail.tsx", {
  "@/lib/hire-test-invoice-pdf": load("lib/hire-test-invoice-pdf.tsx"),
  "@/lib/product-copy": load("lib/product-copy.ts", { "./company-navigation": load("lib/company-navigation.ts") }),
});

const recipient = "billing@example.invalid";
const invoice = {
  id: "00000000-0000-4000-a000-000000000001",
  amount_ore: 50000, buyer_name: "Testbolaget", address_line1: "Testvägen 1", address_line2: null,
  postal_code: "11111", city: "Testort", issued_on: "2026-11-18", due_on: "2026-12-18",
};
const job = { recipient, invoice, lease: "00000000-0000-4000-a000-000000000002" };
function fixture({ ready = true, claimed = job, completion = true, scope = "hire_test" } = {}) {
  const logs = [];
  return {
    logs,
    async rpc(name, args) {
      logs.push([name, args]);
      if (name === `claim_${scope}_invoice_mail`) return { data: claimed };
      if (name === `${scope}_invoice_mail_ready`) return { data: ready };
      if (name === `finish_${scope}_invoice_mail`) return { data: completion };
      throw Error("Unexpected RPC");
    },
  };
}

const envelope = [];
let payload = "";
const server = createServer(socket => {
  let buffered = "", receiving = false;
  socket.setEncoding("utf8");
  socket.write("220 local.example.invalid ESMTP\r\n");
  socket.on("data", chunk => {
    buffered += chunk;
    let index;
    while ((index = buffered.indexOf("\r\n")) !== -1) {
      const line = buffered.slice(0, index);
      buffered = buffered.slice(index + 2);
      if (receiving && line !== ".") { payload += line + "\n"; continue; }
      if (receiving) { receiving = false; socket.write("250 accepted\r\n"); }
      else if (line.startsWith("EHLO")) socket.write("250 local.example.invalid\r\n");
      else if (line.startsWith("MAIL FROM:") || line.startsWith("RCPT TO:")) {
        envelope.push(line);
        socket.write("250 OK\r\n");
      } else if (line === "DATA") { receiving = true; socket.write("354 End with dot\r\n"); }
      else if (line === "QUIT") socket.end("221 Bye\r\n");
      else socket.write("500 Unexpected command\r\n");
    }
  });
});

await new Promise((resolve, reject) => { server.once("error", reject); server.listen(0, "127.0.0.1", resolve); });
try {
  const smtp = nodemailer.createTransport({
    host: "127.0.0.1", port: server.address().port, ignoreTLS: true,
    connectionTimeout: 3000, socketTimeout: 3000,
  });
  const db = fixture();
  assert.equal(await processHireInvoiceMail(db, recipient, message => smtp.sendMail(message)), "sent");
  assert.deepEqual(envelope, ["MAIL FROM:<info@matchnwork.se>", "RCPT TO:<billing@example.invalid>"]);
  assert.match(payload, /^From: MatchnWork <info@matchnwork.se>/m);
  assert.match(payload, /^To: billing@example.invalid/m);
  assert.match(payload.replace(/\n[ \t]/g, " "), /^Message-ID: <hire-invoice-00000000-0000-4000-a000-000000000001@matchnwork\.se>/m);
  const attachment = payload.match(/Content-Type: application\/pdf;[\s\S]+?\n\n([\w+/=\n]+?)\n--/);
  assert.equal(Buffer.from(attachment?.[1] ?? "", "base64").subarray(0, 5).toString(), "%PDF-");
  assert.equal(db.logs.at(-1)[1].p_outcome, "sent");
} finally {
  await new Promise(resolve => server.close(resolve));
}

const mustNotSend = async () => assert.fail("Unexpected external send");
assert.equal(await processHireInvoiceMail(fixture({ claimed: null }), recipient, mustNotSend), "idle");
assert.equal(await processHireInvoiceMail(fixture({ claimed: { ...job, recipient: "other@example.invalid" } }), recipient, mustNotSend), "review");
assert.equal(await processHireInvoiceMail(fixture({ ready: false }), recipient, mustNotSend), "cancelled");
assert.equal(await processHireInvoiceMail(fixture(), recipient, async () => { throw Object.assign(Error("SMTP temporary rejection"), { responseCode: 451 }); }), "retry");
assert.equal(await processHireInvoiceMail(fixture(), recipient, async () => { throw Object.assign(Error("SMTP permanent rejection"), { responseCode: 550 }); }), "review");
assert.equal(await processHireInvoiceMail(fixture(), recipient, async () => { throw Error("Connection lost"); }), "review");
assert.equal(await processHireInvoiceMail(fixture(), recipient, async () => ({ accepted: [] })), "review");
await assert.rejects(processHireInvoiceMail(fixture({ completion: false }), recipient, async () => ({ accepted: [recipient] })), /record invoice email/);
const bankJob = { ...job, invoice: { ...invoice, invoice_number: "MNW-000001", buyer_org: "559000-0000",
  seller: { name: "Fiktivt övningsföretag", address: "Testgatan 1", reference: "Testreferens", bankgiro: "1234567" } } };
const liveFixture = fixture({ scope: "hire_bank", claimed: bankJob });
assert.equal(await processHireInvoiceMail(liveFixture, null, async message => {
  assert.match(message.subject, /^Faktura MNW-000001/);
  assert.equal(message.attachments[0].filename, "MNW-000001.pdf");
  assert.equal(message.attachments[0].content.subarray(0, 5).toString(), "%PDF-");
  return { accepted: [recipient] };
}), "sent");
assert.equal(await processHireInvoiceMail(fixture({ claimed: bankJob }), recipient, mustNotSend), "review");
assert.equal(await processHireInvoiceMail(fixture({ scope: "hire_bank" }), null, mustNotSend), "review");
console.log("PASS: real local SMTP envelope and PDF attachment, holds/recipient guard, known retry and uncertain-delivery handling.");
