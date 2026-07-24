import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Star, Building2, Sparkles,
  ChevronLeft, ChevronRight, Utensils, GitCompare,
  Activity
} from 'lucide-react'
import clsx from 'clsx'

const NAV_ITEMS = [
  { label: 'Dashboard',   icon: LayoutDashboard, to: '/',           end: true },
  { label: 'Outlets',     icon: Building2,       to: '/outlets' },
  { label: 'Reviews',     icon: Star,            to: '/reviews' },
  { label: 'Comparison',  icon: GitCompare,      to: '/comparison' }
]

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className={clsx(
        'flex flex-col border-r border-dark-500/60 transition-all duration-300 h-screen sticky top-0 relative',
        collapsed ? 'w-[60px]' : 'w-[220px]'
      )}
      style={{
        background: 'linear-gradient(180deg, #0d0d18 0%, #10101a 60%, #0a0a14 100%)',
      }}
    >
      {/* Subtle ambient glow at top */}
      <div className="absolute top-0 left-0 right-0 h-32 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(249,115,22,0.08) 0%, transparent 70%)' }}
      />

      {/* ── Logo ── */}
      <div className={clsx(
        'flex items-center gap-3 border-b border-dark-500/60 relative z-10',
        collapsed ? 'justify-center px-0 py-5' : 'px-4 py-5'
      )}>
        <div className="flex-shrink-0 w-9 h-9 bg-gradient-brand rounded-xl flex items-center justify-center shadow-glow-brand">
          <Utensils size={17} className="text-white" />
        </div>
        {!collapsed && (
          <div>
            <p className="font-display font-bold text-sm text-slate-100 leading-tight">First Fiddle</p>
            <p className="text-[10px] text-slate-500 font-medium tracking-wide uppercase">Reputation System</p>
          </div>
        )}
      </div>

      {/* ── Status indicator ── */}
      {!collapsed && (
        <div className="mx-3 mt-3 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-slow" />
          <span className="text-[10px] text-emerald-400 font-medium">Live — All systems online</span>
        </div>
      )}
      {collapsed && (
        <div className="flex justify-center mt-3">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-slow" />
        </div>
      )}

      {/* ── Nav ── */}
      <nav className={clsx('flex-1 p-3 space-y-0.5 overflow-y-auto mt-2', collapsed && 'flex flex-col items-center')}>
        {!collapsed && (
          <p className="text-[9px] font-semibold uppercase tracking-widest text-slate-600 px-3 pb-2">Navigation</p>
        )}
        {NAV_ITEMS.map(({ label, icon: Icon, to, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              clsx(
                'flex items-center gap-3 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer relative group',
                collapsed ? 'justify-center p-2.5 w-10 h-10' : 'px-3 py-2.5',
                isActive
                  ? 'text-brand-400 bg-brand-500/12 border border-brand-500/25 shadow-sm'
                  : 'text-slate-500 hover:text-slate-200 hover:bg-dark-600/60 border border-transparent'
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-brand-500 rounded-full" />
                )}
                <Icon size={16} className="flex-shrink-0" />
                {!collapsed && <span>{label}</span>}
                {/* Tooltip for collapsed */}
                {collapsed && (
                  <div className="absolute left-full ml-2 px-2 py-1 bg-dark-600 border border-dark-400 rounded-lg text-xs text-slate-200 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg">
                    {label}
                  </div>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* ── Platform info (expanded only) ── */}
      {!collapsed && (
        <div className="mx-3 mb-2 px-3 py-2.5 rounded-xl bg-dark-700/50 border border-dark-500/50">
          <div className="flex items-center gap-2">
            <Activity size={11} className="text-slate-600" />
            <p className="text-[10px] text-slate-600">v1.0.0 · First Fiddle</p>
          </div>
        </div>
      )}

      {/* ── Collapse toggle ── */}
      <button
        onClick={() => setCollapsed(c => !c)}
        className={clsx(
          'm-3 p-2 rounded-xl text-slate-500 hover:text-slate-200 hover:bg-dark-600/60 border border-dark-500/40 transition-all flex items-center justify-center gap-2',
          collapsed && 'mx-auto w-10'
        )}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronRight size={14} /> : (
          <>
            <ChevronLeft size={14} />
            <span className="text-xs">Collapse</span>
          </>
        )}
      </button>
    </aside>
  )
}
