// Read-only. The two environments deliberately have different public routes.
const target = process.argv[2];
const environments = {
  dev: { origin: "https://youth-job-mvp-dev.vercel.app", routes: ["/", "/login", "/help", "/privacy", "/reset-password"] },
  production: { origin: "https://matchnwork.se", routes: ["/"] },
};
if (target !== "dev" && target !== "production") {
  console.error("Usage: node scripts/check-launch-http.mjs dev|production");
  process.exit(2);
}
const { origin, routes } = environments[target];
const checks = routes.map(path => ({ url: new URL(path, origin), path }));
if (target === "production") {
  checks.push({ url: new URL("https://www.matchnwork.se/"), path: "/" });
}

await Promise.all(checks.map(async ({ url, path }) => {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
    const final = new URL(response.url);
    const contentType = response.headers.get("content-type") ?? "";
    await response.body?.cancel();
    const pass = response.status === 200 && final.origin === origin && final.pathname === path && contentType.startsWith("text/html");
    if (!pass) process.exitCode = 1;
    console.log(`${pass ? "PASS" : "FAIL"} ${url.hostname}${url.pathname} HTTP ${response.status}, final ${final.origin}${final.pathname}`);
  } catch {
    process.exitCode = 1;
    console.error(`FAIL ${url.hostname}${url.pathname} could not be reached`);
  }
}));
