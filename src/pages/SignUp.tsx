import { FormEvent, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

export default function SignUp() {
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true); setErr(null)
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { username: username.trim(), display_name: displayName.trim() } },
    })
    setBusy(false)
    if (error) setErr(error.message)
    else nav('/', { replace: true })
  }

  return (
    <section className="max-w-sm mx-auto">
      <h1 className="font-display text-3xl leading-tight">Join Renoki</h1>
      <p className="text-sm text-muted mt-1 italic font-serif">Share things worth knowing.</p>
      <form onSubmit={onSubmit} className="mt-6 space-y-3">
        <input required value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Username (lowercase, no spaces)"
          className="w-full bg-white border border-line rounded-lg px-4 py-3 focus:outline-none focus:border-teal" />
        <input required value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Display name"
          className="w-full bg-white border border-line rounded-lg px-4 py-3 focus:outline-none focus:border-teal" />
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" autoComplete="email"
          className="w-full bg-white border border-line rounded-lg px-4 py-3 focus:outline-none focus:border-teal" />
        <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password (min 8)"
          minLength={8} autoComplete="new-password"
          className="w-full bg-white border border-line rounded-lg px-4 py-3 focus:outline-none focus:border-teal" />
        {err && <p className="text-terracotta text-sm">{err}</p>}
        <button disabled={busy} className="w-full rounded-full bg-ink text-paper py-3 hover:bg-terracotta transition-colors disabled:opacity-50">
          {busy ? 'Creating…' : 'Create account'}
        </button>
      </form>
      <p className="mt-4 text-sm text-muted">
        Already have one? <Link to="/login" className="text-teal underline">Sign in</Link>
      </p>
    </section>
  )
}
