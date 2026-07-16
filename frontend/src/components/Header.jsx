import { useState, useRef, useEffect } from 'react'
import { Bell, RefreshCw, User, Settings, LogOut } from 'lucide-react'

export default function Header({ title, subtitle, onRefresh, notifications = [], user = { name: 'Founder', initials: 'FF' } }) {
  const [showNotifications, setShowNotifications] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const notifRef = useRef(null)
  const profileRef = useRef(null)

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setShowNotifications(false)
      }
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setShowProfile(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <header className="flex items-center justify-between px-8 py-5 border-b border-dark-500 bg-dark-800/60 backdrop-blur-sm sticky top-0 z-10">
      <div>
        <h1 className="font-display font-bold text-xl text-slate-100">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3">
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="btn-ghost text-sm"
            title="Refresh data"
          >
            <RefreshCw size={15} />
            Refresh
          </button>
        )}

        {/* Notifications */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => { setShowNotifications(v => !v); setShowProfile(false) }}
            className="relative w-9 h-9 bg-dark-600 rounded-full flex items-center justify-center border border-dark-400 hover:bg-dark-500 transition-colors"
            title="Notifications"
          >
            <Bell size={16} className="text-slate-400" />
            {notifications.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center">
                {notifications.length > 9 ? '9+' : notifications.length}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-72 bg-dark-700 border border-dark-400 rounded-xl shadow-lg overflow-hidden animate-slide-up z-20">
              <div className="px-4 py-3 border-b border-dark-500">
                <p className="text-sm font-semibold text-slate-200">Notifications</p>
              </div>
              <div className="max-h-72 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="text-xs text-slate-500 px-4 py-6 text-center">No new notifications</p>
                ) : (
                  notifications.map((n, i) => (
                    <div key={i} className="px-4 py-3 border-b border-dark-600 last:border-0 hover:bg-dark-600/50 transition-colors">
                      <p className="text-sm text-slate-200">{n.title}</p>
                      {n.time && <p className="text-xs text-slate-500 mt-0.5">{n.time}</p>}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Profile */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => { setShowProfile(v => !v); setShowNotifications(false) }}
            className="w-9 h-9 bg-gradient-brand rounded-full flex items-center justify-center shadow-glow-brand hover:opacity-90 transition-opacity"
            title="Profile"
          >
            <span className="text-white text-xs font-bold">{user.initials}</span>
          </button>

          {showProfile && (
            <div className="absolute right-0 mt-2 w-48 bg-dark-700 border border-dark-400 rounded-xl shadow-lg overflow-hidden animate-slide-up z-20">
              <div className="px-4 py-3 border-b border-dark-500">
                <p className="text-sm font-semibold text-slate-200">{user.name}</p>
              </div>
              <button className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-300 hover:bg-dark-600/50 transition-colors">
                <User size={14} /> Profile
              </button>
              <button className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-slate-300 hover:bg-dark-600/50 transition-colors">
                <Settings size={14} /> Settings
              </button>
              <button className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-400 hover:bg-dark-600/50 transition-colors border-t border-dark-500">
                <LogOut size={14} /> Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}