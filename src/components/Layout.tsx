import { Link, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function Icon({ name, className = '' }: { name: string; className?: string }) {
  // Minimal inline icon set — no external dep
  const common = 'w-6 h-6 stroke-current'
  const strokeProps = { fill: 'none', strokeWidth: 1.6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  switch (name) {
    case 'discover':
      return <svg className={`${common} ${className}`} viewBox="0 0 24 24" {...strokeProps}><circle cx="12" cy="12" r="9" /><path d="M15.5 8.5l-2.2 5.3-5.3 2.2 2.2-5.3 5.3-2.2z" /></svg>
    case 'search':
      return <svg className={`${common} ${className}`} viewBox="0 0 24 24" {...strokeProps}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
    case 'create':
      return <svg className={`${common} ${className}`} viewBox="0 0 24 24" {...strokeProps}><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M12 8v8M8 12h8" /></svg>
    case 'saved':
      return <svg className={`${common} ${className}`} viewBox="0 0 24 24" {...strokeProps}><path d="M6 4h12v17l-6-4-6 4V4z" /></svg>
    case 'profile':
      return <svg className={`${common} ${className}`} viewBox="0 0 24 24" {...strokeProps}><circle cx="12" cy="8" r="4" /><path d="M4 20c1.5-4 5-6 8-6s6.5 2 8 6" /></svg>
    default:
      return null
  }
}

const navItem = ({ isActive }: { isActive: boolean }) =>
  `flex flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] tracking-wide ${
    isActive ? 'text-teal' : 'text-muted hover:text-ink'
  }`

export default function Layout() {
  const { session, profile } = useAuth()
  const profilePath = profile?.username ? `/u/${profile.username}` : '/login'

  return (
    <div className="min-h-screen flex flex-col bg-paper">
      {/* Top header — quiet, editorial */}
      <header className="border-b border-line bg-paper/90 backdrop-blur sticky top-0 z-20">
        <div className="max-w-2xl mx-auto px-5 py-3 flex items-center">
          <Link to="/" className="font-display text-xl tracking-wide text-ink">
            Renoki
          </Link>
          <span className="ml-2 text-[11px] italic text-muted hidden sm:inline">
            things worth knowing
          </span>
          <div className="ml-auto text-sm">
            {session ? null : (
              <Link to="/login" className="text-muted hover:text-terracotta">
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main content — reader-width, roomy bottom padding for bottom nav */}
      <main className="flex-1 w-full max-w-2xl mx-auto px-5 py-6 pb-28">
        <Outlet />
      </main>

      {/* Mobile-first bottom nav — visible on ALL widths per brief (mobile-first product) */}
      <nav
        aria-label="Primary"
        className="fixed bottom-0 inset-x-0 z-30 border-t border-line bg-paper/95 backdrop-blur pb-safe"
      >
        <div className="max-w-2xl mx-auto grid grid-cols-5">
          <NavLink to="/" end className={navItem}>
            <Icon name="discover" />
            <span>Discover</span>
          </NavLink>
          <NavLink to="/search" className={navItem}>
            <Icon name="search" />
            <span>Search</span>
          </NavLink>
          <NavLink to="/create" className={navItem}>
            <Icon name="create" />
            <span>Create</span>
          </NavLink>
          <NavLink to="/saved" className={navItem}>
            <Icon name="saved" />
            <span>Saved</span>
          </NavLink>
          <NavLink to={profilePath} className={navItem}>
            <Icon name="profile" />
            <span>Profile</span>
          </NavLink>
        </div>
      </nav>
    </div>
  )
}
