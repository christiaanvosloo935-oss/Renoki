# Renoki — Project Status

_Last updated: 27 Sep 2026 (evening)_

## Current stage: 1 — Architecture & project setup (near complete)

## Completed
- Database schema (Stage 1) applied to repo: `supabase/migrations/20260927000001_core_schema.sql` and `20260927000002_storage.sql`.
- 57/57 RLS security tests still passing (`npm run test:rls`).
- Working directory `~/Claude/Renoki` set up from the local `renoki-app` base and reconciled with Stage 1 schema.
- App shell rewritten for Stage 1:
  - Env vars renamed to `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (matches brief).
  - Design system: warm "Reading Room" palette (paper, ink, teal, terracotta, gold) with Newsreader serif headings.
  - Mobile-first bottom nav: Discover / Search / Create / Saved / Profile.
  - Routes: `/`, `/search`, `/create`, `/saved`, `/e/:id`, `/u/:username`, `/login`, `/signup`.
  - Auth (email/password) wired to Supabase; `ProtectedRoute` in place.
  - Discover feed reads real `entries` from Supabase (falls back to empty state if migrations not applied).
  - Old-schema pages (Home/Fields/Members/NewDiscovery/DiscoveryDetail) and components (DiscoveryCard/CommentThread/FieldPill/RatingStars) neutralized to no-op stubs — filesystem permissions prevent hard-delete; safe to remove manually.

## In progress
- Applying Stage 1 migrations to the live Supabase project (needs the user's project URL + anon key + SQL editor).
- Creating a fresh empty GitHub repo (`Renoki`) and pushing the first commit.

## Next steps
1. User creates empty `Renoki` repo on GitHub (or via Lovable). Provide the URL.
2. `npm install`, verify `npm run build` succeeds, `git init` + first commit "Stage 1: base + schema".
3. Add the repo as `origin`, push `main`.
4. Apply the two migrations to the Supabase project via SQL editor.
5. Stage 2: auth polish (edit username / display name / bio / avatar).

## Known issues / risks
- No live Supabase env in `.env` yet — Discover will show a connection error until `.env` is filled and migrations applied.
- Dead stubs still exist under `src/pages` and `src/components` because host filesystem denies delete. Remove manually next time.
- Vercel Hobby is non-commercial only.

## Key decisions
| Decision | Reason |
|---|---|
| Adopt Stage 1 schema, rewrite UI | Matches "polished consumer product, image-forward" brief; old fields/discoveries/ratings model was too simple. |
| Bottom nav on all widths | Mobile-first product; keeps nav consistent when opened on desktop. |
| Public buckets, construct URLs client-side | Free, avoids paid Supabase image transforms. |
| Env var name `VITE_SUPABASE_ANON_KEY` | Matches brief; not `VITE_SUPABASE_PUBLISHABLE_KEY` from prior scaffold. |
| Neutralize old dead files instead of deleting | Host permissions block delete; no-op stubs let build pass. |
