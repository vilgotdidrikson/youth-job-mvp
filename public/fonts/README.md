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

## PDF faces

`cv-inter-regular.ttf` (400) and `cv-inter-semibold.ttf` (600) are static instances
of the pinned Inter Latin WOFF2, for embedding in CV exports. WOFF2 variable-font
subsetting is not supported reliably by the PDF renderer. The derivative faces
retain the source license/copyright and have distinct static PostScript names.
See `cv-manifest.json` for integrity and source identity. Regenerate using
`python scripts/generate-cv-pdf-fonts.py` with fontTools and Node.js installed;
no network download is used. Review the generated PDFs and update the manifest
only when deliberately replacing these faces. The web-font assets are unchanged.
