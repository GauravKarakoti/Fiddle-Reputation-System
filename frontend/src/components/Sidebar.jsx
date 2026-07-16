import { useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Star, Building2, Sparkles,
  ChevronLeft, ChevronRight, Utensils
} from 'lucide-react'
import clsx from 'clsx'

const NAV_ITEMS = [
  { label: 'Dashboard',  icon: LayoutDashboard, to: '/' },
  { label: 'Outlets',    icon: Building2,       to: '/outlets' },
  { label: 'Reviews',    icon: Star,            to: '/reviews' },
  { label: 'AI Insights',icon: Sparkles,        to: '/insights' },
]

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className={clsx(
        'flex flex-col bg-dark-800 border-r border-dark-500 transition-all duration-300 h-screen sticky top-0',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className={clsx(
        'flex items-center gap-3 px-4 py-5 border-b border-dark-500',
        collapsed && 'justify-center px-0'
      )}>
        <div className="flex-shrink-0 w-9 h-9 bg-gradient-brand rounded-xl flex items-center justify-center shadow-glow-brand">
          <Utensils size={18} className="text-white" />
        </div>
        {!collapsed && (
          <div>
            <p className="font-display font-bold text-m text-slate-100 leading-tight">First Fiddle</p>
            <p className="text-xs text-slate-500">Reputation System</p>
          </div>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map(({ label, icon: Icon, to }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              clsx('nav-item', isActive && 'active', collapsed && 'justify-center px-0')
            }
          >
            <Icon size={18} className="flex-shrink-0" />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(c => !c)}
        className="m-3 p-2 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-dark-600 transition-all flex items-center justify-center"
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        {!collapsed && <span className="ml-2 text-xs">Collapse</span>}
      </button>
    </aside>
  )
}
