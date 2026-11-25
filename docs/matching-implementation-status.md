# Matching MVP status — 2026-10-06

Steps 1 and 2 are implemented and functionally verified on `dev` / Supabase DevStaging. Production database was not changed.

## Implemented

- Reusable company profile and AI-assisted approved job profile.
- Company → Announcements → Edit match criteria: required criteria, trainable knowledge, traits, role summary and up to three optional questions. Optimistic version checks prevent stale overwrites; append-only profile history preserves previous versions. Public advertisement copy is edited separately.
- Existing applications retain their original questions and profile-version snapshot. Updated criteria affect the next assessment; updated questions affect future applications.
- Youth applications page supports saving manual answers, skipping unknown answers and atomic submission. Individual CV refresh also covers applications beyond the automatic ten-application batch, preserving manual answers.
- PDF.js reads text-based CVs for both question completion and candidate assessment. Limits: 5 MB, 10 pages and 12,000 text characters. Scanned, encrypted, malformed or oversized PDFs use the manual path; OCR is outside this MVP.
- Private CV reads require the youth owner, or a verified listing owner with submitted interest, the exact CV path and no block. CV viewing uses the authenticated user's Storage permissions, without a service-role key.
- Evidence must quote the supplied source literally. Identity fields are excluded; personality is not inferred. Missing information remains unknown, trainable knowledge does not lower the match score, and there is no automated rejection.
- Conservative fixed checks cover explicit B-licence and evening/weekend availability, explicit negatives and conflicting statements. Deterministic weighting, evidence coverage and explanation accompany the score.
- Immutable assessment history and caching use the criteria version, source hash and AI configuration. Provider failures produce a temporary assessment without permanently caching the failure.
- Text-AI routes use the official OpenAI endpoint and `OPENAI_API_KEY`. Announcements, application evidence, matching, CV writing and voice interview text decisions default to `gpt-6-luna`, with isolated task overrides. CV uses Responses with explicit `reasoning.effort: "none"`; matching retains medium reasoning. Known retired GPT-4 text overrides are migrated to Luna. Output is bounded, `store:false` is explicit, and provider/model/reasoning changes invalidate analysis caches. See `docs/voice-cv.md` for the separate audio migration.
- Shared path validation, criteria normalization and matching rules are independent of the web UI for future mobile reuse.
- After an application is submitted, server-side analysis identifies missing concrete criteria and sends individual optional questions through the application and in-app notifications. Existing CV, structured data, readable PDF and published static answers are considered first. Questions never create a second application.
- Youth can explicitly publish, skip, later answer or correct supplementation. Employers can read published answers in the relevant candidate view and include them in the next evidence-based assessment. Pending draft text is not shared. Reviewed applications remain reachable through Alla ansökningar.
- Questions exclude traits, trainable knowledge and sensitive criteria, are deduplicated by normalized criterion and are limited to three per analysis and six over an application's lifetime. Closed/declined applications cannot receive new questions. Shared source hashes, input-version checks and analysis leases prevent duplicate provider calls and stale output.
- Returning to an open youth application or company candidate page refreshes published supplementation with an authorized database read; it does not rerun AI or poll hidden pages.

## Verified

- `npm run test:matching`, TypeScript, focused ESLint and production build pass. Tests include scoring, unknowns, traits, conflicting evidence, trainable knowledge, literal citations, path isolation, real PDF extraction and unreadable fallback.
- Transactional DevStaging submission regression: missing CV denies manual and AI submission; paused listings permit saving but deny sending; resumed submission preserves answers; retries are idempotent. Anonymous RPC access is denied.
- Two youth and two company QA actors: owner-only immutable criterion history, no-op/stale saves, unchanged question snapshots, pending-answer privacy, denied cross-account access and exact private PDF access.
- Deployed dev API: authorized PDF viewing/extraction, denied company/youth/anonymous reads, application → match → conversation → synthetic youth message → company read. Blocking revokes fresh CV, assessment and Storage access.
- Deployed provider checks: stored candidate assessment; PDF-only evidence completes and submits an application; repeat completion does not resend; AI job-profile generation succeeds.
- Browser inspection: signed-in youth applications page loads and displays correctly on desktop. Full employer/mobile visual review and real pilot scenarios remain part of step 5, rather than being claimed as a completed release review.

PDF worker, standard fonts and the PDF.js Node canvas dependency are explicitly included in deployed route tracing. Runtime asset paths use `process.cwd()` because Turbopack can rewrite static `require.resolve()` calls to numeric module IDs.

## Night-session validation

- DEV-only transactional tests pass published-answer isolation, explicit answer/skip/edit, original submitted status, reviewed application access, block boundaries, stale source/version rejection, analysis lease contention, normalized deduplication, question limits and sensitive/trainable exclusion. Synthetic rows roll back.
- Live disposable DEV accounts pass immediate application submission with server-generated follow-ups, both manual and CV-evidence static completion, shared youth/company caching, company reassessment and direct candidate notification links. Disposable accounts and data were removed after testing.
- Matching/session/visible-refresh regressions, focused quiet ESLint, TypeScript and production builds pass. Public desktop home, login, signup, privacy and youth/company pricing were visually inspected. This does not verify all authenticated or physical mobile views.

## Next

The shared design pass is implemented on dev. The roadmap continues with SMTP/basic email, then the paid-offer payment flow, followed by the final UX review and pilot launch. Real pilot cases should review question quality and score calibration. Premium functions and subscriptions remain a later phase.


For the remaining authenticated/mobile pilot review, use youth and verified-company test accounts on DEV: finish onboarding/CV by text or PDF, swipe and vertically scroll a photo card, answer/edit/skip application supplementation, revisit the employer's reviewed application, update the assessment, and confirm chat quick replies only fill the composer. Review camera/microphone permissions and actual touch gestures on a physical phone. Production migration and email/payment work remain separate from this pass.


## Progressive recruitment profile and background matching — 2026-10-12

Implemented in code and DevStaging (not production):

- Four optional profile sections: availability, job preferences/motivation, real examples and self-reported qualifications/languages. Small section saves use optimistic revisions. Applications keep their existing submission requirements. Discovery reminders can be dismissed for seven days.
- Submitted candidates’ authorized employers can read the additional profile. Profile facts are included before long CV text in assessment input. Examples are self-reported and do not certify personality. Traits remain unknown and are excluded from evidence coverage.
- Chat recruitment controls default to a compact header; existing hiring confirmation and dispute actions remain available.
- Voice CV entry points and APIs are disabled by default, with the full interview code retained. Set NEXT_PUBLIC_VOICE_CV_ENABLED=true and rebuild to restore it. Text/PDF CV flows remain available.
- Durable background assessment jobs coalesce profile, criteria, submitted-answer and follow-up changes. Generation/lease checks reject stale results, retries are bounded, and optional missing-information questions retain existing deduplication and limits. Employer views show pending/completed status without requiring a manual assessment click.
- Scheduler is installed but disabled until the deployed DEV worker endpoint has passed runtime checks. Credentials are generated/stored in Vault and validated through a service-only RPC. Never copy decrypted credentials into logs or frontend configuration.

Validation: production build, TypeScript, focused ESLint, matching/follow-up/application/recruitment regressions, offline worker outage/cache/evidence tests, 18 transactional profile access/validation checks and 22 transactional queue/lease/result/privacy checks pass. All transactional fixtures roll back. Final-lease recovery was additionally verified against the deployed SQL definition. Full authenticated browser/mobile review and live provider execution of the new worker remain pending.

DevStaging migration history: 20261012124134, 20261012125211 and 20261012130305. Production is untouched.

Security advisor: queue/config tables intentionally have no client policies or grants; worker RPCs are service-only. Authorized request/state RPCs preserve existing candidate-access checks. pg_net is non-relocatable and registers its extension metadata in public while its HTTP objects live in net; the extension-schema warning remains recorded, rather than modifying system catalogs or dropping an active extension. Existing unrelated project warnings remain outside this batch.

Remaining approved work: reusable presentation videos with explicit sharing in applications, employer-specific question/video requests, video calls, broader employer requirement UX and the full page-by-page UX review. Provider/storage configuration and media privacy/access tests must precede enabling media. These features are not represented as completed by this phase.


## UX feedback fixes — 2026-10-12

- Youth onboarding now offers build-profile/later. The reusable /profile/build page allows choosing CV, individual optional sections or all sections; saved-part counts use actual CV readiness plus the four recruitment sections and explicitly distinguish partial saved data from every field being filled. CV and section saves return to the chosen plan.
- Removed swipe CV/profile banners and periodic blocking CV modal. Missing-profile guidance lives in notifications/profile. Interested swipes advance after a short animation, save in the background and restore failed cards with an error. Interest submission skips redundant client authentication/profile/job/match reads; server RPC eligibility checks remain. Horizontal drag supports the title surface while vertical scrolling and taps retain their behavior.
- Company onboarding scrolls naturally, removes company-name suggestions and offers the reusable general matching form before the first ad. Category/employment fields accept own text alongside examples. Youth strength examples, language levels and availability notes accept bounded own text; CV facts are shown to avoid unnecessary repetition.
- Chat uses more desktop/mobile space, removes success banners and quick reply suggestions, moves the job link into options and preserves compact recruitment/actions.
- Matching uses explicit earliest start dates. Exact ISO-date deadlines can be compared; a future date against vague immediate-start wording remains for employer review without repeating the question or inventing a grace period. Explicit language levels are used as self-reported evidence. Follow-up wording separates start dates, work times and language levels. Existing pending questions can use published profile facts; manual answers and skips are preserved.

Verification: TypeScript, focused ESLint, production build, matching/follow-up/supplement/recruitment/login/worker regressions; 18 profile boundary checks, 22 queue/lease/access checks and five profile-answer reuse/preservation checks pass. No authenticated browser or physical-touch verification is claimed for this feedback batch.

## OpenAI-only provider correction — 2026-10-12

All active text-AI flows use `OPENAI_API_KEY` and the official `https://api.openai.com/v1` endpoint: job generation, candidate assessment, application evidence, follow-ups and the durable matching worker. CV and hidden voice flows already used OpenAI. The retired provider helper was removed; no automatic fallback to another AI provider is permitted.

`OPENAI_TEXT_MODEL` takes precedence over the existing `OPENAI_CV_MODEL`, with `gpt-4.1-mini` as the code default. Text completions explicitly set `store:false` and bounded output. Candidate/application cache versions were advanced to prevent reuse of old-provider results; historical assessments are retained.

Offline provider/configuration, matching, follow-up and worker tests pass. Live OpenAI execution and scheduled worker activation still require deployed runtime verification. No candidate data was sent to the retired provider during these checks.

## Luna task routing and conservative savings — 2026-10-12

- `gpt-6-luna` is the default for job generation, application evidence extraction and matching. Matching and its combined follow-up analysis use `reasoning_effort:medium`, a minimum 6,000 completion-token budget (including reasoning) and a 35-second provider timeout. Job generation and simple application evidence use `none`. Unsupported sampling parameters are omitted for reasoning requests.
- `OPENAI_MATCH_MODEL`, `OPENAI_JOB_MODEL` and `OPENAI_APPLICATION_MODEL` are separate optional overrides. The old global text/CV fallbacks no longer silently change these workloads. CV retains GPT-4.1 mini as its existing baseline; hidden voice models are unchanged.
- Existing deterministic criteria checks now run before provider requests. Traits, trainable criteria and criteria already handled by those checks are excluded from the AI payload. If only deterministic criteria remain, the worker completes without a provider call. Full assessment criteria, weighting, unknown handling and optional questions are preserved.
- Employer follow-up queueing receives the same source text as the worker, preserving suppression of repeated start-date questions. Malformed provider output returns a temporary result rather than caching invented gaps.
- Existing assessment cache reuse remains. No UI, onboarding, swipe or application-submission flow is redesigned in this batch, and the separate analysis paths are not consolidated yet.

Configuration, matching, follow-up and worker regression tests pass, including rules-only processing during a mocked provider outage. Actual Luna quality, latency and account availability have not been live-benchmarked. Scheduled worker activation remains separate from these code changes.
