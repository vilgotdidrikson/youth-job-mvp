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
