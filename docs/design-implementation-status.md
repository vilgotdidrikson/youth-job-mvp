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
