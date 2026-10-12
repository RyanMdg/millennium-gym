import { Suspense, lazy } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Panel, PublicShell } from './components/PublicShell'
import { FullScreenSpinner } from './components/ui'
import { AuthProvider, useAuth } from './context/AuthContext'
import { supabaseConfigured } from './lib/supabase'
import CheckIn from './pages/CheckIn'
import Landing from './pages/Landing'
import Login from './pages/Login'
import MemberHome from './pages/MemberHome'
import Register from './pages/Register'

// Staff-only screens load on demand so members' phones download less.
const Kiosk = lazy(() => import('./pages/Kiosk'))
const AdminLayout = lazy(() => import('./pages/admin/AdminLayout'))
const Dashboard = lazy(() => import('./pages/admin/Dashboard'))
const Approvals = lazy(() => import('./pages/admin/Approvals'))
const CheckIns = lazy(() => import('./pages/admin/CheckIns'))
const Members = lazy(() => import('./pages/admin/Members'))
const ActivityLog = lazy(() => import('./pages/admin/ActivityLog'))
const AdminUsers = lazy(() => import('./pages/admin/Users'))
const Settings = lazy(() => import('./pages/admin/Settings'))

function RequireRole({ role, children }) {
  const { profile, loading } = useAuth()
  const location = useLocation()
  if (loading) return <FullScreenSpinner />
  if (!profile) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />
  if (role === 'admin' && (profile.role !== 'admin' || profile.status !== 'active')) return <Navigate to="/me" replace />
  if (role === 'member' && profile.role === 'admin') return <Navigate to="/admin" replace />
  return children
}

function SetupNotice() {
  return (
    <PublicShell>
      <Panel>
        <h1 className="font-condensed text-2xl font-bold uppercase text-white">Connect Supabase</h1>
        <p className="mt-2 text-sm text-zinc-300">
          Copy <code className="text-brand-300">.env.example</code> to <code className="text-brand-300">.env</code>, fill in your
          Supabase URL and anon key, then restart <code className="text-brand-300">npm run dev</code>.
        </p>
      </Panel>
    </PublicShell>
  )
}

export default function App() {
  if (!supabaseConfigured) {
    return (
      <BrowserRouter>
        <SetupNotice />
      </BrowserRouter>
    )
  }
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<FullScreenSpinner />}>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/checkin" element={<CheckIn />} />
            <Route path="/register" element={<Register />} />
            <Route path="/login" element={<Login />} />
            <Route path="/me" element={<RequireRole role="member"><MemberHome /></RequireRole>} />
            <Route path="/kiosk" element={<RequireRole role="admin"><Kiosk /></RequireRole>} />
            <Route path="/admin" element={<RequireRole role="admin"><AdminLayout /></RequireRole>}>
              <Route index element={<Dashboard />} />
              <Route path="approvals" element={<Approvals />} />
              <Route path="checkins" element={<CheckIns />} />
              <Route path="members" element={<Members />} />
              <Route path="activity" element={<ActivityLog />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="settings" element={<Settings />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  )
}
