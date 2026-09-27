# Renoki — things worth knowing

Mobile-first, image-forward social discovery app. Turn interesting facts, ideas and discoveries into beautiful visual entries.

## Stack
React + TypeScript + Vite + Tailwind + shadcn-compatible primitives.
Supabase Free (auth + Postgres + Storage). Vercel Hobby for hosting.

## Local setup
```bash
cp .env.example .env    # then fill VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
npm install
npm run dev
```

## Supabase
Apply the migrations in `supabase/migrations/` via the Supabase SQL editor
(or CLI). The RLS security test suite lives in `supabase/tests/`:
```bash
npm run test:rls
```

## Docs
- `docs/ARCHITECTURE.md` — schema, RLS, storage, decisions.
- `PROJECT_STATUS.md` — what's done, what's next.
