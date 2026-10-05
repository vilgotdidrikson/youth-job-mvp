# Matching MVP status — 2026-10-05

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
- Three text-AI routes share `GROQ_TEXT_MODEL`, defaulting to the supported `openai/gpt-oss-120b`. This replaces the retired Llama model. JSON output and low reasoning are bounded; model changes invalidate analysis caches.
- Shared path validation, criteria normalization and matching rules are independent of the web UI for future mobile reuse.

## Verified

- `npm run test:matching`, TypeScript, focused ESLint and production build pass. Tests include scoring, unknowns, traits, conflicting evidence, trainable knowledge, literal citations, path isolation, real PDF extraction and unreadable fallback.
- Transactional DevStaging submission regression: missing CV denies manual and AI submission; paused listings permit saving but deny sending; resumed submission preserves answers; retries are idempotent. Anonymous RPC access is denied.
- Two youth and two company QA actors: owner-only immutable criterion history, no-op/stale saves, unchanged question snapshots, pending-answer privacy, denied cross-account access and exact private PDF access.
- Deployed dev API: authorized PDF viewing/extraction, denied company/youth/anonymous reads, application → match → conversation → synthetic youth message → company read. Blocking revokes fresh CV, assessment and Storage access.
- Deployed provider checks: stored candidate assessment; PDF-only evidence completes and submits an application; repeat completion does not resend; AI job-profile generation succeeds.
- Browser inspection: signed-in youth applications page loads and displays correctly on desktop. Full employer/mobile visual review and real pilot scenarios remain part of step 5, rather than being claimed as a completed release review.

PDF worker, standard fonts and the PDF.js Node canvas dependency are explicitly included in deployed route tracing. Runtime asset paths use `process.cwd()` because Turbopack can rewrite static `require.resolve()` calls to numeric module IDs.

## Next

Design work can begin. The roadmap continues with SMTP/basic email, then the paid-offer payment flow, followed by the final UX review and pilot launch. Real pilot cases should review question quality and score calibration. Premium functions and subscriptions remain a later phase.
