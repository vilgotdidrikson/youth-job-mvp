# MatchnWork design and optimization audit — 2026-10-22

**Base:** `dev` at `f7ecece` (2026-10-21). Deployed dev: https://youth-job-mvp-dev.vercel.app
**Status:** Historical findings and proposals from 2026-10-22, with implementation updates below. Current ownership and delivery status are tracked in `docs/ATGARDSPLAN.md`. Follow `AGENTS.md` before coding: reserve the item, work on your own branch from current `dev`, and report real verification.

**Logo update — 2026-10-25:** Vilgot supplied the new MatchnWork logo, now implemented across the site's existing brand surfaces in dev through [PR #105](https://github.com/vilgotdidrikson/youth-job-mvp/pull/105), merge `ccf94bf`. DA-07's shared logo and DA-02's favicon/app/share-image assets use this artwork. The previous inconsistent logos and starter favicon are historical findings, not outstanding implementation tasks. Visual acceptance and physical mobile installation remain separate checks; this update does not close unrelated audit items.

<a id="demo-design-direction"></a>
## Design direction from the employer demo — 2026-10-26

**User direction:** Vilgot identified the new employer demo as the visual direction for MatchnWork: “stilren, clean men samtidigt informativ”. Treat the demo as the concrete reference for layout, typography, spacing, surfaces and restrained styling when implementing the existing design tasks.

**Clarification from Vilgot — 2026-10-26:** The reference is the visual design itself: clean composition, balanced spacing, readable typography, grouped information, subtle borders/shadows and restrained pink accents. “Informative” means that existing information is well presented. It does not introduce a requirement for more guidance, explanatory panels or a guided step-by-step experience. Existing help, validation and empty-state tasks retain their original scope.

**Reference:** [MatchnWork employer demo](https://matchnwork-foretagsdemo.peachygleam129.chatgpt.site), source version `c76b4bcef58250380555e41553a222c900de22c7`. The demo is a separate, fictional walkthrough. Its present owner-only access and the product's access controls are separate from this design decision.

### Relationship to the existing plans

This is a visual direction for the existing tasks, not a replacement roadmap or a new launch requirement. `docs/ATGARDSPLAN.md` remains authoritative for global order, dependencies, ownership, delivery status and product decisions. The audit retains its original findings and technical acceptance criteria; implementation updates describe which findings remain current. The demo guides presentation within that scope. If its simplified walkthrough conflicts with a product rule or accessibility requirement, follow the product plan and adapt the presentation.

| Existing scope | How the direction applies | What stays in place |
|---|---|---|
| DA-04 → DA-05 → DA-06 | Use the existing palette and scales to create calm surfaces and readable hierarchy. | Current owners, token consolidation, contrast requirements and outstanding verification. No new palette or second design system. |
| DA-12 | Use the company view, already first in this task, to demonstrate the direction while migrating styles. | One view per delivery, removal of matching overrides, coordination with active work; no wholesale redesign or navigation replacement. |
| D08, D07 and F20 | Use consistent spacing, typography and visual grouping for existing content. | Existing widths, truthful copy, privacy/help access and task priorities. |
| D05 / DA-03 / DA-10 / DA-17, DA-15 | Use the same restrained visual language and varied composition within the planned marketing work. | Existing performance, reduced-motion and content goals; no requirement to rebuild marketing as the demo workspace. |
| F04, F05, F26/N19, N16, N23/N24 and L04 | Present navigation, candidate evidence, questions and recruitment states clearly. | Correct destinations; job-specific sharing and evidence; manual ad status without mandatory position counts/automatic promotion; voluntary video; questions before matching under N24; separate pending/confirmed recruitment states. The demo neither changes these rules nor marks planned features implemented. |
| DA-16, F23 and L08 | Preserve clarity on small screens and with keyboard navigation. | Existing text, input and touch-target minimums, contrast, focus and separate physical-device checks. |

Cross-references describe coordination, not a reservation or status change. Apply the visual checks below when a relevant view is already being changed; do not reopen completed functional tasks solely because the reference was added.

**Further clarification from Vilgot — 2026-10-26:** Keep the demo and future affected product views simple: fewer competing text elements, fewer tiny secondary labels, and no repeated explanation panels or decorative statistics. Use a small, readable type scale and clear primary actions. Ready-made demo ads and recruitment examples should be immediately explorable; visitors may also edit and create their own. Preserve required status, evidence, error and consent information. The latest expanded demo is not a mandate to copy every control into the product.

**Ad context:** [N25 in the action plan](ATGARDSPLAN.md#n25) records the requested ad-first candidate flow: select an owned ad, then show that ad's submitted applications and job-specific evidence. Coordinate with N03/F04, F05/F26/N19 and DA-12 without taking over their active work or changing their status. This is a planned product change; a simulated demo does not verify the real flow.

### What the comparison establishes

The audit's consistency and accessibility work supports this direction, but fixing tokens alone does not produce the demo's clarity. The visual goal also needs to govern page composition, information priority, spacing and the visual treatment of controls.

| Area | Current frontend / audit evidence | Direction to carry from the demo | Existing work |
|---|---|---|---|
| Page structure | The company source already has workspace headings, tabs and a candidate list/detail view. It is therefore an existing foundation, not a missing feature. Global overrides still influence the presentation. | A stable workspace shell, a clear page title and one main work area. Related information is visually grouped. | DA-12, D08; coordinate company navigation with F04. |
| Information hierarchy | `product-design.css` sets product h1 weight to 500 with `!important`; company CSS also uses relatively similar weights for headings, names and details. | Make the page title, candidate name, section heading, supporting fact and status clearly distinguishable. Establish this through the existing type scale and whitespace, not a new font size for each component. | DA-05, DA-12. |
| Colour and surfaces | `theme.css` already contains the shared rose/plum palette, muted text changes and the type/radius/weight scale. Original DA-04–DA-06 findings must be read alongside their newer action-plan updates. | Predominantly neutral canvas and white work surfaces; use pink for the active location, primary action and selected content. Use subtle borders, restrained shadows and consistent corner radii to separate content without visual clutter. | DA-04–DA-06. |
| Actions and forms | The real ad builder has three steps, optional salary/benefits/image fields, draft recovery and publication restrictions. | Use consistent button hierarchy, aligned fields, balanced spacing and a distinct visual treatment for review/confirmation. Retain existing help and error handling. Preserve all real fields and rules. The demo's shorter form and mandatory example salary are not new product requirements. | DA-12; preserve existing form, draft and publication work. |
| Candidate information | The real source already exposes evidence, unknown information, CV, answers and assessment progress/error/retry states. | Group identity and practical facts first; place readable criteria with their evidence next; retain CV and decisions in predictable locations. Keep unknown information neutral and distinguish a fact from a conclusion. | DA-12, F05, F26/N19. |
| Marketing | Browser inspection of current dev shows the landing hero with an animated headline and CTA, but no immediate static product explanation or product view. The features page still presents many similarly styled feature cards. | Demonstrate the product and its benefit early with clearly fictional examples. Vary the information structure and remove repetition. Marketing can retain its own composition while sharing the product's visual language. | D05 / DA-03, DA-15, DA-17. |
| Mobile and accessibility | The product already defines a 12px visible-text minimum, 16px form inputs and 44px touch targets. The demo CSS includes 9–11px labels and several smaller controls. | Preserve the clean grouping and responsive flow, but meet the product's size, contrast, keyboard and focus requirements. Do not copy the demo CSS verbatim. | DA-06, DA-16, F23, L08. |

### Application rules for the next design changes

1. **Use the company workspace as the first reference implementation during DA-12.** Bring the ad list/builder, candidate review and recruitment status into the same visual language, one bounded view at a time. Keep existing work ownership and the global action-plan order; this comparison does not reserve another person's implementation.
2. **Work through shared primitives.** Reuse `theme.css` and shared navigation, icons, dialogs and controls. Add only justified missing semantic components (for example a page header, work panel or status badge). Remove the matching legacy overrides in the same view migration.
3. **Prioritise visual composition.** Establish a consistent hierarchy through typography, alignment, whitespace, surfaces and button styling. Present existing information clearly without adding demo-style guidance or extra explanatory content. Preserve necessary job information, evidence, warnings and recovery actions.
4. **Adapt the walkthrough to the real product.** The demo's numbered four-step sidebar is a meeting narrative, not a decision to replace the app's navigation. The product must still support multiple jobs, returning employers, asynchronous answers and chats, and real verification/permission states. Use truthful counts and timestamps. Planned demo features remain planned until separately implemented and verified.
5. **Apply the same principles to youth views with their own interaction patterns.** This direction does not replace the youth swipe flow or mobile navigation with a company-style desktop workspace.

### Acceptance when a view is migrated

- Review it next to the demo for hierarchy, grouping, restrained use of pink and the clarity of the main action. Exact pixel identity is not the goal.
- Verify populated, empty, loading, failed/retry and completed states; also long names, long job titles and actual assessment evidence. A static happy-path screenshot is insufficient.
- Check at 375px and 1280px, plus a constrained intermediate width. Maintain at least 12px visible text, 16px form inputs and 44px touch targets; measure actual contrast and test keyboard/focus order. Physical mobile and on-screen-keyboard testing remain separately reportable.
- Preserve authentication, visibility, job-specific sharing, ad lifecycle and recruitment logic. A visual migration must not silently introduce the demo's simulated business behaviour.

### Verification and limits of this comparison

Read the current audit and action plan, plus `app/styles/theme.css`, `app/product-design.css`, `app/company/page.tsx`, `app/company/company-design.css`, `components/company-match-profile-form.tsx`, `components/candidate-assessment-panel.tsx`, `app/chats/chat.module.css`, `components/youth-navigation.module.css` and `app/page.tsx`. Compared them with the demo's source and the demo's visually checked desktop/375px walkthrough from this session.

Viewed current deployed dev `/` and `/features` in the browser. `/company` required login, so this comparison's observations about authenticated product screens are **from code**, not a new signed-in visual acceptance test. No frontend, database or demo-access changes are made by this documentation update. Existing task owners/statuses and the audit's historical evidence remain intact. No build or functional tests are claimed for this documentation-only comparison.

## How to use this file

Use `docs/ATGARDSPLAN.md` for the current global work order and dependencies. The table below groups audit findings by priority; it is not a separate execution queue. Each item says where the problem is, what to change, and how to check it. To hand an item to an AI agent in VS Code, a prompt like this works:

> Read `AGENTS.md`, `docs/ATGARDSPLAN.md` and item DA-01 in `docs/DESIGN_AUDIT_2026-10-22_1.md`. Implement only DA-01 on a new branch from `dev`. Do not change copy, business logic or other items. Run lint, TypeScript and a production build, then check the result at 375px and 1280px width and report what you actually verified.

Several findings touch items that already exist or are in progress. Those are marked **Coordinate with** and should be added to the existing item rather than started separately:

- **D05** (landing page, Max / Claude, in progress) — DA-03, DA-10, DA-17
- **F23** (accessibility, branch `claude/f23-accessibility-20261022` was active today) — leave role selection, tabs and dialogs to F23
- **F20** (privacy and help easy to reach) — DA-08, DA-09
- **D07** (microcopy and brand text), **D08** (empty states and page widths) — DA-07

## What was checked

- **Seen in the browser:** `/`, `/features`, `/pricing`, `/login`, `/signup`, `/forgot-password`, `/privacy` and the `/swipe` redirect. Viewed at 375×812 (mobile emulation) and about 608px wide, with layout measured via script at 1280×800.
- **Reviewed in code:** the global styles and tokens (`app/globals.css`, `app/styles/theme.css`, `app/product-design.css`), every CSS file and CSS module, the root layout, the marketing pages and their components, the auth page, youth discovery, navigation and the large legacy views.
- **Not seen in the browser:** the logged-in youth and company screens (swipe, profile, applications, chats, map, company workspace). Findings about them come from code only and are marked *(from code)*. A visual pass over those screens with a fictional QA account is still worth doing; it fits under L08.

## Priority overview

| ID | Priority | Area | Finding |
|---|---|---|---|
| [DA-01](#da-01) | P1 | Landing | Illustrations in the platform section render as empty dark boxes below 1024px |
| [DA-02](#da-02) | P1 | Brand / SEO | New supplied logo implemented in favicon, app icons and share image; remaining acceptance/metadata checks tracked below |
| [DA-03](#da-03) | P1 | Landing | The first screen shows no product and no static explanation |
| [DA-04](#da-04) | P2 | Design system | Colour tokens exist but are bypassed, duplicated and drifting |
| [DA-05](#da-05) | P2 | Design system | No type, radius or weight scale (93 font sizes, 47 radii) |
| [DA-06](#da-06) | P2 | Accessibility | Subtle and muted text fail WCAG AA contrast on some surfaces |
| [DA-07](#da-07) | P2 | Brand | Shared supplied logo implemented across brand surfaces, including auth; visual acceptance remains |
| [DA-08](#da-08) | P2 | Marketing | Three different footers; none links to privacy |
| [DA-09](#da-09) | P2 | Privacy page | Logged-out visitors get "Till profilen"; draft legal note is public |
| [DA-10](#da-10) | P2 | Performance | Full-screen WebGL background runs non-stop and ignores reduced motion |
| [DA-11](#da-11) | P2 | Performance / SEO | Marketing pages are fully client-rendered; Mapbox CSS loads on every page |
| [DA-12](#da-12) | P2 | Code health | Legacy inline styles reskinned through `!important` and `[style*=]` overrides |
| [DA-13](#da-13) | P3 | Pricing | The only youth plan has a secondary-style button; the highlight class is unused |
| [DA-14](#da-14) | P3 | Auth | Card-in-card on mobile, diagonal "↗" arrow, text glyphs instead of the icon set |
| [DA-15](#da-15) | P3 | Features page | Twelve identical cards, repeated icons, heavy overlap with the landing page |
| [DA-16](#da-16) | P3 | Mobile | Small text and touch targets in discovery and footers *(partly from code)* |
| [DA-17](#da-17) | P3 | Landing | The page ends without a call to action |
| [DA-18](#da-18) | Decision | Product | Logged-out visitors cannot see a single job |

Original audit sequencing advice (subject to current action-plan status and global order): DA-01 and DA-02 first (small, visible, independent). Then DA-04 → DA-05 → DA-06 as one design-system block, because the later visual fixes get much easier once tokens are in place. DA-12 runs alongside, one legacy view at a time.

---

## P1 — fix before launch

<a id="da-01"></a>
### DA-01 Landing illustrations are blank below 1024px

- **Seen:** At 375px and about 608px, all five cards in "En plattform, hela vägen" show an empty dark box with a barely visible dark shape. The section looks unfinished.
- **Cause (verified in the browser):** `PlatformShowcase` renders every visual twice: once in the desktop column (`.platform-showcase-image-col`, `display: none` below 1024px) and once in the mobile list. Each SVG in `components/ui/platform-visuals.tsx` uses fixed gradient ids (`ai-grad`, `ai-glow`, `match-grad`, `chat-grad`, `map-grad`, `ew-grad`). The ids appear twice in the DOM, `url(#ai-grad)` resolves to the first copy, and that copy sits inside a `display: none` container, so Chrome paints nothing.
- **Fix:** Give each SVG instance unique ids with React `useId()`, for example `const id = useId(); const grad = `${id}-grad`;` and reference `url(#${grad})`. Alternatively, render only one copy of each visual. Do not solve it by un-hiding the desktop column.
- **Files:** `components/ui/platform-visuals.tsx`, `components/ui/platform-showcase.tsx`
- **Done when:** All five illustrations show their pink gradients at 375px, 800px and 1280px, and `document.querySelectorAll('[id="ai-grad"]').length` is never above 1.

<a id="da-02"></a>
### DA-02 Favicon, app icons, share image and page titles

- **Implementation update — 2026-10-25:** The uploaded original `public/brand/matchnwork-logo.png` is preserved unchanged. `scripts/generate-brand-icons.mjs` derives the favicon (16/32/48px), SVG icon, Apple icon (180px), manifest icons (192/512px) and padded maskable icon (512px) from it. The Open Graph image uses the same original. Included in [PR #105](https://github.com/vilgotdidrikson/youth-job-mvp/pull/105), merged to dev as `ccf94bf`; approved dev deployment. Do not replace it with the former generated M mark.
- **Actually verified:** Original bytes, icon dimensions, ICO frames, renderable SVG, production build and local HTTP 200/correct MIME for logo, favicon, SVG, Apple icon, manifest and share image. Deployed dev logo and favicon match the delivered files byte-for-byte.
- **Still to verify:** Visual desktop/mobile acceptance, installed mobile icon and real social link previews; this update does not claim all page-title/metadata acceptance is complete. Existing DA-02 ownership/status in the action plan is preserved.

**Original audit finding (2026-10-22):**

- **Seen:** `app/favicon.ico` is the unchanged create-next-app favicon (25,931 bytes), so browser tabs and bookmarks show the Next.js/Vercel mark. `public/` still holds the starter SVG (`file.svg`). There is no `apple-icon`, no web manifest and no `theme-color`, so "Lägg till på hemskärmen" gets a screenshot instead of an icon. All pages share the title "MatchnWork" and there is no Open Graph image, so a link shared on Snapchat, Instagram or iMessage has no preview.
- **Fix:**
  1. Use the supplied MatchnWork logo in `app/icon.svg`, `app/apple-icon.png` (180×180) and `app/favicon.ico`; retain the original source and generate size variants with the shared script. The earlier M-mark proposal has been superseded.
  2. Add `app/manifest.ts` with name, short_name, `theme_color: "#b84164"`, `background_color: "#fffafb"` and the icons. Add `export const viewport = { themeColor: "#fffafb" }` in `app/layout.tsx`.
  3. Add `app/opengraph-image.tsx` (1200×630, brand gradient, headline and logo).
  4. Use a title template in `app/layout.tsx` (`title: { default: "MatchnWork", template: "%s · MatchnWork" }`) and per-page titles such as "Funktioner", "Priser", "Logga in", "Skapa konto" and "Integritet och AI". This needs DA-11 for the pages that are currently fully client-rendered.
- **Done when:** The tab shows the supplied MatchnWork logo, a shared link to `/` shows the image and the right title in a link previewer, and every public page has its own title.

<a id="da-03"></a>
### DA-03 The first screen shows no product

**Coordinate with D05.** This item adds input to D05 and should not become a separate branch.

- **Seen:** On mobile the first screen is a half-typed headline ("En enklare väg till|"), two buttons and the animated gradient. Nothing explains that this is a job app for young people, and nothing shows the product. The next section opens with unemployment statistics, so the visitor sees the problem before learning what MatchnWork is. The statistics cover ages 15–24, while the product targets roughly 12–20.
- **Fix (proposal for D05):**
  - Put the static one-line explanation from D05 directly under the headline, visible on the first frame.
  - Show the product in the hero: one tilted swipe card (a real card design from `components/job-discovery.module.css`, with an invented but obviously fictional job) in a phone frame, next to the headline on desktop and below it on mobile. This was already an open question, and the app now has a strong card design worth showing.
  - Let the typewriter animate only the last word or phrase, and render the full headline as static text for screen readers and `prefers-reduced-motion`. The latter is already partly handled.
  - Move the statistics below "En plattform, hela vägen", or reframe them for the actual age group.
- **Done when:** A first-time visitor on a 375px screen can say what the service does and who it is for from the first frame, without waiting for the animation.

---

## P2 — design system and consistency

<a id="da-04"></a>
### DA-04 Colour tokens are bypassed, duplicated and drifting

- **Seen (code):** `app/styles/theme.css` says it is the single source of truth, but:
  - About 1,300 hard-coded hex values sit in 23 other CSS files (`globals.css` 373, `product-design.css` 215, `profile.css` 95, `company-design.css` 74 and more). The brand colour `#b84164` alone is written out 130 times instead of `var(--color-brand)`.
  - `.mnw-product` in `app/product-design.css` (line 2) redefines the tokens, and one value conflicts: `--color-surface-soft` is `#fff0f4` in `theme.css` and `#fce9ef` under `.mnw-product`. The same token name renders two different pinks depending on where a component sits.
  - Six CSS modules define their own copies (`--ink`, `--muted`, `--rose`, `--accent`): `job-discovery`, `job-detail`, `activity`, `youth-navigation`, `profile.css` and `chat.module.css`.
  - **Drift:** `app/chats/chat.module.css` uses `--ink:#4e3341; --muted:#927887; --accent:#ac4066`, which are slightly different from the brand values. Chats therefore look subtly off-palette.
  - Leftover neutral palettes (`#1d1d1f`, `#6e6e73`, `#d2d2d7`, `#737373`, `#e8e8e8`) remain, mostly in `globals.css` (58 uses) and inline styles in TSX (18 files).
- **Fix:**
  1. Settle the values in `theme.css`. Pick one pink for `--color-surface-soft` and add the missing tokens that are in use: `--color-rose: #fce9ef`, `--color-plum-900: #241419` (the dark landing section), `--color-brand-accent: #dc6f8d`, `--color-warning: #7c5b08` and `--color-warning-soft: #fff5d9`.
  2. Delete the token block on `.mnw-product` and every local `--ink`/`--muted`/`--rose`/`--accent` definition, and point the modules at the global tokens.
  3. Replace hex literals with `var(--…)`, file by file, starting with chats (the drift) and `product-design.css`. A careful find-and-replace per value is enough, but review each diff.
  4. Add a check script, for example in `scripts/check-design-tokens.mjs`, that counts hex literals outside `theme.css` and fails if the number goes up.
- **Done when:** Only `theme.css` defines colour values (allowed exceptions: SVG illustrations and the map), the chat palette matches the rest, and the token check runs.

<a id="da-05"></a>
### DA-05 No type, radius or weight scale

- **Seen (code):** The CSS uses 93 different font sizes, 47 different border radii and 10 different font weights (400, 500, 550, 600, 650, 700, 750, 800, 850 and 900). There are 17 different negative letter-spacing values, from −.005em to −.085em. This is why pages feel close to each other but not quite the same.
- **Fix:** Add a small scale to `theme.css` and migrate to it as part of DA-04:

  ```css
  :root {
    /* Type */
    --text-xs: .75rem;   /* 12px — minimum for any visible text */
    --text-sm: .875rem;  /* 14px */
    --text-md: 1rem;     /* 16px — body, and every input to avoid iOS zoom */
    --text-lg: 1.25rem;
    --text-xl: 1.6rem;
    --text-2xl: clamp(1.9rem, 4vw, 2.6rem);
    --text-display: clamp(2.6rem, 7vw, 4.5rem);
    --tracking-tight: -.04em;
    --tracking-display: -.055em;
    /* Weight (Inter variable) */
    --weight-regular: 400;
    --weight-medium: 500;
    --weight-semibold: 600;
    --weight-bold: 700;
    /* Shape */
    --radius-sm: 10px;
    --radius-md: 14px;   /* buttons, inputs */
    --radius-lg: 22px;   /* cards */
    --radius-xl: 28px;   /* hero cards, dialogs */
    --radius-pill: 999px;
    /* Elevation */
    --shadow-sm: 0 5px 20px rgb(var(--color-text-rgb) / .03);
    --shadow-md: 0 18px 32px rgb(var(--color-text-rgb) / .09);
  }
  ```

- **Done when:** New and touched CSS uses only these values, and the number of distinct font sizes and radii goes down with each migrated file. Measure it with the same check script as DA-04.

<a id="da-06"></a>
### DA-06 Some text colours fail WCAG AA contrast

- **Measured:**

  | Text | Background | Ratio | AA for body text (4.5:1) |
  |---|---|---|---|
  | `--color-text-subtle` `#a57b88` | canvas `#fffafb` | 3.51 | Fails |
  | `--color-text-muted` `#896a76` | rose `#fce9ef` | 4.11 | Fails |
  | `--color-text-muted` `#896a76` | canvas `#fffafb` | 4.63 | Passes |
  | `--color-brand` `#b84164` | rose `#fce9ef` | 4.53 | Passes, barely |
  | white | `--color-brand` | 5.28 | Passes |

  `--color-text-subtle` (and its alias `--text-tertiary`) appears 20 times in the CSS, partly on body text. Muted text sits on rose surfaces in, for example, the CV banner, chips and status cards.
- **Fix:** Darken `--color-text-muted` to `#7f616d` (5.30 on canvas, 4.71 on `#fce9ef`, 4.96 on `#fff0f4`). Keep `--color-text-subtle` for icons, borders, placeholders and large text only, and stop using it for body text. Raise the smallest text to at least 12px (see DA-16).
- **Done when:** All body text meets 4.5:1 on its actual background, checked with Lighthouse or axe on the public pages and a sample of logged-in pages.

<a id="da-07"></a>
### DA-07 Shared supplied logo across the site

**Coordinate with D07.**

- **Implemented in dev — 2026-10-25:** Vilgot's supplied logo replaces the previous M marks and text-only logos through the shared `components/brand-logo.tsx`. Used in marketing navigation/footer, login/signup/password recovery, privacy, youth/company navigation, discovery, youth/company onboarding, the listing builder and admin. Component options are `variant="full" | "mark"` and `tone="inherit" | "light" | "dark"`. Full mode combines the supplied artwork with the MatchnWork name; mark mode gives the image its accessible name. The original artwork and colours are unchanged.
- **Delivery:** [PR #105](https://github.com/vilgotdidrikson/youth-job-mvp/pull/105), merge `ccf94bf`, deployed to dev. The same artwork also supplies DA-02's browser/app/share-image assets.
- **Verification:** TypeScript, targeted ESLint without errors, production build and accessibility/search/navigation/profile regressions pass. Public page HTML references the supplied logo; local production HTTP checks pass. Visual acceptance on desktop/mobile and authenticated surfaces remains; no browser screenshots or physical installation are claimed. Other D07 copy tasks remain open.

**Original audit finding (2026-10-22):**

- **Seen:** The landing nav and footer use the M mark plus wordmark. `/privacy` uses a pink text-only wordmark. The auth pages (`/login`, `/signup`, `/forgot-password`) have no logo at all, only "← Tillbaka". Admin uses a mark with an asymmetric radius, and the mobile discovery header uses a text-only brand *(from code)*.
- **Fix:** Create `components/brand-logo.tsx` with `variant="full" | "mark"` and `tone="inherit" | "light" | "dark"`, using the supplied original PNG rather than reconstructing an M mark. Use it in the marketing nav and footer, on the auth pages (centred above the card, linking to `/`), on `/privacy`, in the youth and company navigation, and in admin.
- **Done when:** One component draws the logo everywhere, and every public page shows it.

<a id="da-08"></a>
### DA-08 Three different footers, none linking to privacy

**Coordinate with F20.**

- **Implementation update — 2026-10-25 (klar, [PR #108](https://github.com/vilgotdidrikson/youth-job-mvp/pull/108), merge `a519de2`):** New shared `components/marketing-footer.tsx`, extracted from the landing footer, with the links Funktioner, Priser, Integritet (`/privacy`) and Logga in. Used on `/`, `/features` and `/pricing`; existing `landing-bold-footer` styles unchanged. `/signup` has a line under the submit button linking to `/privacy` (signup mode only, not login). The contact link waits for the contact address decision (D07). `/privacy` keeps its own footer until DA-09.
- **Verified:** TypeScript, ESLint on changed files, `test:accessibility`, `test:platform-visuals` and a production build (webpack). `check:design-tokens` fails identically with and without this change (pre-existing growth in `applications-design.css` and `brand-logo.module.css`); this change adds no colour literals or new type values. Chromium against a local production build at 375px and 1280px, 34/34: one identical footer with the privacy link on all three pages, no horizontal scroll, footer and signup links open `/privacy`, signup note under the button at ≥12px and absent on login, no page errors. The same 34/34 check passes against deployed dev (https://youth-job-mvp-dev.vercel.app) after the merge. Not checked in Safari/Firefox or on a physical phone.
- **Seen:** `/` has a full footer (logo, tagline, Funktioner/Priser/Logga in, ©). `/features` and `/pricing` use the same class but only show © and the tagline. `/privacy` has its own footer. No footer links to `/privacy`, and the signup page does not either.
- **Fix:** Extract `components/marketing-footer.tsx` from the landing footer, add "Integritet" (`/privacy`) and a contact link once the contact address is decided (D07), and use it on all three marketing pages. Add a short line under the signup button linking to the privacy page (F20).
- **Done when:** Every public page has the same footer, and privacy is one tap away from signup.

<a id="da-09"></a>
### DA-09 Privacy page assumes the visitor is logged in

**Coordinate with F20.**

- **Implementation update — 2026-10-25 (klar, [PR #110](https://github.com/vilgotdidrikson/youth-job-mvp/pull/110), merge `b69056c`):** `/privacy` now uses the shared `MarketingNav` and `MarketingFooter` for every visitor; the page's own header is removed. "Tillbaka till profilen" at the end of the policy is rendered by `app/privacy/privacy-profile-link.tsx` only when `useSession` has a user, so logged-out visitors see no profile link. Signed-in visitors get "Gå till appen" from the shared nav. The page stays a server component with its metadata. The legal-review note is unchanged and remains tracked under L10/L14.
- **Verified:** TypeScript, ESLint on `app/privacy`, `test:accessibility` and a production build (webpack). Chromium against a local production build, logged out, at 375px and 1280px, 26/26: shared nav and footer present, no profile link or "profilen" text, footer privacy link, title "Integritet och AI · MatchnWork", heading below the nav, legal note still shown, no horizontal scroll, mobile and desktop login/signup actions, no page errors. The same 26/26 check passes against deployed dev after the merge. Not verified with a signed-in account (no QA account used), in Safari/Firefox or on a physical phone.

- **Seen:** `/privacy` is public, but its header and footer link to "Till profilen" and "Tillbaka till profilen". A logged-out visitor gets sent to login. The page also shows publicly that the policy must be legally reviewed before production. That's fine on dev, but it needs to be gone or replaced before launch.
- **Fix:** Use the shared marketing nav and footer (DA-07, DA-08) for logged-out visitors, and keep the profile link only when there is a session (`useSession`). Track the legal-review note under L10/L14 so it is removed together with the final policy.
- **Files:** `app/privacy/page.tsx`

<a id="da-10"></a>
### DA-10 The landing background runs WebGL non-stop

**Coordinate with D05.**

- **Seen (code + browser):** `components/ui/velaris.tsx` runs a full-screen WebGL shader in a `fixed inset-0` canvas behind the whole landing page. It renders every frame with `requestAnimationFrame` for as long as the page is open, also when scrolled far below the hero and when the tab is hidden. It does not check `prefers-reduced-motion`. On mid-range Android phones, which much of the audience uses, this costs battery and makes scrolling heavier.
- **Fix:** Stop the loop when the hero is out of view (`IntersectionObserver`) and on `visibilitychange`. Render a single static frame, or a plain CSS gradient, when reduced motion is on. Cap the device pixel ratio at 1.5 on touch devices, and consider throttling to 30 fps.
- **Done when:** The Performance panel shows no animation frames while scrolled past the hero or with the tab hidden, and reduced motion gives a still background.

<a id="da-11"></a>
### DA-11 Client-rendered marketing pages and a global Mapbox stylesheet

- **Implementation update — 2026-10-26 (för granskning, branch `Max`):** `/`, `/features` and `/pricing` are server components with their own `metadata`; the title-only segment layouts are removed. The interactive parts are `app/landing-hero.tsx` (typed headline and session-aware buttons) and `app/pricing/pricing-plans.tsx` (audience switch and plans). The headline starts fully written, `NumberTicker` server-renders its final value, and a `<noscript>` style shows the scroll-revealed text without JavaScript. `platform-visuals.tsx` is a client module so each copy keeps its own SVG ids (otherwise DA-01 returns). The Mapbox CSS is imported in `components/job-map.tsx`, and the map control rule's specificity is raised because Mapbox now loads after the app CSS. Copy and animations are otherwise unchanged.
- **Verified:** TypeScript, ESLint, production build (webpack), `test:accessibility`, `test:map-fallback`, `test:local-fonts`. Local production builds before/after in Chromium: screenshots of `/`, `/features`, `/pricing`, `/login` at 375px and 1280px are pixel-identical; without JavaScript the landing page now shows its headline, stats and manifesto; no Mapbox stylesheet on `/`, `/features`, `/pricing`, `/login`, `/signup` or `/privacy`. Not yet done: Lighthouse mobile before/after on deployed dev, and a signed-in visual check of `/kartan`.

- **Seen (code):**
  - `app/page.tsx`, `app/features/page.tsx` and `app/pricing/page.tsx` all start with `"use client"`. All of their text is rendered by JavaScript, they cannot export `metadata` (blocking DA-02), and the first meaningful paint waits for the JS bundle.
  - `app/globals.css` line 1 imports `mapbox-gl/dist/mapbox-gl.css`, so every page, including the landing page and login, downloads the map stylesheet.
- **Fix:** Turn each marketing `page.tsx` into a server component that exports `metadata`, and move only the interactive parts (animated headline, background, platform showcase, pricing switch, session-aware buttons) into small client components. Move the Mapbox CSS import into `components/job-map.tsx`.
- **Done when:** The pages render their text without JavaScript, have their own metadata, and the Mapbox CSS only loads on routes with a map. Compare Lighthouse mobile scores before and after, on the deployed dev.

<a id="da-12"></a>
### DA-12 Legacy inline styles are reskinned through overrides

- **Seen (code):** The largest older views still style themselves inline: `components/youth-onboarding-flow.tsx` (2,024 lines, 213 `style={{…}}`), `app/company/page.tsx` (85), `app/company/onboarding/page.tsx` (53), `app/profile/page.tsx` (20), `components/voice-cv-interview.tsx` (17). To make them match the new design, `app/product-design.css` overrides them with about 50 lines of `!important` declarations and attribute selectors such as `.mnw-product [style*="color: #737373"]`. There are about 145 `!important` lines across the CSS. It works today, but any change to an inline value silently breaks the override, and the cascade is hard to reason about.
- **Fix:** Migrate one view at a time into a CSS module that uses the DA-04 and DA-05 tokens, and delete the matching overrides from `product-design.css` in the same PR. Start with `app/company/page.tsx` (company-facing, frequently changed) and leave `youth-onboarding-flow.tsx` for last, because it is the largest. This also helps the planned React Native/Expo app, since styling no longer lives inside the logic.
- **Done when:** Each migrated view has no inline colour or spacing styles, and its overrides are gone from `product-design.css`.

---

## P3 — polish

<a id="da-13"></a>
### DA-13 Pricing: the main call to action looks secondary

- **Implementation update — 2026-10-25 (klar, [PR #111](https://github.com/vilgotdidrikson/youth-job-mvp/pull/111), merge `ba70209`):** `PricingPlan` in `lib/pricing-data.ts` has an optional `highlighted` flag, set on the only youth plan and the only company plan. `app/pricing/page.tsx` adds `pricing-cta-highlighted` to that plan's "Kom igång gratis", so it is a filled brand button; a matching hover rule keeps it filled (`--color-brand-hover`) instead of falling back to the light outline hover. Below 720px the grid's bottom padding is 2rem and the footer's top margin 1rem, so the card-to-footer gap drops from 121px to 48px; the desktop spacing is unchanged. Prices, texts and links are unchanged (F06 untouched).
- **Verified:** TypeScript, ESLint on `app/pricing` and `lib/pricing-data.ts`, production build (webpack); `check:design-tokens` reports the same counts as dev. Chromium against a local production build at 375px and 1280px, both tabs, 34/34: one highlighted CTA with unchanged text and link, brand fill with white text (contrast ≥ 4.5:1, also on hover), mobile gap ≤ 60px, desktop gap ≥ 80px, no horizontal scroll, no page errors. The same 34/34 check passes against deployed dev after the merge. Not checked in Safari/Firefox or on a physical phone.

- **Seen:** On `/pricing` (youth tab), the only plan's "Kom igång gratis" is a white outlined button. `.pricing-cta-highlighted` exists in `app/pricing/pricing.css` but is never applied. On mobile there is a large empty gap between the card and the footer. Do not change the price explanation itself; that belongs to F06, which is blocked.
- **Fix:** Apply the highlighted style to the recommended plan (add a `highlighted` flag to the plan data in `lib/pricing-data.ts`), and tighten the bottom spacing.

<a id="da-14"></a>
### DA-14 Auth pages: card-in-card, a misleading arrow and text glyphs

- **Implementation update — 2026-10-25 (klar, [PR #112](https://github.com/vilgotdidrikson/youth-job-mvp/pull/112), merge `8c2be47`):** Below 480px the auth card on `/login`, `/signup`, `/forgot-password` and `/reset-password` has no border, background or shadow and no side padding, so the form uses the full page width; desktop keeps the card. The "↗" in all auth submit buttons and links is now `UiIcon name="arrow"`, and the "←" in the back links is `UiIcon name="chevron-left"`. On the marketing pages the hero "→" (`/`), the plan "✓" (`/pricing`) and the process "→" (`/features`) are `UiIcon`. The logo above the auth heading was already in place (DA-07); the role choice is left to F23. Not changed: the decorative platform symbols on `/` and the "✦"/"↓" on `/features` (DA-15 covers that page's icons).
- **Verified:** TypeScript, ESLint on the changed files, `test:accessibility` and a production build (webpack); `check:design-tokens` reports the same counts as dev. Chromium against a local production build at 375px and 1280px, 79/79: no ↗ ← → ✓ text on the four auth pages, svg icons in submit and back controls, back controls ≥ 44px tall, no card border or shadow and form/inputs ≥ 88–90% of the width at 375px, card border kept at 1280px, svg icons in the hero, plan and process spots, no horizontal scroll, no page errors. The same 79/79 check passes against deployed dev after the merge. `/reset-password` was only checked in its invalid-link state; not checked in Safari/Firefox or on a physical phone.

- **Seen:** On mobile, `/login`, `/signup` and `/forgot-password` place a bordered card inside a 16px page margin. That leaves the form about 70% of the screen width and makes the screen feel boxed in. The submit buttons end in "↗" (in `components/auth-page.tsx` line 164, `app/forgot-password/page.tsx` and `app/reset-password/page.tsx`), a symbol people usually read as "opens an external site". Elsewhere the app uses text glyphs (✓, →, ↗) even though `components/ui-icon.tsx` has a matching icon set.
- **Fix:** Below 480px, drop the card border and shadow and let the form use the full width. Show the logo above the heading (DA-07). Remove the "↗", or use `UiIcon name="arrow"`. Replace text glyphs with `UiIcon` across the marketing and auth pages. Leave the role choice to F23.

<a id="da-15"></a>
### DA-15 The features page is long and repetitive

- **Seen:** `/features` is twelve visually identical white cards stacked on mobile. The same sparkle icon is used for "Swipea jobb", "Smart jobbmatchning" and "AI-matchning", and an info icon stands for "AI-screening". Most of the content repeats the landing page.
- **Fix:** Give each feature its own icon, group the cards into a two-column grid from 640px, and lead each audience section with one real product visual (the same swipe card as DA-03 for youth, and the candidate view for companies) instead of a twelfth card. Alternatively, merge the page into the landing page and pricing.

<a id="da-16"></a>
### DA-16 Small text and touch targets on mobile

- **Seen:** At 375px the footer links are 20px tall, and the logo link is 32px tall. In discovery *(from code)* the filter chips are 34px tall, the CV banner text is .71rem (11.4px) and the card chips are .68rem (10.9px). On the landing page the source line is 10.9px.
- **Fix:** Make every tappable element at least 44×44px (padding is enough; the visual size can stay). Never go below `--text-xs` (12px) for visible text.

<a id="da-17"></a>
### DA-17 The landing page ends without a call to action

**Coordinate with D05.**

- **Seen:** After "Potential syns inte alltid i ett tomt CV." the page goes straight to the footer. `/features` ends with a "Kom igång" button, but the landing page does not.
- **Fix:** Add a closing block with the primary "Kom igång" button and a secondary "För företag" link, reusing the existing `.landing-bold-primary` styles.

---

## Decision needed

<a id="da-18"></a>
### DA-18 Logged-out visitors cannot see any jobs

`/swipe` redirects to login, so someone arriving from a shared link or an ad cannot see a single job before creating an account. For a two-sided marketplace in its cold-start phase, a public preview of a few real, published listings (read-only, no applying) is one of the strongest conversion levers. It is a product and privacy decision, not a bug. It only concerns published job content, never youth data. Decide it together with F26/N19, which already define what job information is public.

---

## Already good

Keep these when making changes: the rose and plum palette and Inter typography are coherent; the swipe card design and its responsive height (`clamp(310px, calc(100svh - 290px), 460px)`) are strong; reduced-motion handling exists in most modules; native dialogs give focus containment; forms use 16px inputs; and no horizontal overflow showed up at 375px on the public pages.
