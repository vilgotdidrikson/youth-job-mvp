# Employo Youth Jobs MVP

Mobile-first web app for youth (ages 12-20 in Sweden) and companies offering part-time, temporary, and summer jobs.

## Stack

- Next.js (App Router, TypeScript)
- Tailwind CSS v4
- JSON file persistence (`data/db.json`) as MVP database

## Implemented MVP Features

- Youth onboarding: name, age, city, skills, interests, availability
- AI-style CV builder (local logic): chat intake + tailored summary + 1-page CV text
- CV quality scoring, keyword extraction, and improvement tips
- Youth profile with strength indicator
- Company dashboard with job posting and listing management
- Swipe-like job actions for youth: interested / skip
- Two-sided matching: youth interest + company accept = match
- Company candidate review: accept / reject
- Notifications: profile views, interests, decisions, matches
- Monetization-ready logic:
  - Company free posting limit
  - Mock premium tier toggle
  - Youth optional premium badge
- Basic admin dashboard with platform stats

## Demo Accounts

- Youth: `demo@youth.se` / `demo123`
- Company: `demo@company.se` / `demo123`
- Admin: `admin@workspot.se` / `admin123`

## Run

```bash
npm install
cp .env.example .env.local
npm run dev
```

Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local` before starting the app.

For the job map, also add a public Mapbox access token:

```bash
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.your_mapbox_public_token
# Optional: use your own Mapbox Studio style instead of Streets v12
NEXT_PUBLIC_MAPBOX_STYLE_URL=mapbox://styles/your-user/your-style-id
```

Apply `supabase/migrations/20260802_add_job_map_locations.sql` before publishing jobs with precise map locations.

For production, add the same `NEXT_PUBLIC_...` variables in the hosting provider's environment-variable settings and redeploy. `.env.local` is only used by the local Next.js process and is intentionally not committed.

Open `http://localhost:3000`.

## Notes

- All `/api/*` routes are built into this Next.js app (`app/api/*`), no separate backend service needed.
- Authentication is MVP-only (email/password stored in JSON without hashing).
- "Google sign-in" is mocked in UI as a future feature.
- PDF download uses browser print flow (`Save as PDF`).
- Data persists to `data/db.json` once routes are called.
