import assert from "node:assert/strict";
import { createServer } from "node:http";
import { launchAlertMessage, sendLaunchAlert } from "./launch-alert.mjs";
import { checkLaunchHttp, deploymentOrigin } from "./check-launch-http.mjs";

let release = "previous";
let redirectedRequests = 0;
const server = createServer((request, response) => {
  if (request.url === "/unexpected") redirectedRequests++;
  if (request.url === "/login" && release === "candidate") {
    response.writeHead(503, { "content-type": "text/html" });
    response.end("Test payload that must not appear in probe results");
  } else if (request.url === "/jobb") {
    response.writeHead(200, { "content-type": "text/html" });
    response.end(`<!doctype html><section data-job-previews="${release === "candidate" ? "unavailable" : "ready"}"></section>`);
  } else if (request.url === "/redirect") {
    response.writeHead(302, { location: "/unexpected" });
    response.end();
  } else if (request.url === "/wrong-type") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end("{}");
  } else {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end("<!doctype html><title>Fiktiv referensversion</title>");
  }
});
try {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const probes = { origin, routes: ["/", "/login", "/jobb"], checkJobPreviews: true };
  assert.ok((await checkLaunchHttp(probes)).every(result => result.ok));

  release = "candidate";
  const duringFailure = await checkLaunchHttp(probes);
  const failures = duringFailure.filter(result => !result.ok);
  assert.deepEqual(failures.map(({ path, status, reason }) => ({ path, status, reason })),
    [{ path: "/login", status: 503, reason: "http" }, { path: "/jobb", status: 200, reason: "job-previews" }]);
  assert.doesNotMatch(JSON.stringify(duringFailure), /Test payload/);
  const alert = launchAlertMessage("dev", failures, "ops@example.invalid");
  assert.match(alert.text, /127\.0\.0\.1:\d+\/login · HTTP 503 · http/);
  assert.doesNotMatch(alert.text, /Test payload/);
  assert.match(launchAlertMessage("dev", [], "ops@example.invalid", true).text, /planerat test/);
  await sendLaunchAlert("dev", [], { env: {} });
  await assert.rejects(sendLaunchAlert("dev", failures, { env: {} }), /Missing alert mail configuration/);
  await assert.rejects(sendLaunchAlert("dev", [], { test: true, env: {} }), /Missing alert mail configuration/);
  console.log("PASS: failed login and failed job data (HTTP 200) are detected with technical metadata only.");

  release = "previous";
  assert.ok((await checkLaunchHttp(probes)).every(result => result.ok));
  console.log("PASS: the previous release passes the same probes again after rollback.");

  const negative = await checkLaunchHttp({ origin, routes: ["/redirect", "/wrong-type"] });
  assert.deepEqual(negative.map(({ status, ok, reason }) => [status, ok, reason]), [
    [302, false, "http"], [200, false, "content-type"],
  ]);
  assert.equal(redirectedRequests, 0);
  assert.equal(deploymentOrigin("https://matchnwork-example-b2.vercel.app"),
    "https://matchnwork-example-b2.vercel.app");
  for (const url of [
    "https://youth-job-mvp-dev.vercel.app",
    "https://attacker.invalid",
    "https://matchnwork-example-b2.vercel.app/?private=value",
    "https://matchnwork-example-b2.vercel.app:444/",
  ]) assert.throws(() => deploymentOrigin(url));
  console.log("PASS: unexpected redirects, content types and unsupported deployment URLs are rejected.");
} finally {
  await new Promise(resolve => server.close(resolve));
}
