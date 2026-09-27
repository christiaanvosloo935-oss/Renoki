import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import type { Profile as ProfileType } from '../types'

export default function Profile() {
  const { username } = useParams()
  const { signOut, session } = useAuth()
  const [p, setP] = useState<ProfileType | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!username) return
      const { data } = await supabase.from('profiles').select('*').eq('username', username).single()
      if (!cancelled) {
        setP((data as ProfileType | null) ?? null)
        setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [username])

  if (loading) return <p className="text-muted">Loading…</p>
  if (!p) return <p className="text-muted italic">No such profile.</p>

  return (
    <section>
      <div className="flex items-start gap-4">
        <div className="w-16 h-16 rounded-full bg-teal-light border border-line" />
        <div>
          <h1 className="font-display text-2xl leading-tight">{p.display_name || p.username}</h1>
          <p className="text-sm text-muted">@{p.username}</p>
          {p.bio && <p className="mt-2 max-w-reader font-serif">{p.bio}</p>}
        </div>
      </div>
      {session && (
        <button onClick={() => signOut()} className="mt-8 text-sm text-muted hover:text-terracotta">
          Sign out
        </button>
      )}
    </section>
  )
}
