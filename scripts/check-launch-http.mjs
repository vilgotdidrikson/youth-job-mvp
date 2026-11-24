import { pathToFileURL } from "node:url";

export const launchTargets = {
  dev: {
    origin: "https://youth-job-mvp-dev.vercel.app",
    routes: ["/", "/login", "/help", "/privacy", "/reset-password"],
  },
  production: {
    origin: "https://matchnwork.se",
    routes: ["/"],
    redirectOrigin: "https://www.matchnwork.se",
  },
};

const reviewRoutes = [...launchTargets.dev.routes, "/features", "/pricing", "/jobb"];

export async function checkLaunchHttp({ origin, routes, redirectOrigin, checkJobPreviews = false }, { timeoutMs = 12_000 } = {}) {
  const probes = routes.map(path => ({ path, from: origin }));
  if (redirectOrigin) probes.push({ path: "/", from: redirectOrigin });

  return Promise.all(probes.map(async ({ from, path }) => {
    const url = new URL(path, from);
    const canonical = new URL(path, origin);
    const signal = AbortSignal.timeout(timeoutMs);
    let status = null;
    try {
      let response = await fetch(url, { signal, redirect: "manual" });
      status = response.status;
      if (from !== origin) {
        const location = response.headers.get("location");
        await response.body?.cancel();
        if (![301, 302, 303, 307, 308].includes(status) || !location
          || new URL(location, url).href !== canonical.href) {
          return { path, host: url.host, status, ok: false, reason: "redirect" };
        }
        response = await fetch(canonical, { signal, redirect: "manual" });
        status = response.status;
      }
      const html = (response.headers.get("content-type") ?? "").toLowerCase().startsWith("text/html");
      let reason = status !== 200 ? "http" : !html ? "content-type" : null;
      if (reason === null && checkJobPreviews && path === "/jobb") {
        if (!(await response.text()).includes('data-job-previews="ready"')) reason = "job-previews";
      } else {
        await response.body?.cancel();
      }
      return { path, host: url.host, status, ok: reason === null, reason };
    } catch {
      return { path, host: url.host, status, ok: false, reason: "unreachable" };
    }
  }));
}

export function deploymentOrigin(value) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.port || !/^[a-z0-9-]+-[a-z0-9-]+\.vercel\.app$/.test(url.hostname)
    || url.href !== url.origin + "/"
    || Object.values(launchTargets).some(target => target.origin === url.origin)) {
    throw new Error("Provide the HTTPS URL of an individual Vercel deployment.");
  }
  return url.origin;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , environment, ...args] = process.argv;
  const notify = args.includes("--notify");
  const testAlert = args.length === 1 && args[0] === "--test-alert";
  const [flag, deployment, ...extra] = args.filter(arg => arg !== "--notify");
  const review = environment === "review";
  const target = review ? launchTargets.dev : Object.hasOwn(launchTargets, environment) ? launchTargets[environment] : null;
  if (!target || extra.length || (review && !deployment) || (testAlert && environment !== "dev")
    || (!testAlert && flag !== undefined && (flag !== "--deployment" || !deployment))
    || args.filter(arg => arg === "--notify").length > 1) {
    console.error("Usage: node scripts/check-launch-http.mjs dev|production [--deployment https://<deployment>.vercel.app] [--notify]");
    console.error("       node scripts/check-launch-http.mjs dev --test-alert");
    console.error("       node scripts/check-launch-http.mjs review --deployment https://<deployment>.vercel.app");
    process.exit(2);
  }
  let selected = target;
  if (deployment) {
    try {
      selected = { origin: deploymentOrigin(deployment), routes: review ? reviewRoutes : target.routes, checkJobPreviews: review };
    } catch {
      console.error("Provide the HTTPS URL of an individual Vercel deployment.");
      process.exit(2);
    }
  }
  const results = testAlert ? [] : await checkLaunchHttp(selected);
  for (const { path, host, status, ok, reason } of results) {
    const code = status === null ? "unreachable" : `HTTP ${status}`;
    console.log(`${ok ? "PASS" : "FAIL"} ${host}${path} ${code}${reason ? ` (${reason})` : ""}`);
  }
  const failures = results.filter(result => !result.ok);
  if (failures.length) process.exitCode = 1;
  if (testAlert || (notify && failures.length)) {
    try {
      const { sendLaunchAlert } = await import("./launch-alert.mjs");
      await sendLaunchAlert(environment, failures, { test: testAlert });
      console.log("SMTP accepted the alert.");
    } catch {
      console.error("Alert mail delivery failed.");
      process.exitCode = 1;
    }
  }
}
