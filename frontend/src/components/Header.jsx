import { useState, useRef, useEffect } from 'react'
import { Bell, RefreshCw, Settings, LogOut, User2, ChevronRight, X, Shield, Moon, Globe2, Zap } from 'lucide-react'

// ── Profile Settings Modal ─────────────────────────────────────────────────────
function ProfileModal({ onClose }) {
  const [tab, setTab] = useState('profile')
  const [form, setForm] = useState({ name: 'Bhumika Singh', email: 'founder@firstfiddle.in', role: 'Founder & CEO' })
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-dark-800 border border-dark-400 rounded-2xl shadow-2xl overflow-hidden animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-500 bg-gradient-to-r from-dark-700 to-dark-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-brand rounded-xl flex items-center justify-center shadow-glow-brand">
              <span className="text-white text-sm font-bold">BS</span>
            </div>
            <div>
              <p className="font-display font-semibold text-slate-100 text-sm">Account Settings</p>
              <p className="text-xs text-slate-500">Manage your profile and preferences</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-dark-600 flex items-center justify-center text-slate-400 hover:text-slate-100 hover:bg-dark-500 transition-all">
            <X size={15} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-dark-500">
          {[
            { id: 'profile', label: 'Profile', icon: User2 },
            { id: 'preferences', label: 'Preferences', icon: Settings },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium transition-all ${
                tab === id
                  ? 'text-brand-400 border-b-2 border-brand-500 bg-brand-500/5'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {tab === 'profile' && (
            <>
              {/* Avatar */}
              <div className="flex items-center gap-4 p-4 bg-dark-700/50 rounded-xl border border-dark-500">
                <div className="w-14 h-14 bg-gradient-brand rounded-2xl flex items-center justify-center shadow-glow-brand flex-shrink-0">
                  <span className="text-white text-lg font-bold">BS</span>
                </div>
                <div>
                  <p className="font-semibold text-slate-100">{form.name}</p>
                  <p className="text-xs text-slate-500">{form.role}</p>
                  <p className="text-xs text-brand-400 mt-1">{form.email}</p>
                </div>
              </div>

              {[
                { key: 'name', label: 'Full Name', placeholder: 'Your full name' },
                { key: 'email', label: 'Email Address', placeholder: 'you@example.com' },
                { key: 'role', label: 'Role / Title', placeholder: 'e.g. Founder & CEO' },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="text-xs text-slate-400 font-medium mb-1.5 block">{label}</label>
                  <input
                    className="w-full bg-dark-600 border border-dark-400 rounded-xl px-3 py-2.5 text-sm text-slate-200 outline-none focus:border-brand-500 transition-colors placeholder-slate-600"
                    placeholder={placeholder}
                    value={form[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  />
                </div>
              ))}
            </>
          )}

          {tab === 'preferences' && (
            <div className="space-y-3">
              {[
                { icon: Moon, label: 'Dark Mode', sub: 'Always on — system default', enabled: true },
                { icon: Globe2, label: 'Language', sub: 'English (India)', enabled: null },
                { icon: Zap, label: 'Auto-refresh Dashboard', sub: 'Refresh data every 5 minutes', enabled: true },
                { icon: Shield, label: 'Email Alerts', sub: 'Get notified on negative spikes', enabled: false },
              ].map(({ icon: Icon, label, sub, enabled }) => (
                <div key={label} className="flex items-center justify-between p-3.5 bg-dark-700/50 border border-dark-500 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-dark-600 rounded-lg flex items-center justify-center">
                      <Icon size={15} className="text-brand-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-200">{label}</p>
                      <p className="text-xs text-slate-500">{sub}</p>
                    </div>
                  </div>
                  {enabled !== null && (
                    <div className={`w-10 h-5 rounded-full transition-colors ${enabled ? 'bg-brand-500' : 'bg-dark-400'} flex items-center`}>
                      <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-dark-500 flex gap-3">
          <button onClick={onClose} className="btn-ghost flex-1 justify-center text-sm py-2">Cancel</button>
          <button onClick={handleSave} className="btn-primary flex-1 justify-center text-sm py-2">
            {saved ? '✓ Saved!' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Header ────────────────────────────────────────────────────────────────
export default function Header({ title, subtitle, onRefresh, notifications: initialNotifs }) {
  const defaultNotifications = [
    { id: 1, type: 'alert', title: '🔴 Negative spike at FF-Cyber', sub: 'Rating dropped to 3.2 — 12 negative reviews today', time: '2 min ago', unread: true },
    { id: 2, type: 'success', title: '✅ Scrape completed — FF-CP', sub: '47 new reviews fetched from Google & Zomato', time: '18 min ago', unread: true },
    { id: 3, type: 'info', title: '🤖 AI Insights ready', sub: 'New recommendations available for FF-Hauz Khas', time: '1 hr ago', unread: false },
    { id: 4, type: 'info', title: '📊 Weekly report generated', sub: 'Your platform-wide digest is ready to view', time: 'Yesterday', unread: false },
  ]

  const [notifications, setNotifications] = useState(initialNotifs?.length ? initialNotifs : defaultNotifications)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const notifRef = useRef(null)
  const profileRef = useRef(null)

  const user = { name: 'Bhumika Singh', initials: 'BS', role: 'Founder & CEO' }

  const unreadCount = notifications.filter(n => n.unread).length

  const markAllRead = () => setNotifications(ns => ns.map(n => ({ ...n, unread: false })))
  const dismissNotif = (id) => setNotifications(ns => ns.filter(n => n.id !== id))

  useEffect(() => {
    function handleClickOutside(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotifications(false)
      if (profileRef.current && !profileRef.current.contains(e.target)) setShowProfile(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const typeColors = {
    alert:   'bg-red-500/10 border-red-500/20',
    success: 'bg-emerald-500/10 border-emerald-500/20',
    info:    'bg-brand-500/10 border-brand-500/20',
  }

  return (
    <>
      <header className="flex items-center justify-between px-6 py-4 border-b border-dark-500/60 bg-dark-800/80 backdrop-blur-sm sticky top-0 z-10">
        {/* Left: title */}
        <div>
          <h1 className="font-display font-bold text-xl text-slate-100 tracking-tight">{title}</h1>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2">
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="btn-ghost text-xs px-3 py-2 gap-1.5"
              title="Refresh data"
            >
              <RefreshCw size={13} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          )}

          {/* Notifications */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => { setShowNotifications(v => !v); setShowProfile(false) }}
              className="relative w-9 h-9 bg-dark-600 rounded-xl flex items-center justify-center border border-dark-400 hover:bg-dark-500 hover:border-brand-500/40 transition-all"
              title="Notifications"
            >
              <Bell size={15} className="text-slate-400" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4.5 h-4.5 min-w-[18px] min-h-[18px] bg-red-500 rounded-full text-[9px] text-white flex items-center justify-center font-bold shadow-lg px-0.5">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-80 bg-dark-700 border border-dark-400 rounded-2xl shadow-2xl overflow-hidden animate-slide-up z-20">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-dark-500">
                  <div className="flex items-center gap-2">
                    <Bell size={14} className="text-brand-400" />
                    <p className="text-sm font-semibold text-slate-200">Notifications</p>
                    {unreadCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 text-[10px] font-bold">{unreadCount} new</span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button onClick={markAllRead} className="text-xs text-brand-400 hover:text-brand-300 transition-colors">
                      Mark all read
                    </button>
                  )}
                </div>

                {/* List */}
                <div className="max-h-80 overflow-y-auto divide-y divide-dark-600">
                  {notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 gap-2 text-slate-500">
                      <Bell size={22} className="opacity-20" />
                      <p className="text-xs">No new notifications</p>
                    </div>
                  ) : notifications.map(n => (
                    <div
                      key={n.id}
                      className={`flex items-start gap-3 px-4 py-3 hover:bg-dark-600/40 transition-colors ${n.unread ? 'bg-dark-600/20' : ''}`}
                    >
                      {n.unread && <div className="w-1.5 h-1.5 rounded-full bg-brand-500 mt-2 flex-shrink-0" />}
                      {!n.unread && <div className="w-1.5 flex-shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-200 leading-snug">{n.title}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{n.sub}</p>
                        <p className="text-[10px] text-slate-600 mt-1">{n.time}</p>
                      </div>
                      <button
                        onClick={() => dismissNotif(n.id)}
                        className="text-slate-600 hover:text-slate-400 flex-shrink-0 mt-0.5 transition-colors"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Footer */}
                <div className="px-4 py-2.5 border-t border-dark-500 bg-dark-800/50">
                  <button className="w-full text-center text-xs text-brand-400 hover:text-brand-300 transition-colors py-0.5">
                    View all activity →
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Profile */}
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => { setShowProfile(v => !v); setShowNotifications(false) }}
              className="flex items-center gap-2 pl-1 pr-2.5 py-1 bg-dark-600 rounded-xl border border-dark-400 hover:bg-dark-500 hover:border-brand-500/40 transition-all"
              title="Profile"
            >
              <div className="w-7 h-7 bg-gradient-brand rounded-lg flex items-center justify-center shadow-glow-brand flex-shrink-0">
                <span className="text-white text-[11px] font-bold">{user.initials}</span>
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-xs font-semibold text-slate-200 leading-none">{user.name}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{user.role}</p>
              </div>
              <ChevronRight size={12} className={`text-slate-500 transition-transform hidden sm:block ${showProfile ? 'rotate-90' : ''}`} />
            </button>

            {showProfile && (
              <div className="absolute right-0 mt-2 w-52 bg-dark-700 border border-dark-400 rounded-2xl shadow-2xl overflow-hidden animate-slide-up z-20">
                {/* Profile header */}
                <div className="px-4 py-3.5 border-b border-dark-500 bg-gradient-to-br from-dark-600 to-dark-700">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 bg-gradient-brand rounded-xl flex items-center justify-center shadow-glow-brand flex-shrink-0">
                      <span className="text-white text-xs font-bold">{user.initials}</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-100">{user.name}</p>
                      <p className="text-[10px] text-slate-500">{user.role}</p>
                    </div>
                  </div>
                </div>

                {/* Menu items */}
                <div className="py-1">
                  <button
                    onClick={() => { setShowProfile(false); setShowProfileModal(true) }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-300 hover:bg-dark-600/70 hover:text-slate-100 transition-colors text-left"
                  >
                    <User2 size={14} className="text-slate-500" />
                    Profile & Settings
                  </button>
                  <button className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-300 hover:bg-dark-600/70 hover:text-slate-100 transition-colors text-left">
                    <Shield size={14} className="text-slate-500" />
                    Account Security
                  </button>
                </div>

                <div className="py-1 border-t border-dark-500">
                  <button
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors text-left"
                    onClick={() => alert('Log out action — wire to your auth system')}
                  >
                    <LogOut size={14} />
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Profile modal */}
      {showProfileModal && <ProfileModal onClose={() => setShowProfileModal(false)} />}
    </>
  )
}