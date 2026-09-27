import { FormEvent, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { resizeImage } from '../lib/image'
import type { Category } from '../types'
import { useEffect } from 'react'

const MAX_IMAGES = 6
const MAX_TAGS = 8
const TITLE_MAX = 140
const BODY_MAX = 4000

interface DraftImage {
  original: File
  preview: string
  alt: string
}

export default function Create() {
  const nav = useNavigate()
  const { session } = useAuth()

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [categoryId, setCategoryId] = useState<string>('')
  const [categories, setCategories] = useState<Category[]>([])
  const [images, setImages] = useState<DraftImage[]>([])
  const [tagInput, setTagInput] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    supabase.from('categories').select('*').order('sort_order').then(({ data }) => {
      setCategories((data as Category[] | null) ?? [])
    })
  }, [])

  const addFiles = (files: FileList | null) => {
    if (!files) return
    const remaining = MAX_IMAGES - images.length
    const drafts: DraftImage[] = Array.from(files).slice(0, remaining).map((f) => ({
      original: f,
      preview: URL.createObjectURL(f),
      alt: '',
    }))
    setImages([...images, ...drafts])
  }

  const removeImage = (i: number) => {
    const next = images.slice()
    URL.revokeObjectURL(next[i].preview)
    next.splice(i, 1)
    setImages(next)
  }

  const setAlt = (i: number, alt: string) => {
    const next = images.slice()
    next[i] = { ...next[i], alt }
    setImages(next)
  }

  const addTag = () => {
    const t = tagInput.trim().toLowerCase().replace(/[^a-z0-9-]/g, '')
    if (!t) return
    if (tags.includes(t)) { setTagInput(''); return }
    if (tags.length >= MAX_TAGS) { setErr(`Max ${MAX_TAGS} tags.`); return }
    setTags([...tags, t]); setTagInput('')
  }
  const removeTag = (t: string) => setTags(tags.filter((x) => x !== t))

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setErr(null)
    if (!session?.user) return
    if (title.trim().length < 3) { setErr('Title is too short.'); return }
    if (body.trim().length < 1) { setErr('Body cannot be empty.'); return }
    if (images.length === 0) { setErr('Add at least one image.'); return }
    if (images.some((i) => i.alt.trim().length === 0)) {
      setErr('Every image needs alt text (for accessibility).'); return
    }
    if (sourceUrl && !/^https?:\/\//i.test(sourceUrl)) {
      setErr('Source URL must start with http(s)://'); return
    }
    setBusy(true)
    try {
      // 1. Insert entry (status = published for MVP; can add draft flow later)
      const { data: entry, error: insErr } = await supabase
        .from('entries')
        .insert({
          author_id: session.user.id,
          category_id: categoryId || null,
          title: title.trim(),
          body: body.trim(),
          source_url: sourceUrl.trim() || null,
          status: 'published',
        })
        .select('id')
        .single()
      if (insErr || !entry) throw insErr ?? new Error('Insert failed')

      // 2. Resize & upload each image, then insert entry_images rows
      for (let i = 0; i < images.length; i++) {
        const img = images[i]
        const display = await resizeImage(img.original, { maxDim: 1600, quality: 0.85 })
        const thumb = await resizeImage(img.original, { maxDim: 640, quality: 0.8 })
        const base = `${session.user.id}/${entry.id}/${i}`
        const displayPath = `${base}-display.webp`
        const thumbPath = `${base}-thumb.webp`
        const up1 = await supabase.storage.from('entry-images')
          .upload(displayPath, display, { contentType: 'image/webp', upsert: false })
        if (up1.error) throw up1.error
        const up2 = await supabase.storage.from('entry-images')
          .upload(thumbPath, thumb, { contentType: 'image/webp', upsert: false })
        if (up2.error) throw up2.error
        const ins2 = await supabase.from('entry_images').insert({
          entry_id: entry.id,
          display_path: displayPath,
          thumb_path: thumbPath,
          alt_text: img.alt.trim(),
          position: i,
        })
        if (ins2.error) throw ins2.error
      }

      // 3. Set tags via RPC (handles create-if-missing + max 8)
      if (tags.length) {
        const { error: tagErr } = await supabase.rpc('set_entry_tags', {
          p_entry_id: entry.id,
          p_tag_names: tags,
        })
        if (tagErr) throw tagErr
      }

      nav(`/e/${entry.id}`, { replace: true })
    } catch (e: any) {
      setErr(e?.message ?? String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section>
      <h1 className="font-display text-3xl leading-tight">Share something worth knowing</h1>
      <form onSubmit={onSubmit} className="mt-6 space-y-5">
        {/* Images */}
        <div>
          <label className="block text-sm text-muted mb-2">
            Images ({images.length}/{MAX_IMAGES})
          </label>
          <div className="grid grid-cols-3 gap-3">
            {images.map((img, i) => (
              <div key={i} className="border border-line rounded-lg overflow-hidden bg-white">
                <img src={img.preview} alt="" className="w-full aspect-square object-cover" />
                <div className="p-2 space-y-1">
                  <input value={img.alt} onChange={(e) => setAlt(i, e.target.value)}
                    placeholder="Describe this image (required)"
                    className="w-full text-xs px-2 py-1 border border-line rounded" />
                  <button type="button" onClick={() => removeImage(i)}
                    className="text-xs text-terracotta hover:underline">Remove</button>
                </div>
              </div>
            ))}
            {images.length < MAX_IMAGES && (
              <button type="button" onClick={() => fileRef.current?.click()}
                className="aspect-square rounded-lg border border-dashed border-line text-muted hover:border-teal hover:text-teal">
                <span className="block text-3xl leading-none">+</span>
                <span className="block text-xs mt-1">Add image</span>
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden
            onChange={(e) => { addFiles(e.target.files); e.target.value = '' }} />
        </div>

        <label className="block text-sm">
          <span className="block text-muted mb-1">Title ({title.length}/{TITLE_MAX})</span>
          <input value={title} onChange={(e) => setTitle(e.target.value.slice(0, TITLE_MAX))}
            className="w-full bg-white border border-line rounded-lg px-4 py-3 font-display text-xl focus:outline-none focus:border-teal"
            placeholder="Something worth knowing…" />
        </label>

        <label className="block text-sm">
          <span className="block text-muted mb-1">Body ({body.length}/{BODY_MAX})</span>
          <textarea value={body} onChange={(e) => setBody(e.target.value.slice(0, BODY_MAX))} rows={6}
            className="w-full bg-white border border-line rounded-lg px-4 py-3 font-serif focus:outline-none focus:border-teal" />
        </label>

        <label className="block text-sm">
          <span className="block text-muted mb-1">Source URL (optional, must start with http(s)://)</span>
          <input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)}
            className="w-full bg-white border border-line rounded-lg px-4 py-3 focus:outline-none focus:border-teal"
            placeholder="https://…" />
        </label>

        <label className="block text-sm">
          <span className="block text-muted mb-1">Category (optional)</span>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}
            className="w-full bg-white border border-line rounded-lg px-4 py-3 focus:outline-none focus:border-teal">
            <option value="">— none —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>

        <div>
          <label className="block text-sm text-muted mb-1">Tags ({tags.length}/{MAX_TAGS})</label>
          <div className="flex flex-wrap gap-2">
            {tags.map((t) => (
              <button key={t} type="button" onClick={() => removeTag(t)}
                className="text-xs rounded-full bg-teal-light text-teal-dark px-3 py-1 hover:bg-terracotta hover:text-paper">
                #{t} ×
              </button>
            ))}
          </div>
          <div className="flex gap-2 mt-2">
            <input value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
              placeholder="add a tag, press Enter"
              className="flex-1 bg-white border border-line rounded-lg px-4 py-2 focus:outline-none focus:border-teal" />
            <button type="button" onClick={addTag} className="text-sm text-muted hover:text-terracotta">Add</button>
          </div>
        </div>

        {err && <p className="text-terracotta text-sm">{err}</p>}

        <div className="flex items-center gap-3 pt-2">
          <button disabled={busy}
            className="rounded-full bg-ink text-paper px-6 py-3 hover:bg-terracotta disabled:opacity-50">
            {busy ? 'Publishing…' : 'Publish'}
          </button>
        </div>
      </form>
    </section>
  )
}
