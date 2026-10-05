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
