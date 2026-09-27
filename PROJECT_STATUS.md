# Renoki — Project Status

_Last updated: 27 Sep 2026 (Stage 2 draft)_

## Current stage: 2 — Auth + profiles (draft complete)

## Completed
### Stage 1 — Architecture & setup
- Working dir `~/Claude/Renoki-clean`; git initialised on `main`.
- Stage 1 schema & storage migrations in `supabase/migrations/`.
- 57/57 RLS tests in `supabase/tests/`.
- App shell: React + TS + Vite + Tailwind, mobile-first bottom nav (Discover / Search / Create / Saved / Profile).
- "Reading Room" design system: cream paper, ink text, Newsreader serif, terracotta accents.
- Supabase client + env (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`).
- Auth (email/password), `AuthProvider`, `ProtectedRoute`.
- Discover feed reads real `entries` + `entry_images`.

### Stage 2 — Auth polish + profiles
- Profile page shows any user (`/u/:username`), edit-mode gated to the owner.
- Editable fields: username (with regex + uniqueness check), display name, bio, avatar.
- Avatar upload: client-side WebP resize (max 512px), 2MB cap, uploaded to `avatars/<uid>/...`.
- Sign-out available from profile.
- Helpers: `src/lib/image.ts` (resize/strip-EXIF), `src/lib/storage.ts` (public URLs).

## In progress
- Push to GitHub (needs the empty repo URL from you).
- Applying migrations to the Supabase project (needs project URL + anon key + SQL editor).

## Next steps
1. Empty GitHub repo → paste URL → I walk you through `git push`.
2. `.env` filled with your Supabase URL + anon key → run both migration files in SQL Editor in order.
3. Stage 3: Create entry + client-side image resize + preview.

## Known issues / risks
- Discover feed will show a "couldn't reach Supabase" hint until `.env` is real and migrations applied.
- Original `~/Claude/Renoki` folder retained but has neutralised stubs from an earlier delete attempt (host perms). Ignore it — canonical work is `~/Claude/Renoki-clean`.
- Vercel Hobby is non-commercial only.

## Key decisions
| Decision | Reason |
|---|---|
| Avatar resize client-side to WebP, 512px max | Supabase image transforms are paid |
| Username regex `^[a-z0-9_]{3,24}$` | Predictable URLs, no unicode footguns |
| Upsert avatar under `<uid>/avatar-<ts>.webp` | Human-readable, no orphans if user re-uploads |
| Public buckets, client builds URL | Free, avoids signed-URL round-trips |
