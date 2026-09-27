import { FormEvent, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

export default function Login() {
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true); setErr(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (error) setErr(error.message)
    else nav('/', { replace: true })
  }

  return (
    <section className="max-w-sm mx-auto">
      <h1 className="font-display text-3xl leading-tight">Sign in</h1>
      <form onSubmit={onSubmit} className="mt-6 space-y-3">
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="Email" autoComplete="email"
          className="w-full bg-white border border-line rounded-lg px-4 py-3 focus:outline-none focus:border-teal" />
        <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
          placeholder="Password" autoComplete="current-password"
          className="w-full bg-white border border-line rounded-lg px-4 py-3 focus:outline-none focus:border-teal" />
        {err && <p className="text-terracotta text-sm">{err}</p>}
        <button disabled={busy} className="w-full rounded-full bg-ink text-paper py-3 hover:bg-terracotta transition-colors disabled:opacity-50">
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <p className="mt-4 text-sm text-muted">
        No account? <Link to="/signup" className="text-teal underline">Join Renoki</Link>
      </p>
    </section>
  )
}
