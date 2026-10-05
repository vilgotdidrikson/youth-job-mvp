# Matching MVP status — 2026-10-05

Implemented on dev/DevStaging:
- Reusable company profile and AI-assisted approved job profile.
- Optional application questions: maximum three, private while pending, immutable snapshot after submission.
- Separate youth applications page; save answers, skip unknown answers, submit atomically.
- CV-grounded question analysis: literal excerpts only, batched up to ten applications per call, cached by source hash.
- Employer access to submitted answers; evidence-based criterion assessment with deterministic weighting, coverage and explanation.
- Unknown information produces no inferred failure; trainable knowledge does not reduce match score; no automated rejection.
- Assessment history is immutable and cached by job-profile version and source hash.

Validation: production build and TypeScript; focused lint; literal-evidence and scoring checks; transactional DevStaging tests for youth/company isolation, optional submission, idempotence, snapshot answers, and AI/manual merge behavior.

Remaining before pilot approval:
- Full visual/E2E pilot cases on the deployed site, including paused listings and multiple pending applications.
- PDF-only CV extraction: text/structured CV and profile data are analyzed; unread PDF content remains unknown.
- More than ten pending applications: the rest keep the manual completion path.
- Expand concrete-rule matching for schedules/certificates and add employer editing/version history UI.
- Review question quality, score calibration and youth copy in real pilot cases.

Do not describe this as a completely validated release.

## Stabilization follow-up

Fixed a reproducible final-submission bypass: a pending completion could previously be submitted after its CV was removed. Final submission now rechecks CV and listing availability, including the AI completion path, while holding the youth profile read lock. Existing submitted snapshots remain immutable.

Reusable transactional regression: scripts/test-application-submission.sql. DevStaging passed missing-CV denial for manual and AI submission, saving during pause, denying submission during pause, resumed submission preserving answers, and idempotent retry. Anonymous RPC access remains denied.

The full visual/E2E pilot suite and step 2 (PDF extraction, richer fixed rules and profile editing UI) remain pending. Near-term roadmap after these: SMTP/basic email, then payments. Premium subscription features are a separate later phase.

## PDF and criterion editing follow-up — 2026-10-05

Implemented:
- Server-side PDF.js text extraction for youth completion and employer assessment, bounded to 5 MB / 10 pages / 12,000 text characters. Scanned, encrypted, malformed and oversized PDFs use the manual path; OCR is outside this MVP.
- Private Storage reads require the youth owner, or a verified listing owner with submitted interest, an exact CV document path and no block. CV viewing no longer depends on a service-role key.
- Listing criterion editor under Company → Announcements, with optimistic version checking, append-only profile snapshots, and previous assessment history.
- Existing applications keep their original question/version snapshot. Criteria affect the next assessment, questions affect new applications. Match criteria editing does not rewrite public advertisement copy.
- Conservative fixed checks for explicit B-licence and evening/weekend availability, including explicit negatives and conflicting statements. Personality is not inferred. Trainable requirements do not lower suitability.
- Per-application CV refresh preserves manual answers and provides a path beyond the automatic ten-application batch.
- Shared path validation, criterion normalization and matching rules are UI-independent for future mobile reuse.

Validation in this follow-up: `npm run test:matching`, TypeScript, focused ESLint and production build pass. DevStaging submission regression passes. Authenticated deployed API checks, isolation and visual review are recorded below when completed.

DevStaging authenticated regression now passes with two youth and two company QA actors: criterion history is immutable and owner-only; stale/no-op saves behave correctly; pending answers remain private; existing question snapshots survive criterion edits; paused submission is denied; retries preserve submitted answers; only the youth and verified application owner can download the private PDF. Deployed CV viewing and denied-account API checks pass. PDF worker and standard fonts are explicitly included in the server artifact (verified against both route tracing manifests).
