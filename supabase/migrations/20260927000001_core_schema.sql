-- =====================================================================
-- Renoki — core schema (MVP)
-- Tables: profiles, categories, entries, entry_images, tags, entry_tags,
--         likes, saved_entries, comments, reports
-- Security model:
--   * RLS on every table.
--   * Column-level GRANTs so clients can only write "content" columns;
--     ownership (author_id), counters and moderation status can never be
--     set or changed from the browser, even with a hand-crafted request.
--   * Counters maintained by SECURITY DEFINER triggers.
-- Idempotent where practical; run once in the Supabase SQL editor or via
-- `supabase db push`.
-- =====================================================================

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- profiles (1:1 with auth.users)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  username      text not null unique
                check (username ~ '^[a-z0-9_]{3,24}$'),
  display_name  text not null
                check (char_length(btrim(display_name)) between 1 and 50),
  bio           text not null default ''
                check (char_length(bio) <= 280),
  avatar_path   text
                check (avatar_path is null or char_length(avatar_path) <= 300),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Avatar must live in the user's own folder of the avatars bucket.
alter table public.profiles
  add constraint profiles_avatar_in_own_folder
  check (avatar_path is null or avatar_path like (id::text || '/%'));

-- Auto-create a profile when a user signs up.
-- Username comes from sign-up metadata if valid and free, else generated.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  wanted   text := lower(coalesce(new.raw_user_meta_data ->> 'username', ''));
  display  text := btrim(coalesce(new.raw_user_meta_data ->> 'display_name', ''));
  final_u  text;
begin
  if wanted ~ '^[a-z0-9_]{3,24}$' then
    final_u := wanted;
  else
    final_u := 'user_' || substr(md5(new.id::text), 1, 10);
  end if;

  if char_length(display) = 0 or char_length(display) > 50 then
    display := null;  -- filled with the final username below
  end if;

  -- Retry with a random suffix if the username is taken (incl. races).
  for attempt in 1..5 loop
    begin
      insert into public.profiles (id, username, display_name)
      values (new.id, final_u, coalesce(display, final_u));
      return new;
    exception when unique_violation then
      final_u := 'user_' || substr(md5(new.id::text || random()::text), 1, 10);
    end;
  end loop;
  raise exception 'could not allocate a username';
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- categories (curated; managed via SQL/admin only)
-- ---------------------------------------------------------------------
create table if not exists public.categories (
  id          smallint generated always as identity primary key,
  slug        text not null unique check (slug ~ '^[a-z0-9-]{2,40}$'),
  name        text not null unique,
  emoji       text,
  sort_order  smallint not null default 0
);

insert into public.categories (slug, name, emoji, sort_order) values
  ('science',     'Science',     '🔬', 10),
  ('nature',      'Nature',      '🌿', 20),
  ('animals',     'Animals',     '🦩', 30),
  ('history',     'History',     '🏛️', 40),
  ('medicine',    'Medicine',    '🩺', 50),
  ('psychology',  'Psychology',  '🧠', 60),
  ('technology',  'Technology',  '💡', 70),
  ('space',       'Space',       '🪐', 80),
  ('culture',     'Culture',     '🎭', 90),
  ('places',      'Places',      '🗺️', 100),
  ('language',    'Language',    '🔤', 110),
  ('ideas',       'Ideas',       '✨', 120)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------
-- entries
-- ---------------------------------------------------------------------
create table if not exists public.entries (
  id             uuid primary key default gen_random_uuid(),
  author_id      uuid not null default auth.uid()
                 references public.profiles (id) on delete cascade,
  title          text not null check (char_length(btrim(title)) between 3 and 140),
  excerpt        text not null default '' check (char_length(excerpt) <= 280),
  body           text not null default '' check (char_length(body) <= 20000),
  category_id    smallint references public.categories (id) on delete set null,
  source_url     text check (
                   source_url is null
                   or (source_url ~* '^https?://[^\s]+$' and char_length(source_url) <= 500)
                 ),
  source_label   text check (source_label is null or char_length(source_label) <= 120),
  -- moderation hook: 'published' | 'hidden' (hidden = only author sees it)
  status         text not null default 'published'
                 check (status in ('published', 'hidden')),
  like_count     integer not null default 0 check (like_count >= 0),
  comment_count  integer not null default 0 check (comment_count >= 0),
  save_count     integer not null default 0 check (save_count >= 0),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  search         tsvector generated always as (
                   setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
                   setweight(to_tsvector('english', coalesce(excerpt, '')), 'B') ||
                   setweight(to_tsvector('english', coalesce(body, '')), 'C')
                 ) stored
);

create index if not exists entries_created_idx   on public.entries (created_at desc) where status = 'published';
create index if not exists entries_author_idx    on public.entries (author_id, created_at desc);
create index if not exists entries_category_idx  on public.entries (category_id, created_at desc);
create index if not exists entries_search_idx    on public.entries using gin (search);
create index if not exists entries_title_trgm    on public.entries using gin (title extensions.gin_trgm_ops);

-- ---------------------------------------------------------------------
-- entry_images (ordered, up to 6 per entry)
-- Files live in Storage bucket `entry-images` under `<user_id>/<entry_id>/...`.
-- `path` = display size (<=1600px), `thumb_path` = feed size (<=640px).
-- ---------------------------------------------------------------------
create table if not exists public.entry_images (
  id          uuid primary key default gen_random_uuid(),
  entry_id    uuid not null references public.entries (id) on delete cascade,
  path        text not null unique check (char_length(path) <= 300),
  thumb_path  text not null check (char_length(thumb_path) <= 300),
  alt_text    text not null default '' check (char_length(alt_text) <= 300),
  width       integer check (width  is null or width  between 1 and 10000),
  height      integer check (height is null or height between 1 and 10000),
  position    smallint not null default 0 check (position between 0 and 5),
  created_at  timestamptz not null default now()
);

create index if not exists entry_images_entry_idx on public.entry_images (entry_id, position);

create or replace function public.enforce_entry_image_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner uuid;
begin
  select e.author_id into owner from public.entries e where e.id = new.entry_id;
  -- Paths must be inside the entry owner's folder for this entry.
  if new.path       not like owner::text || '/' || new.entry_id::text || '/%'
  or new.thumb_path not like owner::text || '/' || new.entry_id::text || '/%' then
    raise exception 'image path must be inside <owner>/<entry>/' using errcode = '42501';
  end if;
  if tg_op = 'INSERT'
     and (select count(*) from public.entry_images i where i.entry_id = new.entry_id) >= 6 then
    raise exception 'an entry can have at most 6 images' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger entry_images_rules
  before insert or update on public.entry_images
  for each row execute function public.enforce_entry_image_rules();

-- ---------------------------------------------------------------------
-- tags + entry_tags (max 8 tags per entry)
-- ---------------------------------------------------------------------
create table if not exists public.tags (
  id          bigint generated always as identity primary key,
  name        text not null unique check (name ~ '^[a-z0-9][a-z0-9-]{0,29}$'),
  created_at  timestamptz not null default now()
);

create table if not exists public.entry_tags (
  entry_id  uuid   not null references public.entries (id) on delete cascade,
  tag_id    bigint not null references public.tags (id) on delete cascade,
  primary key (entry_id, tag_id)
);
create index if not exists entry_tags_tag_idx on public.entry_tags (tag_id);

create or replace function public.enforce_tag_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.entry_tags t where t.entry_id = new.entry_id) >= 8 then
    raise exception 'an entry can have at most 8 tags' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger entry_tags_limit
  before insert on public.entry_tags
  for each row execute function public.enforce_tag_limit();

-- Replace an entry's tags in one call (normalises + creates tags as needed).
-- SECURITY INVOKER: RLS still decides whether the caller owns the entry.
create or replace function public.set_entry_tags(p_entry_id uuid, p_tags text[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  clean text[];
begin
  if not exists (
    select 1 from public.entries e
    where e.id = p_entry_id and e.author_id = (select auth.uid())
  ) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  select coalesce(array_agg(distinct t), '{}') into clean
  from (
    select left(regexp_replace(regexp_replace(lower(btrim(x)), '[\s_]+', '-', 'g'),
                               '[^a-z0-9-]', '', 'g'), 30) as t
    from unnest(coalesce(p_tags, '{}')) as x
  ) s
  where t ~ '^[a-z0-9][a-z0-9-]{0,29}$';

  if cardinality(clean) > 8 then
    raise exception 'an entry can have at most 8 tags' using errcode = '23514';
  end if;

  insert into public.tags (name)
  select unnest(clean)
  on conflict (name) do nothing;

  delete from public.entry_tags where entry_id = p_entry_id;

  insert into public.entry_tags (entry_id, tag_id)
  select p_entry_id, t.id from public.tags t where t.name = any (clean);
end;
$$;

-- ---------------------------------------------------------------------
-- likes / saved_entries
-- ---------------------------------------------------------------------
create table if not exists public.likes (
  user_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  entry_id    uuid not null references public.entries (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, entry_id)
);
create index if not exists likes_entry_idx on public.likes (entry_id);

create table if not exists public.saved_entries (
  user_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  entry_id    uuid not null references public.entries (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, entry_id)
);
create index if not exists saved_entries_user_idx on public.saved_entries (user_id, created_at desc);

-- ---------------------------------------------------------------------
-- comments (flat for MVP; parent_id reserved for threading later)
-- ---------------------------------------------------------------------
create table if not exists public.comments (
  id          uuid primary key default gen_random_uuid(),
  entry_id    uuid not null references public.entries (id) on delete cascade,
  author_id   uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  parent_id   uuid references public.comments (id) on delete cascade,
  body        text not null check (char_length(btrim(body)) between 1 and 2000),
  status      text not null default 'published' check (status in ('published', 'hidden')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists comments_entry_idx on public.comments (entry_id, created_at);

create trigger comments_updated_at
  before update on public.comments
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- reports (moderation foundation)
-- ---------------------------------------------------------------------
create table if not exists public.reports (
  id           uuid primary key default gen_random_uuid(),
  reporter_id  uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  entry_id     uuid references public.entries (id) on delete cascade,
  comment_id   uuid references public.comments (id) on delete cascade,
  reason       text not null check (reason in
                 ('spam', 'inaccurate', 'offensive', 'harassment', 'copyright', 'other')),
  details      text not null default '' check (char_length(details) <= 1000),
  status       text not null default 'open' check (status in ('open', 'reviewed', 'dismissed')),
  created_at   timestamptz not null default now(),
  check (num_nonnulls(entry_id, comment_id) = 1)
);
create unique index if not exists reports_once_per_entry
  on public.reports (reporter_id, entry_id) where entry_id is not null;
create unique index if not exists reports_once_per_comment
  on public.reports (reporter_id, comment_id) where comment_id is not null;

-- ---------------------------------------------------------------------
-- Counter triggers (SECURITY DEFINER so they can bypass column grants)
-- ---------------------------------------------------------------------
create or replace function public.bump_entry_counter()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  delta int := case when tg_op = 'INSERT' then 1 else -1 end;
  eid   uuid := case when tg_op = 'INSERT' then new.entry_id else old.entry_id end;
begin
  if tg_table_name = 'likes' then
    update public.entries set like_count = greatest(like_count + delta, 0) where id = eid;
  elsif tg_table_name = 'saved_entries' then
    update public.entries set save_count = greatest(save_count + delta, 0) where id = eid;
  elsif tg_table_name = 'comments' then
    update public.entries set comment_count = greatest(comment_count + delta, 0) where id = eid;
  end if;
  return null;
end;
$$;

create trigger likes_count  after insert or delete on public.likes
  for each row execute function public.bump_entry_counter();
create trigger saves_count  after insert or delete on public.saved_entries
  for each row execute function public.bump_entry_counter();
create trigger comments_count after insert or delete on public.comments
  for each row execute function public.bump_entry_counter();

-- Counter updates must not bump entries.updated_at ("edited" label).
create or replace function public.entries_touch_only_on_content()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.title, new.excerpt, new.body, new.category_id, new.source_url, new.source_label)
     is not distinct from
     (old.title, old.excerpt, old.body, old.category_id, old.source_url, old.source_label) then
    new.updated_at := old.updated_at;
  else
    new.updated_at := now();
  end if;
  return new;
end;
$$;
create trigger entries_updated_at
  before update on public.entries
  for each row execute function public.entries_touch_only_on_content();

-- ---------------------------------------------------------------------
-- Search (full-text + title trigram fallback)
-- ---------------------------------------------------------------------
create or replace function public.search_entries(q text, lim int default 30, off int default 0)
returns setof public.entries
language sql
stable
security invoker
set search_path = ''
as $$
  select e.*
  from public.entries e
  where e.status = 'published'
    and char_length(btrim(coalesce(q, ''))) >= 2
    and (
      e.search @@ websearch_to_tsquery('english', q)
      or e.title operator(extensions.%) q
      or exists (
        select 1 from public.entry_tags et
        join public.tags t on t.id = et.tag_id
        where et.entry_id = e.id and t.name = lower(btrim(q))
      )
    )
  order by
    ts_rank(e.search, websearch_to_tsquery('english', q)) desc,
    extensions.similarity(e.title, q) desc,
    e.created_at desc
  limit least(greatest(lim, 1), 50) offset greatest(off, 0);
$$;

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table public.profiles       enable row level security;
alter table public.categories     enable row level security;
alter table public.entries        enable row level security;
alter table public.entry_images   enable row level security;
alter table public.tags           enable row level security;
alter table public.entry_tags     enable row level security;
alter table public.likes          enable row level security;
alter table public.saved_entries  enable row level security;
alter table public.comments       enable row level security;
alter table public.reports        enable row level security;

-- profiles
create policy "profiles are public"
  on public.profiles for select to anon, authenticated using (true);
create policy "users update own profile"
  on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- categories
create policy "categories are public"
  on public.categories for select to anon, authenticated using (true);

-- entries
create policy "published entries are public; authors see their own"
  on public.entries for select to anon, authenticated
  using (status = 'published' or author_id = (select auth.uid()));
create policy "users create own entries"
  on public.entries for insert to authenticated
  with check (author_id = (select auth.uid()));
create policy "authors update own entries"
  on public.entries for update to authenticated
  using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));
create policy "authors delete own entries"
  on public.entries for delete to authenticated
  using (author_id = (select auth.uid()));

-- entry_images: visible if the entry is visible; writable by entry owner
create policy "images visible with entry"
  on public.entry_images for select to anon, authenticated
  using (exists (select 1 from public.entries e where e.id = entry_id));
create policy "owners add images"
  on public.entry_images for insert to authenticated
  with check (exists (select 1 from public.entries e
                      where e.id = entry_id and e.author_id = (select auth.uid())));
create policy "owners update images"
  on public.entry_images for update to authenticated
  using (exists (select 1 from public.entries e
                 where e.id = entry_id and e.author_id = (select auth.uid())))
  with check (exists (select 1 from public.entries e
                      where e.id = entry_id and e.author_id = (select auth.uid())));
create policy "owners delete images"
  on public.entry_images for delete to authenticated
  using (exists (select 1 from public.entries e
                 where e.id = entry_id and e.author_id = (select auth.uid())));

-- tags
create policy "tags are public"
  on public.tags for select to anon, authenticated using (true);
create policy "signed-in users create tags"
  on public.tags for insert to authenticated with check (true);

-- entry_tags
create policy "entry tags visible with entry"
  on public.entry_tags for select to anon, authenticated
  using (exists (select 1 from public.entries e where e.id = entry_id));
create policy "owners tag entries"
  on public.entry_tags for insert to authenticated
  with check (exists (select 1 from public.entries e
                      where e.id = entry_id and e.author_id = (select auth.uid())));
create policy "owners untag entries"
  on public.entry_tags for delete to authenticated
  using (exists (select 1 from public.entries e
                 where e.id = entry_id and e.author_id = (select auth.uid())));

-- likes (public counts; who-liked visible)
create policy "likes are public"
  on public.likes for select to anon, authenticated using (true);
create policy "users like visible entries"
  on public.likes for insert to authenticated
  with check (user_id = (select auth.uid())
              and exists (select 1 from public.entries e where e.id = entry_id));
create policy "users unlike"
  on public.likes for delete to authenticated
  using (user_id = (select auth.uid()));

-- saved_entries (private)
create policy "users see own saves"
  on public.saved_entries for select to authenticated
  using (user_id = (select auth.uid()));
create policy "users save visible entries"
  on public.saved_entries for insert to authenticated
  with check (user_id = (select auth.uid())
              and exists (select 1 from public.entries e where e.id = entry_id));
create policy "users unsave"
  on public.saved_entries for delete to authenticated
  using (user_id = (select auth.uid()));

-- comments
create policy "comments visible with entry"
  on public.comments for select to anon, authenticated
  using ((status = 'published' or author_id = (select auth.uid()))
         and exists (select 1 from public.entries e where e.id = entry_id));
create policy "users comment on visible entries"
  on public.comments for insert to authenticated
  with check (author_id = (select auth.uid())
              and exists (select 1 from public.entries e where e.id = entry_id));
create policy "authors edit own comments"
  on public.comments for update to authenticated
  using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));
create policy "authors delete own comments"
  on public.comments for delete to authenticated
  using (author_id = (select auth.uid()));

-- reports (write-only for users; they can see what they filed)
create policy "users file reports"
  on public.reports for insert to authenticated
  with check (reporter_id = (select auth.uid()));
create policy "users see own reports"
  on public.reports for select to authenticated
  using (reporter_id = (select auth.uid()));

-- =====================================================================
-- Column-level privileges (defence in depth on top of RLS)
-- Supabase grants ALL to anon/authenticated by default; tighten it.
-- =====================================================================
revoke all on public.profiles, public.categories, public.entries, public.entry_images,
              public.tags, public.entry_tags, public.likes, public.saved_entries,
              public.comments, public.reports
  from anon, authenticated;

grant select on public.profiles, public.categories, public.entries, public.entry_images,
                public.tags, public.entry_tags, public.likes, public.comments
  to anon, authenticated;
grant select on public.saved_entries, public.reports to authenticated;

grant update (username, display_name, bio, avatar_path) on public.profiles to authenticated;

grant insert (title, excerpt, body, category_id, source_url, source_label)
  on public.entries to authenticated;
grant update (title, excerpt, body, category_id, source_url, source_label)
  on public.entries to authenticated;
grant delete on public.entries to authenticated;

grant insert (entry_id, path, thumb_path, alt_text, width, height, position)
  on public.entry_images to authenticated;
grant update (alt_text, position) on public.entry_images to authenticated;
grant delete on public.entry_images to authenticated;

grant insert (name) on public.tags to authenticated;
grant insert, delete on public.entry_tags to authenticated;

grant insert (entry_id) on public.likes to authenticated;
grant delete on public.likes to authenticated;
grant insert (entry_id) on public.saved_entries to authenticated;
grant delete on public.saved_entries to authenticated;

grant insert (entry_id, body) on public.comments to authenticated;
grant update (body) on public.comments to authenticated;
grant delete on public.comments to authenticated;

grant insert (entry_id, comment_id, reason, details) on public.reports to authenticated;

revoke all on function public.set_entry_tags(uuid, text[]) from public, anon;
grant execute on function public.set_entry_tags(uuid, text[]) to authenticated;
grant execute on function public.search_entries(text, int, int) to anon, authenticated;

-- Internal trigger functions are not callable by clients.
revoke all on function public.handle_new_user()             from public, anon, authenticated;
revoke all on function public.bump_entry_counter()          from public, anon, authenticated;
revoke all on function public.enforce_entry_image_rules()   from public, anon, authenticated;
revoke all on function public.enforce_tag_limit()           from public, anon, authenticated;
