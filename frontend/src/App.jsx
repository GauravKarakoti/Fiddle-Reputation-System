import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Navbar from './components/Navbar'
import Dashboard from './pages/Dashboard'
import Outlets from './pages/Outlets'
import Reviews from './pages/Reviews'
import Comparison from './pages/Comparison'
import PendingApprovals from './pages/PendingApprovals'
import Login from './pages/Login'
import Signup from './pages/Signup'
import AIChatWidget from './components/AIChatWidget'
import { AuthProvider, useAuth } from './context/AuthContext'
import { PreferencesProvider } from './context/PreferencesContext'
import { NotificationsProvider } from './context/NotificationsContext'
import './index.css'
import logo from './assets/firstfiddle-logo.png'

function ProtectedApp() {
  const { user, loading } = useAuth()

  if (loading) {
  return (
    <div className="flex items-center justify-center h-screen bg-[#0B0B0F]">
      <img
        src={logo}
        alt="Loading…"
        className="animate-spin w-25 h-25"
      />
    </div>
  );
}
  if (!user) {
    return <Navigate to="/login" replace />
  }

  return (
    <NotificationsProvider>
      <PreferencesProvider>
        <div className="flex flex-col h-screen overflow-hidden bg-dark-900">
          <Navbar />
          <main className="flex-1 overflow-hidden flex flex-col relative">
            <Routes>
              <Route path="/"         element={<Dashboard />} />
              <Route path="/outlets"  element={<Outlets />} />
              <Route path="/reviews"  element={<Reviews />} />
              <Route path="/comparison" element={<Comparison />} />
              <Route path="/admin/approvals" element={<PendingApprovals />} />
            </Routes>
          </main>
          <AIChatWidget />
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