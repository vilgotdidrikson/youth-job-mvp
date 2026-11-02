# MatchnWork prelaunch

## Verified environment mapping (2026-11-02)

- Supabase Primary: MatchnWork, `iarnopkuoqumictgnqin` — production, frontend `master`.
- Supabase Secondary: MatchnWork DevStaging, `vwcfjvwfeatvuisojwrh` — `dev` only.
- Production Vercel project: `youth-job-mvp` (`prj_vYR35lijwAAiePVYzBYIcngwb1Tw`), team Employo. Public domain: https://matchnwork.se.
- Build from master; do not merge dev to ship the prelaunch site.

## Implemented

- Root landing page uses a signup-first card, the existing MatchnWork logo and pink palette, self-hosted fonts and product information below. `/demo` contains local interactive demos for both audiences.
- `/api/prelaunch` validates names, email, company and explicit consent, then writes using the server-only `register_prelaunch_signup` RPC.
- Two new isolated tables: `prelaunch_signups`, `prelaunch_rate_limits`. Both have RLS enabled and no grants for anon/authenticated; the RPC is service-role only and uses invoker security.
- Both roles may subscribe with the same email. Repeat submissions do not overwrite names or reactivate unsubscribed records, and give the same public success response.
- No signup creates an application account. Demo actions never send applications, messages or AI requests.
- `/launch-admin`: open this URL and use its embedded login with an existing production account listed in `admin_users`. View the first 100 active contacts; export all active contacts as CSV, optionally by audience. Authorization is checked server-side using verified Supabase identity and the existing admin allowlist.
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

## Signup-first layout and prelaunch boundary

The first viewport is a centered signup card. Product information is below it and the demo is a separate `/demo` route. Demo code is not imported by the signup page.

`proxy.ts` allows only `/`, `/demo`, `/launch-privacy`, `/avregistrera`, `/launch-admin`, the three exact waitlist API paths and required static assets. Other page paths (including `/profile`, `/signup`, `/login`, `/company` and `/auth`) temporarily redirect to `/`. Other application APIs return JSON 404 without invoking their handlers. This also applies to logged-in visitors; the normal app is closed during prelaunch. The proxy does not grant admin access: the export API continues to validate user identity and `admin_users` server-side.

Admin login is now embedded at `/launch-admin`; no ordinary app login/registration page needs to be exposed. The admin can sign in/out there, then load or export contacts. Do not re-open `/login` as a workaround.

The boundary is intended for the production prelaunch branch. Do not copy it to the dev site. Remove or update it deliberately when launching the full application. Existing Supabase authorization remains independent of this website routing boundary.

Tests: `node --experimental-strip-types scripts/test-prelaunch.mjs` and `node --experimental-strip-types scripts/test-prelaunch-boundary.mjs`. These cover the actual Next.js matcher/proxy, direct legacy routes, RSC/prefetch headers, old APIs and the allowlist.

## Delivery history

The initial landing page was published on production `master` as commit `22b22b6` on 2026-11-02. Browser tests verified youth and company signups reaching Primary, demo application/chat, and unsubscribe. Disposable test contacts were deleted. No launch emails were sent. Later layout/boundary changes follow the user's request to separate demo and close ordinary app routes.

Supabase advisor notes `RLS Enabled No Policy` for the two server-only tables; this is intentional because public/client roles have no grants and there is no client-access policy. Existing warnings in unrelated production functions were not changed by the prelaunch migration.

## Expanded standalone demo

The `/demo` page now has its own responsive workspace. Youth can search/filter four fictional jobs, save them, submit a local demo application with an optional message, review applications and try per-company chats. Companies can create/pause/reactivate local demo ads, select applications per ad, read example application evidence and CVs, and try per-candidate chats. An explicit “show example reply” action inserts canned recipient replies. It does not call an AI model or contact a person. Reset clears the demo state; reload also discards it. The signup page and production waitlist backend are unaffected.

There is no automated launch mail delivery. Administrators can view/filter active signups and export CSV at `/launch-admin`. The export includes personal unsubscribe links. A future sender should require an administrator to approve/start a campaign, then deliver automatically with opt-out checks, delivery tracking, retry/idempotency protection, and audience selection. No email sending feature is added by the demo work.
