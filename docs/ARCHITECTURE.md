# Renoki — Architecture

> "I opened the app and immediately learned something interesting."

## Stack (all free tier)

| Layer | Choice | Why |
|---|---|---|
| Frontend | React + TypeScript + Vite + Tailwind + shadcn/ui | Same stack Lovable generates, so Lovable can still edit the repo |
| Hosting | Vercel Hobby | Free; auto-deploys from GitHub |
| Auth | Supabase Auth (email + password) | Free up to 50k monthly active users |
| Database | Supabase Postgres + Row Level Security | Security enforced in the database, not only in the UI |
| Images | Supabase Storage (public buckets) | Real uploads; no paid image service |
| Code | GitHub (`Remoki` repo) | Source of truth; Vercel deploys from `main` |
| Lovable | Optional, for visual iteration | Not required for anything to work |

No AI APIs, no paid services, no extra backend server.

## Data model

```
auth.users 1─1 profiles 1─* entries 1─* entry_images   (max 6, ordered)
                        │           ├─* entry_tags *─1 tags   (max 8)
                        │           ├─* comments
                        ├─* likes ──┘
                        ├─* saved_entries (private)
                        └─* reports  (entry OR comment)
categories 1─* entries  (curated list, seeded)
```

Counters (`like_count`, `comment_count`, `save_count`) live on `entries` and are kept correct by database triggers, so the feed never needs expensive counts.

## Security model

1. **RLS on every table.** Anyone can read published content; only signed-in users write; only owners edit or delete.
2. **Column-level grants.** The browser can only write content columns (title, body and so on). `author_id`, counters and moderation `status` cannot be set or changed by any client request, even a hand-crafted one.
3. **Storage paths are owned.** Files must go under `<user_id>/…`. Storage policies and a DB trigger both enforce this, and image rows must point inside `<owner>/<entry_id>/`.
4. **Bucket limits.** 5 MB per entry image and 2 MB per avatar, JPEG/PNG/WebP only, enforced by Supabase, not just the UI.
5. **XSS.** Entry bodies are stored as plain text (with light Markdown later, if ever) and rendered as text by React. We never use `dangerouslySetInnerHTML`. Source URLs must be `http(s)://`.
6. **Secrets.** Only the public `anon` key and URL go in the frontend (via `VITE_` env vars). The `service_role` key is never used in the app or committed.
7. **Moderation hooks.** `status` on entries/comments (`published`/`hidden`) and a `reports` table. A future admin tool flips `status`; nothing else changes.

The rules are tested in `supabase/tests/rls.test.mjs` (57 checks, real Postgres via PGlite).

## Images

- The client resizes before upload: **display ≤1600px** and **thumb ≤640px**, both WebP, and strips EXIF (including GPS) as a side-effect of re-encoding.
- The feed loads only thumbs (`loading="lazy"`, width/height set so nothing jumps). The entry page loads display size.
- Supabase's on-the-fly image transformations are a **paid (Pro) feature**, which is why we pre-generate sizes instead.
- Path: `entry-images/<user_id>/<entry_id>/<uuid>.webp` + `<uuid>_t.webp`.

## Free-tier limits to watch

| Limit | Free allowance | What uses it | Risk |
|---|---|---|---|
| Supabase file storage | 1 GB | Images (~250 KB display + ~50 KB thumb ≈ 0.3 MB per image → ~3,000 images) | Medium once real users arrive |
| Supabase egress | 5 GB/month | Image views | Main risk if something goes viral; thumbs keep it low |
| Supabase DB | 500 MB | Text rows | Low |
| Supabase pausing | Paused after 1 week idle | — | Visit or ping weekly during quiet periods |
| Vercel Hobby | Free, **non-commercial only** | Hosting | Must move to Pro ($20/mo) if Renoki earns money |
| Lovable Free | 5 credits/day, 30/month | Optional edits | Don't depend on it |

Nothing here costs money until these limits are exceeded; Supabase Free stops (rather than bills) when limits are hit.

## Extensibility

Designed so these can be added without restructuring: follows (`follows` table), notifications, collections (`collections` + `collection_entries`), reactions (generalise `likes` with a `kind`), threaded comments (`parent_id` already exists), admin/moderation (flip `status`, read `reports`), trending (a ranking over existing counters).
