import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import type { Entry } from '../types'

export default function Discover() {
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase
        .from('entries')
        .select('id, title, body, like_count, comment_count, created_at, author:profiles(username, display_name), images:entry_images(display_path, thumb_path, alt_text, position)')
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(24)
      if (cancelled) return
      if (error) setError(error.message)
      else setEntries((data as unknown as Entry[]) ?? [])
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [])

  return (
    <section>
      <header className="mb-6">
        <h1 className="font-display text-3xl leading-tight">Discover</h1>
        <p className="text-sm text-muted mt-1 italic font-serif">A quiet feed of things worth knowing.</p>
      </header>

      {loading && <p className="text-muted">Loading feed…</p>}
      {error && (
        <p className="text-terracotta text-sm">
          Couldn't reach Supabase yet. Make sure your <code>.env</code> is set and the migrations have run.
        </p>
      )}
      {!loading && !error && entries.length === 0 && (
        <div className="mt-10 text-center text-muted">
          <p className="font-serif italic">No entries yet — be the first to share something.</p>
          <Link to="/create" className="inline-block mt-4 rounded-full bg-ink text-paper px-5 py-2 text-sm hover:bg-terracotta transition-colors">
            Create the first entry
          </Link>
        </div>
      )}

      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {entries.map((e) => (
          <li key={e.id} className="rounded-xl overflow-hidden bg-white border border-line shadow-card">
            <Link to={`/e/${e.id}`} className="block">
              {e.images?.[0]?.thumb_path ? (
                <img
                  src={publicUrl(e.images[0].thumb_path)}
                  alt={e.images[0].alt_text || ''}
                  className="w-full aspect-[4/3] object-cover bg-line"
                  loading="lazy"
                />
              ) : (
                <div className="w-full aspect-[4/3] bg-teal-light" />
              )}
              <div className="p-4">
                <h2 className="font-display text-lg leading-snug line-clamp-2">{e.title}</h2>
                <p className="mt-2 text-xs text-muted flex items-center gap-3">
                  <span>@{e.author?.username ?? 'someone'}</span>
                  <span>♥ {e.like_count}</span>
                  <span>💬 {e.comment_count}</span>
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

function publicUrl(path: string) {
  // Stage 1 uses PUBLIC buckets; construct the public URL directly.
  const base = (import.meta.env.VITE_SUPABASE_URL as string) ?? ''
  return `${base}/storage/v1/object/public/entry-images/${path}`
}
