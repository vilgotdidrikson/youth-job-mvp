import { pathToFileURL } from 'node:url';

// Read-only preflight. Never print settings: the management response can contain secrets.
export function checkAuthEmail(config, origin) {
  const errors = [];
  const url = new URL(origin);
  if (url.protocol !== 'https:' || url.origin !== origin) throw new Error('Expected one exact HTTPS origin.');
  if (config.site_url !== origin) errors.push('Site URL must equal the expected environment origin.');
  const redirects = Array.isArray(config.uri_allow_list) ? config.uri_allow_list : String(config.uri_allow_list ?? '').split(',').map(s => s.trim());
  for (const path of ['/login', '/reset-password']) {
    if (!redirects.includes(origin + path)) errors.push(`Missing exact redirect: ${path}`);
  }
  if (redirects.some(value => value.includes('*'))) errors.push('Replace wildcard redirects with exact trusted URLs.');
  // Do not require or display smtp_pass: management responses may redact it.
  if (!config.smtp_host || !config.smtp_user) errors.push('Custom SMTP host/user missing.');
  if (![465, 587].includes(Number(config.smtp_port))) errors.push('Choose an encrypted SMTP port (465 or 587).');
  if (!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(config.smtp_admin_email ?? '')) errors.push('Sender email missing or invalid.');
  if (config.smtp_sender_name !== 'MatchnWork') errors.push('Sender name must be MatchnWork.');
  if (config.mailer_autoconfirm !== false) errors.push('Email confirmation is disabled; enable only after delivery tests pass.');
  if (config.mailer_secure_email_change_enabled !== true) errors.push('Secure email change must be enabled.');
  if (!Number.isFinite(Number(config.rate_limit_email_sent)) || Number(config.rate_limit_email_sent) < 3) errors.push('Review the email sending quota; default quota is insufficient.');
  if (!Number.isFinite(Number(config.smtp_max_frequency)) || Number(config.smtp_max_frequency) < 60) errors.push('Use at least 60 seconds between repeated auth emails.');
  for (const name of ['confirmation', 'recovery', 'email_change']) {
    const body = config[`mailer_templates_${name}_content`] ?? '';
    if (!body.includes('MatchnWork') || !/\{\{\s*\.ConfirmationURL\s*\}\}/.test(body)) errors.push(`Missing branded verification-link template: ${name}`);
    if (!config[`mailer_subjects_${name}`]?.includes('MatchnWork')) errors.push(`Missing branded subject: ${name}`);
  }
  return errors;
}

async function main() {
  const [project, origin] = process.argv.slice(2);
  if (!/^[a-z]{20}$/.test(project ?? '') || !origin || !process.env.SUPABASE_ACCESS_TOKEN) throw new Error('Usage: SUPABASE_ACCESS_TOKEN=<secret> node scripts/check-auth-email.mjs <project-ref> <https-origin>');
  // Validate the origin before making any network request.
  const parsed = new URL(origin);
  if (parsed.protocol !== 'https:' || parsed.origin !== origin) throw new Error('Expected one exact HTTPS origin.');
  const response = await fetch(`https://api.supabase.com/v1/projects/${project}/config/auth`, {
    headers: { Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}` },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Auth configuration read failed (HTTP ${response.status}).`);
  const errors = checkAuthEmail(await response.json(), origin);
  for (const error of errors) console.error(error);
  if (errors.length) process.exitCode = 1;
  else console.log('Static configuration checks passed. SMTP credentials, actual delivery, DNS and clicked links still require live verification.');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => { console.error('Auth email preflight failed. Check arguments, access and configuration; no settings or credentials were logged.'); process.exitCode = 1; });
}
