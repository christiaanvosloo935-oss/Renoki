import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Discover from './pages/Discover'
import Search from './pages/Search'
import Create from './pages/Create'
import Saved from './pages/Saved'
import Profile from './pages/Profile'
import EntryDetail from './pages/EntryDetail'
import Login from './pages/Login'
import SignUp from './pages/SignUp'
import ProtectedRoute from './components/ProtectedRoute'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Discover />} />
        <Route path="/search" element={<Search />} />
        <Route
          path="/create"
          element={
            <ProtectedRoute>
              <Create />
            </ProtectedRoute>
          }
        />
        <Route
          path="/saved"
          element={
            <ProtectedRoute>
              <Saved />
            </ProtectedRoute>
          }
        />
        <Route path="/e/:id" element={<EntryDetail />} />
        <Route path="/u/:username" element={<Profile />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
