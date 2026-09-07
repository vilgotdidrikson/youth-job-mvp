# Employo Youth Jobs MVP

Mobile-first web app for youth (ages 12-20 in Sweden) and companies offering part-time, temporary, and summer jobs.

## Stack

- Next.js (App Router, TypeScript)
- Tailwind CSS v4
- Supabase Auth, Postgres, Storage and Realtime

## Implemented MVP Features

- Youth onboarding: name, age, city, skills, interests, availability
- Structured and voice-assisted CV creation, grounded in user-provided facts
- Youth profile with strength indicator
- Company dashboard with job posting and listing management
- Swipe-like job actions for youth: interested / skip
- Two-sided matching: youth interest + company accept = match
- Company candidate review: accept / reject
- In-app notifications for interests, matches, messages and recruitment updates
- Private one-off tasks and in-app notifications

## Run

```bash
npm install
cp .env.example .env.local
npm run dev
```

Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` and, for self-service account deletion, `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`. Never expose the service-role key to the browser.

For the job map, also add a public Mapbox access token:

```bash
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.your_mapbox_public_token
# Optional: use your own Mapbox Studio style instead of Streets v12
NEXT_PUBLIC_MAPBOX_STYLE_URL=mapbox://styles/your-user/your-style-id
```

Apply every migration in `supabase/migrations` in filename order. The final release-hardening migration is `20260907_mvp_release_security.sql`; it must be applied in staging and verified with separate youth, company and private test accounts before production.

For production, add the same `NEXT_PUBLIC_...` variables in the hosting provider's environment-variable settings and redeploy. `.env.local` is only used by the local Next.js process and is intentionally not committed.

Open `http://localhost:3000`.

## Notes

- All `/api/*` routes are built into this Next.js app (`app/api/*`), no separate backend service needed.
- Authentication uses Supabase email/password sessions and row-level security.
- AI endpoints require a valid Supabase session and use database-backed hourly quotas.
- Youth documents are private Storage objects and are opened through signed URLs.
- PDF download uses browser print flow (`Save as PDF`).
