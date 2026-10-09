# Employer-confirmed employment — MVP

Implemented in the local dev checkout and applied to Supabase **MatchnWork DevStaging**. GitHub/Vercel publication is blocked pending explicit user approval for the repository/branch destination. Production database is unchanged.

## Rollout blocker

Automatic approval review rejected pushing to `vilgotdidrikson/youth-job-mvp` branch `dev`, citing publication of potentially private code to an external repository without explicit destination approval. The commit is local and reviewable.

The database migration is already applied. Consequently the OLD deployed UI's legacy hire button and direct close-recruitment action are blocked until the new frontend is published. A proposed restoration of the previous legacy RPC permission was also rejected by automatic review as weakening the new boundary. No workaround or second push was attempted. Publishing the prepared frontend resolves these UI/API mismatches.

## Behavior

- The employer registers role and start date in the matched conversation. The existing hire status and chat history are retained. Legacy hires need these facts before verification can be granted.
- The youth approves or disputes those facts. Profile visibility and CV inclusion are independent, opt-in preferences that can be changed later.
- The profile check says **Jobb via MatchnWork** and explains its scope. It means an employer-confirmed hire approved by the youth, not identity verification or endorsement of all CV claims. A future start is labelled **Planerad start**.
- Employer-authored facts live in `employment_records`; editing free-text CVs cannot grant a badge. Approved facts are composed into the MatchnWork CV preview, authorized candidate text CV and newly generated PDF. Uploaded PDFs are unchanged. Generated PDF references are invalidated when consent changes.
- The youth can request employer registration once per seven days, or send a private missing-registration report to admin. Neither action verifies employment, creates a bill or restricts the company.
- Closing a company ad requires a recruitment outcome. Existing hires cannot be classified as no hire. Reopening the ad clears its prior outcome. Ads with hires or registration/report evidence are archived rather than directly deleted by the owner; trusted account deletion retains its existing cascade behavior.
- Hourly reminders: unanswered registration/approval receives a reminder after three days and is escalated after seven. Newly created matches without an employment record receive an employer followup after fourteen days and escalate four days later. Existing matches are not bulk-backfilled with these followups. Blocked contacts receive no reminders.
- Admin can record review status/private notes and manually pause or suspend new recruitment after followup. A reason and confirmation of review are required; changes are audited and notified to the company. Both restriction modes block new ads, reopening ads and new candidate contacts. They preserve existing chats and employment registration. Suspension is a recruitment restriction, not credential revocation or account deletion.
- Discount records are disabled by default. No rate, expiry, price or offer is shown to users. Available/redeemed states require a confirmed, paid employment record. Actual billing activation and redemption integration remain future work.

## Validation

- Production Next.js build, TypeScript check and lint of new recruitment modules passed.
- `npm run test:recruitment`: 14 assertions covering CV composition, deduplication, opt-in/out, planned starts and admin queue selection.
- `node scripts/test-cv-quality.mjs`: existing pure CV quality checks passed.
- `scripts/test-recruitment-staging.sql`: 54 positive/negative assertions passed under real `anon` and `authenticated` database roles. All changes and generated notifications were rolled back. Checks include cross-account isolation, no youth-authored hire, employer/youth separation, private report/admin-note boundaries, correction/reapproval, weekly limits, reminder timing and deduplication, billing independence, outcome enforcement, restrictions at the DB boundary, existing message sending, restoration and dormant rewards.
- Supabase security advisors introduced no findings for the new public invoker RPCs or RLS tables. Existing advisor findings outside this change remain.
- The legacy `test:cv` scenario script needs a local API server and was unavailable here; pure CV checks ran instead.
- Signed-in browser E2E remains to be completed: the available browser had no authenticated staging session. Public deployment reachability is checked separately.

## Manual acceptance test

1. As a verified company, open an existing match and register role/start date.
2. As the matching youth, open the notification. First dispute the details and check the admin queue; let the employer correct them. Approve with profile visibility and CV inclusion enabled.
3. Check the profile badge, its accessible explanation, confirmed experience and CV preview. Generate a fresh PDF.
4. Turn profile visibility off without disabling CV inclusion: badge and public experience disappear, CV keeps the selected experience. Then turn CV inclusion off and generate another PDF.
5. On a different match without employment, request registration and confirm the weekly cooldown. Report missing registration and inspect the private admin queue.
6. Close an ad with the appropriate outcome. Ensure an existing hired candidate cannot be reported as no hire.
7. On a disposable company account, have admin record followup and apply a recruitment restriction. Confirm new ads/contacts fail while the existing chat works, then restore access.

No email, payment charge, present card, automatic penalty, social network or completed-employment flow is enabled by this change.
