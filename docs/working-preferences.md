# MatchnWork development preferences

The user explicitly requires cost-effective work (2026-10-05):

- Read relevant files and diffs rather than repeatedly scanning the repository.
- Group related changes; run focused checks and one production build per coherent block.
- Use the terminal and GitHub connector for commits and delivery. Use browser automation only for meaningful UX verification or a necessary fallback.
- Avoid redundant tool calls, repeated status checks, and unnecessary confirmation requests for authorized actions.
- Preserve required security checks and correctness; cost efficiency does not justify skipping necessary verification.
- Default to `dev`, DevStaging, and the development deployment. Honor explicit branch overrides; leave production untouched.
- Keep backend logic, shared types, and validation reusable for a future React Native/Expo app.
