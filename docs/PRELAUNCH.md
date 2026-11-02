# MatchnWork prelaunch

## Verified environment mapping (2026-11-02)

- Supabase Primary: MatchnWork, `iarnopkuoqumictgnqin` — production, frontend `master`.
- Supabase Secondary: MatchnWork DevStaging, `vwcfjvwfeatvuisojwrh` — `dev` only.
- Production Vercel project: `youth-job-mvp` (`prj_vYR35lijwAAiePVYzBYIcngwb1Tw`), team Employo. Public domain: https://matchnwork.se.
- Build from master; do not merge dev to ship the prelaunch site.

## Implemented

- Root landing page uses the existing MatchnWork logo and pink palette, self-hosted fonts, mobile layout, and local interactive demos for both audiences.
- `/api/prelaunch` validates names, email, company and explicit consent, then writes using the server-only `register_prelaunch_signup` RPC.
- Two new isolated tables: `prelaunch_signups`, `prelaunch_rate_limits`. Both have RLS enabled and no grants for anon/authenticated; the RPC is service-role only and uses invoker security.
- Both roles may subscribe with the same email. Repeat submissions do not overwrite names or reactivate unsubscribed records, and give the same public success response.
- No signup creates an application account. Demo actions never send applications, messages or AI requests.
- `/launch-admin`: log in using an existing production account listed in `admin_users`, then open this URL. View the first 100 active contacts; export all active contacts as CSV, optionally by audience. Authorization is checked server-side using verified Supabase identity and the existing admin allowlist.
- `/launch-privacy`: purpose, consent, contact and retention information for this waitlist.
- `/avregistrera?token=...`: confirmation page; only an explicit POST unsubscribes. Each CSV row includes its own unsubscribe link. Never put this link/token in a public list.

## Runtime configuration

`NEXT_PUBLIC_SUPABASE_URL` must exactly match the Primary project's URL; backend fails closed otherwise. Privileged server access uses existing `SUPABASE_SECRET_KEY`, falling back to `SUPABASE_SERVICE_ROLE_KEY`. Neither is exposed to clients. The production project's public URL and publishable key were explicitly configured for Primary. Do not copy these settings to the dev Vercel project.

## Launch contact workflow

1. Sign into the production administrator account and visit `/launch-admin`.
2. Choose youth, company or all; download CSV shortly before sending. Unsubscribed entries are excluded.
3. Import only the needed contacts into the chosen email provider. Use the included personal unsubscribe link in every message.
4. Notify about the launch/pilot only, as described in the consent. Do not use this list for unrelated marketing.
5. Record a successful notification in `notified_at` after the provider confirms delivery acceptance; don't mark failed mail as sent.

Automatic/bulk email delivery is deliberately not activated and no launch email has been sent. This implementation provides a usable contact export. A future mail sender must recheck opt-out at send time, process bounces, use idempotent delivery records and provider rate limits; never distribute from a browser client.

## Retention

Hash-based rate-limit rows expire after 30 minutes and are pruned on the next valid signup. Raw IP addresses are not stored by this feature. Review/remove waitlist records within 12 months, as stated on the privacy page. Handle access/removal requests at info@matchnwork.se. Waitlist retention cleanup currently requires an operator; it is not an automatic scheduled job.

## Validation

- `node --experimental-strip-types scripts/test-prelaunch.mjs`: validation, normalization and CSV formula-injection checks.
- `npx tsc --noEmit`.
- `npm run build`: old voice/job endpoints now initialize their SDK clients only after their runtime key checks, so building does not require AI credentials or make API calls.
- Transactional database assertions for both roles, duplicate non-overwrite, quota and unsubscribe. All fixtures rolled back.
- Verified RLS and absence of anon/authenticated read/write grants for both new tables.

## Verification limits and delivery state

Managed browser preview is currently unavailable for this existing Next.js repo: the preview daemon appends Vite flags (`--host`, `--strictPort`) that `next dev` does not accept. Browser layout and click-through QA remain unverified; no application runtime workaround was introduced.

The first branch push was rejected by automatic approval review because explicit authorization to upload source to GitHub was required. Source commits are local until the user approves pushing to `vilgotdidrikson/youth-job-mvp`. No new deployment exists. The production database migration and public Vercel environment configuration have been applied as authorized. No launch emails were sent.

Supabase advisor notes `RLS Enabled No Policy` for the two new server-only tables; this is intentional because public/client roles have no grants and there is no client-access policy. Advisor also reports existing warnings in unrelated production functions. These were not changed by the prelaunch migration.
