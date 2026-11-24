import nodemailer from "nodemailer";

export function launchAlertMessage(environment, failures, to, test = false) {
  return {
    from: '"MatchnWork drift" <info@matchnwork.se>',
    to,
    subject: `[MatchnWork] ${test ? "Test av driftlarm" : "Driftlarm"} · ${environment}`,
    text: [
      test ? "Det här är ett planerat test. Inget driftfel har registrerats." : "En eller flera kontroller av MatchnWork misslyckades.",
      ...failures.map(({ host, path, status, reason }) => `${host}${path} · ${status === null ? "inget HTTP-svar" : `HTTP ${status}`} · ${reason}`),
    ].join("\n"),
  };
}

export async function sendLaunchAlert(environment, failures, { test = false, env = process.env } = {}) {
  if (!test && failures.length === 0) return;
  const recipient = env.MNW_LAUNCH_ALERT_EMAIL;
  const password = env.MNW_INVOICE_SMTP_PASSWORD;
  if (!recipient || !/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(recipient) || !password) {
    throw new Error("Missing alert mail configuration");
  }
  const transport = nodemailer.createTransport({
    host: env.MNW_INVOICE_SMTP_HOST || "smtp.zoho.eu",
    port: 465,
    secure: true,
    auth: { user: "info@matchnwork.se", pass: password },
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 15000,
    disableFileAccess: true,
    disableUrlAccess: true,
  });
  const delivery = await transport.sendMail(launchAlertMessage(environment, failures, recipient, test));
  if (delivery.accepted?.length !== 1 || delivery.rejected?.length) throw new Error("Alert mail rejected");
}
