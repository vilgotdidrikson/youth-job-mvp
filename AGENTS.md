# MatchnWork environment targeting

Verified on 2026-11-02 against both connected Supabase accounts, following the user's explicit environment mapping.

| Supabase connection | Environment | Supabase project | Project reference | Frontend branch |
| --- | --- | --- | --- | --- |
| Primary | Production | MatchnWork | iarnopkuoqumictgnqin | master (also called main by the user) |
| Secondary | Development / staging | MatchnWork DevStaging | vwcfjvwfeatvuisojwrh | dev |

- Always select the matching connection explicitly and verify the project reference before database or Edge Function changes. Do not select whichever connection is the default.
- Production waitlist/signup work belongs to Primary / MatchnWork. Do not store production signups in DevStaging or substitute another database provider without the user's approval.
- Keep production and development data and credentials separate.
- Work in dev/staging by default. Changes to master/production require the user's authorization; the user explicitly authorized the production prelaunch signup page, fictional interactive demo, isolated waitlist storage, and protected contact export in this conversation. This does not authorize unrelated production changes or sending launch emails now.

