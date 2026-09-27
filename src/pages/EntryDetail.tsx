import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import type { Entry } from '../types'

export default function EntryDetail() {
  const { id } = useParams()
  const [entry, setEntry] = useState<Entry | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!id) return
      const { data } = await supabase
        .from('entries')
        .select('*, author:profiles(username, display_name), images:entry_images(*)')
        .eq('id', id)
        .single()
      if (!cancelled) {
        setEntry((data as unknown as Entry | null) ?? null)
        setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [id])

  if (loading) return <p className="text-muted">Loading…</p>
  if (!entry) return <p className="text-muted italic">Entry not found.</p>

  return (
    <article className="max-w-reader mx-auto">
      <h1 className="font-display text-3xl leading-tight">{entry.title}</h1>
      <p className="mt-2 text-sm text-muted">by @{entry.author?.username ?? 'someone'}</p>
      <div className="mt-6 space-y-4">
        {entry.images?.map((img) => (
          <img
            key={img.id}
            src={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/entry-images/${img.display_path}`}
            alt={img.alt_text || ''}
            className="w-full rounded-xl bg-line"
            loading="lazy"
          />
        ))}
      </div>
      <div className="mt-6 font-serif text-lg leading-relaxed whitespace-pre-wrap">{entry.body}</div>
    </article>
  )
}
