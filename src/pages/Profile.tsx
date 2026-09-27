import { FormEvent, useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { resizeImage } from '../lib/image'
import { avatarUrl } from '../lib/storage'
import type { Profile as ProfileType } from '../types'

const USERNAME_RE = /^[a-z0-9_]{3,24}$/

export default function Profile() {
  const { username } = useParams()
  const nav = useNavigate()
  const { session, profile: myProfile, refreshProfile, signOut } = useAuth()

  const [p, setP] = useState<ProfileType | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  // form state
  const [displayName, setDisplayName] = useState('')
  const [bio, setBio] = useState('')
  const [newUsername, setNewUsername] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const target = username ?? myProfile?.username
      if (!target) { setLoading(false); return }
      const { data, error } = await supabase.from('profiles').select('*').eq('username', target).single()
      if (cancelled) return
      if (error) setErr(error.message)
      const prof = (data as ProfileType | null) ?? null
      setP(prof)
      if (prof) {
        setDisplayName(prof.display_name ?? '')
        setBio(prof.bio ?? '')
        setNewUsername(prof.username)
      }
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [username, myProfile?.username])

  const isOwner = !!session?.user && !!p && session.user.id === p.id

  const pickAvatar = (f: File | null) => {
    setAvatarFile(f)
    setAvatarPreview(f ? URL.createObjectURL(f) : null)
  }

  const onSave = async (e: FormEvent) => {
    e.preventDefault()
    if (!p || !session?.user) return
    setErr(null)

    const trimmedU = newUsername.trim().toLowerCase()
    if (!USERNAME_RE.test(trimmedU)) {
      setErr('Username must be 3–24 chars, lowercase letters/numbers/underscore.')
      return
    }
    setSaving(true)
    try {
      let nextAvatarPath: string | null = p.avatar_url
      if (avatarFile) {
        const resized = await resizeImage(avatarFile, { maxDim: 512, quality: 0.85 })
        if (resized.size > 2 * 1024 * 1024) throw new Error('Avatar too large after resize (max 2MB).')
        const path = `${session.user.id}/avatar-${Date.now()}.webp`
        const { error: upErr } = await supabase.storage
          .from('avatars')
          .upload(path, resized, { contentType: 'image/webp', upsert: true })
        if (upErr) throw upErr
        nextAvatarPath = path
      }

      const updates: Partial<ProfileType> = {
        display_name: displayName.trim() || null,
        bio: bio.trim() || null,
        avatar_url: nextAvatarPath,
      }
      if (trimmedU !== p.username) updates.username = trimmedU

      const { error: updErr } = await supabase.from('profiles').update(updates).eq('id', p.id)
      if (updErr) {
        if (updErr.code === '23505') throw new Error('That username is taken.')
        throw updErr
      }

      await refreshProfile()
      setEditing(false)
      // If the username changed, navigate to the new URL
      if (trimmedU !== p.username) nav(`/u/${trimmedU}`, { replace: true })
      else {
        // re-fetch fresh copy
        const { data } = await supabase.from('profiles').select('*').eq('id', p.id).single()
        setP((data as ProfileType | null) ?? null)
      }
    } catch (e: any) {
      setErr(e?.message ?? String(e))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-muted">Loading…</p>
  if (!p) return <p className="text-muted italic font-serif">No such profile.</p>

  return (
    <section>
      <div className="flex items-start gap-4">
        {p.avatar_url ? (
          <img src={avatarUrl(p.avatar_url)} alt={`${p.display_name || p.username} avatar`}
            className="w-20 h-20 rounded-full object-cover bg-teal-light border border-line" />
        ) : (
          <div className="w-20 h-20 rounded-full bg-teal-light border border-line flex items-center justify-center font-display text-xl text-teal">
            {(p.display_name || p.username).slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <h1 className="font-display text-2xl leading-tight truncate">{p.display_name || p.username}</h1>
          <p className="text-sm text-muted">@{p.username}</p>
          {p.bio && <p className="mt-2 max-w-reader font-serif whitespace-pre-wrap">{p.bio}</p>}
        </div>
      </div>

      {isOwner && !editing && (
        <div className="mt-6 flex items-center gap-4">
          <button onClick={() => setEditing(true)}
            className="rounded-full bg-ink text-paper px-4 py-2 text-sm hover:bg-terracotta transition-colors">
            Edit profile
          </button>
          <button onClick={() => signOut()} className="text-sm text-muted hover:text-terracotta">Sign out</button>
        </div>
      )}

      {isOwner && editing && (
        <form onSubmit={onSave} className="mt-6 space-y-3 max-w-sm">
          <label className="block text-sm">
            <span className="block text-muted mb-1">Username</span>
            <input value={newUsername} onChange={(e) => setNewUsername(e.target.value)}
              className="w-full bg-white border border-line rounded-lg px-4 py-2 focus:outline-none focus:border-teal"
              placeholder="lowercase, no spaces" />
          </label>
          <label className="block text-sm">
            <span className="block text-muted mb-1">Display name</span>
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)}
              className="w-full bg-white border border-line rounded-lg px-4 py-2 focus:outline-none focus:border-teal" />
          </label>
          <label className="block text-sm">
            <span className="block text-muted mb-1">Bio</span>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={4}
              className="w-full bg-white border border-line rounded-lg px-4 py-2 focus:outline-none focus:border-teal font-serif" />
          </label>
          <label className="block text-sm">
            <span className="block text-muted mb-1">Avatar (JPEG / PNG / WebP)</span>
            <input type="file" accept="image/jpeg,image/png,image/webp"
              onChange={(e) => pickAvatar(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-muted file:mr-3 file:py-2 file:px-3 file:rounded-full file:border-0 file:text-sm file:bg-ink file:text-paper hover:file:bg-terracotta" />
          </label>
          {avatarPreview && (
            <img src={avatarPreview} alt="" className="w-20 h-20 rounded-full object-cover border border-line" />
          )}
          {err && <p className="text-terracotta text-sm">{err}</p>}
          <div className="flex items-center gap-3 pt-1">
            <button disabled={saving} className="rounded-full bg-ink text-paper px-5 py-2 text-sm hover:bg-terracotta disabled:opacity-50">
              {saving ? 'Saving…' : 'Save changes'}
            </button>
            <button type="button" onClick={() => { setEditing(false); setErr(null) }} className="text-sm text-muted hover:text-terracotta">
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  )
}
