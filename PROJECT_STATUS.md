# Renoki — Project Status

_Last updated: 27 Sep 2026 (Stage 3 draft)_

## Current stage: 3 — Create entries + image upload (draft complete)

## Completed
### Stage 1 — Architecture & setup ✓
### Stage 2 — Auth polish + profiles ✓
### Stage 3 — Create entry + image upload
- `Create.tsx` published: title, body, source URL (http(s) only), category, up to 8 tags, up to 6 images.
- Client-side WebP resize for every image: `display` ≤ 1600px, `thumb` ≤ 640px. EXIF stripped via canvas re-encode.
- Uploads land under `entry-images/<uid>/<entry-id>/<i>-{display|thumb}.webp`.
- Alt text required on every image (accessibility).
- Tags go through the `set_entry_tags` RPC (server enforces max 8 + creates missing tag rows).

## In progress
- User to supply Supabase project URL + anon key so `.env` can be filled.
- User to run the two migrations in Supabase SQL Editor.
- Once above two are done: end-to-end test of Create → Discover → EntryDetail.

## Next steps
1. Live Supabase → I fill `.env` and verify the app boots against it.
2. Stage 4: Discover feed polish (infinite scroll, lazy images, fixed aspect ratios) + EntryDetail polish (image carousel, source-link chip).
3. Stage 5: Edit/delete own entries with storage cleanup.
4. Stage 6: Likes / comments / saves (optimistic UI).
5. Stage 7: Search + categories + tags pages.
6. Stage 8: Responsive + a11y polish.
7. Stage 9: Security review.
8. Stage 10: Deploy to Vercel.

## Known issues / risks
- Auth confirm-email flow depends on Supabase email settings — user may need to disable email confirmation in Supabase → Auth → Providers for painless local testing.
- Deleted entries' storage files aren't cleaned up yet (Stage 5).
- No rate-limiting on Create (per free tier, mitigated by RLS + reasonable client throttling later).
