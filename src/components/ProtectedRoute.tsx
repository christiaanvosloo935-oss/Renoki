import { Navigate, useLocation } from 'react-router-dom'
import { ReactNode } from 'react'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <div className="p-10 text-center text-muted font-serif italic">Loading…</div>
  }
  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }
  return <>{children}</>
}
