import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import Outlets from './pages/Outlets'
import Reviews from './pages/Reviews'
import Comparison from './pages/Comparison'
import Login from './pages/Login'
import Signup from './pages/Signup'
import { AuthProvider, useAuth } from './context/AuthContext'
import { PreferencesProvider } from './context/PreferencesContext'
import { NotificationsProvider } from './context/NotificationsContext'
import './index.css'

function ProtectedApp() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen text-slate-500 text-sm">
        Loading…
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return (
    <NotificationsProvider>
      <PreferencesProvider>
        <div className="flex h-screen overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-hidden flex flex-col">
            <Routes>
              <Route path="/"         element={<Dashboard />} />
              <Route path="/outlets"  element={<Outlets />} />
              <Route path="/reviews"  element={<Reviews />} />
              <Route path="/comparison" element={<Comparison />} />
            </Routes>
          </main>
        </div>
      </PreferencesProvider>
    </NotificationsProvider>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/*" element={<ProtectedApp />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}