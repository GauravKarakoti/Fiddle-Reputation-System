import { RefreshCw } from 'lucide-react'

export default function Header({ title, subtitle, onRefresh }) {
  return (
    <div className="page-header flex flex-col md:flex-row md:items-center md:justify-between px-6 py-5 border-b gap-4">
      <div>
        <h1 className="font-display font-black text-2xl tracking-tight uppercase page-header-title">
          {title}
        </h1>
        {subtitle && <p className="text-xs mt-1 font-medium page-header-subtitle">{subtitle}</p>}
      </div>

      {onRefresh && (
        <button
          onClick={onRefresh}
          className="btn-ghost border border-dark-500/60 text-xs px-4 py-2 hover:border-brand-500/40 hover:bg-brand-500/5 transition-all self-start md:self-auto"
          title="Refresh data"
        >
          <RefreshCw size={13} className="text-brand-400" />
          <span className="font-bold uppercase tracking-wider">Refresh</span>
        </button>
      )}
    </div>
  )
}