// Types mirror the Stage 1 database schema (see supabase/migrations/*_core_schema.sql).

export interface Profile {
  id: string
  username: string
  display_name: string | null
  bio: string | null
  avatar_url: string | null
  created_at: string
}

export interface Category {
  id: string
  slug: string
  name: string
  sort_order: number
}

export interface EntryImage {
  id: string
  entry_id: string
  display_path: string
  thumb_path: string
  alt_text: string
  position: number
  width: number | null
  height: number | null
}

export interface Tag {
  id: string
  slug: string
  name: string
}

export interface Entry {
  id: string
  author_id: string
  category_id: string | null
  title: string
  body: string
  source_url: string | null
  status: 'published' | 'draft' | 'removed'
  like_count: number
  comment_count: number
  save_count: number
  created_at: string
  updated_at: string
  // joined
  author?: Profile
  category?: Category | null
  images?: EntryImage[]
  tags?: Tag[]
}

export interface Comment {
  id: string
  entry_id: string
  author_id: string
  parent_id: string | null
  body: string
  created_at: string
  author?: Profile
}

export interface Report {
  id: string
  reporter_id: string
  entry_id: string | null
  comment_id: string | null
  reason: string
  created_at: string
}
