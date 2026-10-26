# MatchnWork fonts

These are the unmodified WOFF2 assets emitted by the successful Next.js 16.2.3
Webpack build of MatchnWork on 2026-10-26. `manifest.json` records each original
build filename, SHA-256, family and Unicode range. All emitted Inter and Fraunces
subsets are retained. The Latin files contain ÅÄÖ/åäö (inspected with Fontkit).
`app/fonts.css` preserves the generated font weights, Unicode ranges, swap
behaviour and Arial/Times New Roman fallback metrics. The layout preloads the
same two Latin subsets. No font discovery/download is needed during builds.

Fonts are distributed under SIL Open Font License 1.1; see `inter-OFL.txt` and
`fraunces-OFL.txt`. Upstream license sources:

- https://github.com/google/fonts/blob/main/ofl/inter/OFL.txt
- https://github.com/google/fonts/blob/main/ofl/fraunces/OFL.txt

Run `npm run test:local-fonts` to check integrity and declarations. When updating
fonts, review the upstream license, preserve script coverage and fallback metrics,
and verify the visual result before updating the integrity manifest.
