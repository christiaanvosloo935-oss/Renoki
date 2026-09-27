import { useState } from 'react'

export default function Search() {
  const [q, setQ] = useState('')
  return (
    <section>
      <h1 className="font-display text-3xl leading-tight">Search</h1>
      <p className="text-sm text-muted mt-1 italic font-serif">Search entries, tags and people. (Coming in Stage 7.)</p>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search…"
        className="mt-6 w-full bg-white border border-line rounded-full px-5 py-3 focus:outline-none focus:border-teal"
      />
    </section>
  )
}
