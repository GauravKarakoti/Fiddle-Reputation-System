import { useState } from 'react'
import { Bell, RefreshCw, Loader2 } from 'lucide-react'
import { seedDemo } from '../api/client'

export default function Header({ title, subtitle, onRefresh }) {
  const [seeding, setSeeding] = useState(false)
  const [seeded, setSeeded] = useState(false)

  const handleSeed = async () => {
    if (seeded) return
    setSeeding(true)
    try {
      await seedDemo()
      setSeeded(true)
      onRefresh?.()
    } catch (e) {
      console.error('Seed failed', e)
    } finally {
      setSeeding(false)
    }
  }

  return (
    <header className="flex items-center justify-between px-8 py-5 border-b border-dark-500 bg-dark-800/60 backdrop-blur-sm sticky top-0 z-10">
      <div>
        <h1 className="font-display font-bold text-xl text-slate-100">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3">
        {/* Seed demo data button */}
        <button
          onClick={handleSeed}
          disabled={seeding || seeded}
          className="text-xs px-3 py-1.5 rounded-lg border border-brand-600/40 text-brand-400 hover:bg-brand-500/10 transition-all disabled:opacity-50 flex items-center gap-1.5"
          title="Seed demo data for 5 First Fiddle outlets"
        >
          {seeding ? <Loader2 size={12} className="animate-spin" /> : null}
          {seeded ? '✓ Demo Seeded' : 'Seed Demo Data'}
        </button>

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

        <div className="w-9 h-9 bg-dark-600 rounded-full flex items-center justify-center border border-dark-400">
          <Bell size={16} className="text-slate-400" />
        </div>

        <div className="w-9 h-9 bg-gradient-brand rounded-full flex items-center justify-center shadow-glow-brand">
          <span className="text-white text-xs font-bold">FF</span>
        </div>
      </div>
    </header>
  )
}
