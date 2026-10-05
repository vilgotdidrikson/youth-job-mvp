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
