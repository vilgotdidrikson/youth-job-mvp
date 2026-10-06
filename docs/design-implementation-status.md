# MatchnWork design implementation — 2026-10-05

Reference: uploaded `matchnwork-designspec-och-frames(1).pdf`, concept 0.1. Mobile discovery on page 2 and navbar discovery on page 13 were visually inspected before implementation. The user explicitly selected **Navbar** for youth desktop navigation on 2026-10-05.

## First block implemented on dev

- Scoped youth discovery page, image-dominant swipe cards, compact filter chips and accessible native filter dialog.
- Fixed card dimensions independent of uploaded image size, two-line title, gradient overlay, actual employer/location/employment/salary fields, deterministic illustrated fallback when no photo exists.
- Bookmark uses existing saved-job operations. Desktop side area shows actual job facts and saved jobs, with access to applications.
- Mobile circular actions and four navigation destinations: Upptäck, Karta, Aktivitet, Profil. Youth desktop navbar matches the selected frame. Activity includes links to chats and applications, so both remain reachable.
- CV status reflects completed/incomplete CV and actual pending draft count. Illustrative completion percentages, verification badges and unsupported match explanations were deliberately not converted into live claims.
- Short interaction transitions respect reduced-motion settings. Save/decision buttons prevent repeated concurrent actions, failed decisions retain the card and pointer cancellation resets the drag.
- Scoped palette: canvas #FFFAFB, ink #4C303B, rose #FCE9EF, accessible primary/text accent #B84164. Inter is already shipped by the application.
- Business operations remain in existing shared libraries, keeping presentation separate for future React Native/Expo reuse.

The design includes current dev functionality and preserves Vilgot ancestry, resolving company-page and stylesheet conflicts. The user later authorized writing the design directly on dev. No new database changes were applied for this block. The pre-design dev commit is preserved on backup/dev-before-design-20261005. Master was not updated: its production Supabase lacks the application completion and assessment schema, and the user explicitly postponed production migrations until after the design work. Keep master and production unchanged in the meantime.

Validation: TypeScript, focused ESLint (no errors; existing company image warnings), matching regression and production build pass. Local production server starts. The cloud review browser cannot reach localhost (`ERR_BLOCKED_BY_CLIENT`); the deployed discovery page and its filter dialog were visually reviewed on desktop. Real mobile viewport review is still pending. Do not claim pixel-perfect validation or a completed redesign of all 21 frames.

## Second block: job detail and activity

- Job detail follows the hero/description/overview layout in pages 2 and 6, adapted to the selected desktop navbar. Full title, requirements, benefits, employer, pay and location remain actual job data. Mobile has a sticky application action above the navigation.
- Existing save/application/CV preparation operations are retained. Closed announcements and submitted/pending applications keep distinct actions. The CV prompt uses a native modal dialog for keyboard focus and Escape support.
- Activity follows page 3: segmented ongoing/notification controls, real employer initials, dated status cards, stage-specific actions and a mutual-interest chat explanation. Ongoing and completed activities are grouped separately.
- Drafts, legacy sent interests, application completions and matches are combined by job, with the furthest stored stage taking precedence. Nothing is seeded or invented for the design. Notifications and application activity load independently, so one failure cannot hide successful results from the other.
- Chats, applications and CV remain reachable through shortcuts. Company accounts retain their notification view.
- Validation: production build (including TypeScript) passes; focused ESLint passes.
- Per user request, implementation is checked in coherent blocks, rather than repeated full audits. No new migrations or production changes.

## Remaining frames

CV builder, profile, inbox/conversation, map and company design. Implement and visually review these in coherent blocks. Global palette harmonization and real image cropping/focus previews can follow; the current block fixes display dimensions without changing stored uploads.

## Final block for this session

- Fixed native image dragging stealing swipe gestures: photos are non-draggable, decorative layers ignore pointer events, and the release distance is taken from the pointer event. Vertical touch scrolling remains available.
- Rebuilt chats with a desktop inbox/conversation workspace and mobile list/detail views, search, job link, dated messages, rose outgoing bubbles, composer and a compact menu retaining report/block/hire actions. No online indicators or unread claims are invented.
- Conversation changes cannot show stale messages from another chat. Drafts are scoped per conversation, failed sends preserve text, duplicate sends are locked, and initial/realtime messages merge by ID. CV-gate copy now correctly allows browsing before the CV is ready.
- Replaced the long youth profile with Overview, My CV, My details and Settings. One CV status, saved-job/activity/chat shortcuts, actual skills and personal data; existing PDF/CV editing, password change, logout and account deletion remain available in their appropriate sections.
- Rebuilt short onboarding with a desktop introduction/form layout, compact mobile form, two real steps, native form submission and the original validation/persistence.
- Added a shared presentation boundary and design styles for the CV hub, extended onboarding, authentication/recovery, application questions, company onboarding, job creation, candidates and company profile. Shared rose/plum navigation now also covers company accounts; visible product branding is MatchnWork.
- Rebuilt the map workspace with a desktop job list beside the map and a mobile map/list switch. List and pin selection are connected; jobs remain accessible when map rendering is unavailable. Map error/empty UI speaks to the user rather than exposing deployment instructions.
- Root palette and typography are consistent; transitions respect reduced motion. Existing marketing/admin layouts retain their structure with shared branding/palette.
- This is a coherent visual pass, not a claim of pixel-perfect validation of every route/account/viewport. Production migrations remain deferred, master/production unchanged, and the pre-design backup branch is retained.

Checks before publishing: TypeScript, focused ESLint and the production build pass. A short dev UI check follows; broad mobile/company testing is left for the next review.

## Individual application supplementation and continued design — night session

- Submitted applications now receive individual, optional questions for unknown concrete criteria in the approved job profile. Existing CV/structured data/PDF/static answers are used first. Traits, trainable knowledge and sensitive criteria are excluded. At most three questions per analysis and six over an application's lifetime; normalized criteria are deduplicated.
- Published answers supplement the same application, preserving its submitted status. Explicit skips record missing information. Draft text stays in the youth UI until sent. Youth and company in-app notifications connect to applications and the relevant candidate; no email/SMTP was added.
- Youth applications have all/questions tabs, a checking state, persistent send confirmation, optional skip controls and previous answers. Activity shows pending questions while retaining the actual recruitment stage. Company assessment shows pending/published/omitted questions and uses published answers in the next evidence-based assessment.
- Submission routes schedule follow-up analysis on the server after the response. Short database analysis leases, shared input hashes, source snapshot checks and bounded read-only UI polling prevent duplicate provider calls and stale questions. Temporary AI/PDF failures preserve the existing application and manual completion paths.
- Further rose/plum design work covers company candidates/ads, company onboarding, company profile tabs, CV entry choices and builder conversation, voice CV controls, authentication/recovery, privacy/information pages, private tasks and session states. Marketing uses consistent line icons and MatchnWork branding.
- Candidate CV, criterion editor, report, image crop and job preview use native modal dialogs for focus containment and Escape support. No fabricated activity counts, online indicators or candidate verification states were added.
- Repeated access-token rotation no longer reloads pages or retriggers application analysis; metadata updates, account changes and sign-out remain visible.
- Validation before the second deployment: TypeScript, quiet ESLint, matching regression, session-event regression and DEV-only transactional SQL tests pass. SQL checks cover stale-source rejection, analysis lease contention, deduplication, voluntary answer publishing and youth/company/anonymous isolation. First deployed block also passed live youth generation, answer/skip and company reassessment using disposable DEV accounts. Server-after-submission and the latest public design are being verified after deployment.
- All schema changes in this session are DEV-only migrations committed with the code. Master, production Supabase and the pre-design backup remain unchanged. Authenticated browser/mobile visual review remains pending; automated API/RLS checks do not substitute for that review.

## Final design and continuation block in the same 90-minute session

- The live DEV submission test passed: a submitted application returned immediately, and server-side analysis created only the two unknown-criterion questions without a second browser request. Existing B-driving-license evidence did not generate a question. Published answer/skip, shared youth/company source cache, employer reassessment and the direct candidate notification all passed.
- Added optional edits to published supplementation and the ability to answer a previously skipped question. A new explicit send is required to share either change.
- Company candidate workspace now has Att granska and Alla ansökningar, using actual review decisions. Reviewed applications and later supplementation remain reachable; completed decisions display a status and appropriate chat link rather than review controls. Default library behavior still excludes reviewed applicants for other callers.
- The candidate list RPC now excludes blocked participants, and the UI does not create candidate rows when no authorized profile is returned. A CV response is tied to its job/candidate identity so switching candidates cannot show another person's CV under a new heading. A missing deep-linked application shows an unavailable state rather than another candidate.
- Added chat quick replies matching the design direction. They fill the composer and never send automatically. Company and youth welcome/activity text reflects the actual role.
- Added mobile/desktop announcement previews and a 4:3 physical cover crop with consistent local preview geometry. Existing uploads remain usable, and fixed display dimensions still prevent image size from changing swipe cards.
- CV questions are grouped into three visible sections while retaining existing individual fields and optional answers. Added progress semantics, accessible field labels, a continue-later action and an explicit local-draft explanation. Storage failure keeps work in memory and avoids claiming the draft was saved.
- Further private account design, recovery screen headings/status messages, company match-profile progress and navigation state fixes align the smaller routes with the shared palette. Fixed white home-navigation text against the light canvas and undefined shared marketing footer/navigation color tokens.
- DEV transactional tests additionally pass reviewed-candidate access, late/edited answers and block isolation. All seven migration filenames were aligned with DEV's applied versions without editing database history; production migrations remain deferred.

## Closing application guards and onboarding polish

- New analysis and queued questions stop when the company has declined the application or its match has reached hired/rejected/cancelled. Existing questions and published answers stay available as application history. DEV transactional tests pass rejection and hiring guards as well as the prior isolation, concurrency and answer-edit cases.
- Live DEV tests additionally pass both static-question paths: an explicit manual answer submits the same application and excludes that fact from new questions; literal evidence already in the CV completes the static question and schedules only the remaining unknown criteria. Reusable DEV-only scripts cover submission and static manual/CV completion. They require independently seeded disposable fixtures and do not use real accounts.
- Account-created confirmation and the older onboarding CV method choices now follow the rose/plum direction with line icons and accessible PDF selection. Onboarding camera/profile-crop dialogs use native modal focus containment and Escape handling. The voice action uses the shared accessible primary color. Clarified PDF copy so it does not promise that no later application questions can arise.
- Centered the single pricing card and retained the compact youth/company switch on smaller screens. Public desktop views of home, login, privacy and pricing were reviewed on deployed dev; this does not establish authenticated or real mobile visual validation.
- Latest TypeScript, focused quiet ESLint, production build and transactional DEV checks pass. Master and production remain untouched; the eighth night-session migration is DEV-only and recorded with DEV's applied timestamp.

## Final refresh and limit checks

- Youth applications and company candidate supplementation refresh their published questions/answers when a visible page regains focus. The refresh reads authorized database rows only, preserves local draft fields and does not run AI or poll hidden pages. Concurrent focus/visibility events share one read; a late read cannot overwrite a newer explicit publish/analysis. A regression test covers contention, temporary read failure, hidden pages and cleanup on unmount.
- DEV transactional tests additionally pass stale criterion-version rejection, normalized-label deduplication, the three-per-request/six-per-application limits and database rejection of trainable/sensitive criteria. The entire transaction rolls back its synthetic accounts and data.
- Disposable accounts, the test announcement, generated questions and notifications from live API verification were removed from DEV after the checks. No production data was used.
- The centered pricing layout and youth/company switch were confirmed on the deployed dev desktop view. Full authenticated/mobile visual review remains outstanding.

## Final gesture and voice polish

- Swipe gestures now track one primary pointer. Secondary touches cannot replace its start position or finish another finger's gesture; saving a bookmark and an in-flight decision temporarily prevent a new drag. Photos remain non-draggable and vertical touch scrolling retains its cancellation path.
- The voice screen uses the shared microphone line icon with a readable plum-on-rose idle state and white-on-primary listening state. Legacy CV text editing uses the same font as the rest of the interface.
- These final UI changes pass the production build and focused quiet ESLint. Physical mobile gesture, camera/microphone and all authenticated layout checks are still a manual review task; the build is not a substitute for those checks.

- Youth application status now explicitly distinguishes a completed check from an unfinished/temporarily unavailable automatic check. A temporary provider failure does not turn a submitted application into a failed application, and the UI no longer silently treats every unavailable analysis as a completed check with no questions.

## Responsive finishing pass — 2026-10-06

- Extended CV/account form actions, selection controls and secondary text now use the shared rose/plum tokens and calmer typography. Upload inputs retain keyboard access with visible focus on the containing control; obsolete hidden wrappers stay hidden. Media/tool logos retain their own surfaces.
- Date/month/year groups stack on narrow screens. Onboarding cards and company matching fields allow their content to shrink rather than forcing horizontal overflow.
- Application announcement/employer titles wrap independently of their status badge. Candidate names, evidence and company announcement titles wrap; the company candidate workspace becomes one column at smaller tablet widths. Map list width is reduced at tablet sizes.
- Mobile navigation has a consistent 66px base height plus the device safe area. The chat conversation uses the same height, dynamic viewport sizing and a top safe-area inset. Short desktop windows use a more compact conversation layout.
- Validation: TypeScript, focused quiet ESLint, production build and whitespace checks pass. An authenticated dev browser review covered short youth onboarding, profile overview, the CV entry choices and guided form, plus the incomplete-CV chat state. No profile/application data was entered or submitted.
- Remaining visual verification: physical-phone swipe/keyboard/camera/microphone, an existing active conversation and a company account with actual candidate/announcement data. Responsive source changes and a passing build are not substitutes for those checks. No database changes, production migrations or master changes in this pass.

## Authenticated company test and form polish — 2026-10-06

- The user explicitly identified the youth/company accounts as test accounts and authorized test data and full-flow testing. Company onboarding saved four synthetic fields; profile editing saved Stockholm and an explicit test-only description. No real recruitment was represented.
- The company UI created test announcement `2c6902d4-97f8-4544-b04b-a0a1a920260f`, owned by test company `9007341c-ae4b-4659-90e5-090bec6d4d32`. Both mobile-format and desktop-format previews displayed the entered requirements, salary, location and description. Publication correctly retained pending verification. The criterion editor saved version 2, retaining the changes after reopening.
- Fixed unnecessary announcement-tab wrapping. Associated company onboarding/profile labels and the announcement-description label with their fields. Company onboarding now exposes progress semantics. Removed the nested announcement-form surface and calmed its section headings/labels.
- Full applicant/follow-up/chat browser testing is still blocked by the test company's pending verification. Automatic approval review rejected a proposed one-transaction administrative approval fixture because temporary administrator membership and publication approval were not specifically authorized. The rejected statement did not run; no membership/verification/publication changes were made. Do not work around this rejection. Obtain specific approval for that mechanism or use an independently authorized admin workflow.
- Returning to youth authentication failed with the visible error Invalid login credentials. Do not reuse or log secrets, or claim a successful CV upload/submission test. A synthetic PDF fixture exists in scratch for the next authorized browser test.
- Master/production remain unchanged. Physical-phone behavior, an active conversation and populated company candidate views still require actual review.
