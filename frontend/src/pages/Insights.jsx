import { useState, useEffect } from 'react'
import { Sparkles, Building2 } from 'lucide-react'
import Header from '../components/Header'
import AIInsightsPanel from '../components/AIInsightsPanel'
import { getRestaurants, getInsights } from '../api/client'

export default function InsightsPage() {
  const [restaurants, setRestaurants] = useState([])
  const [selectedId, setSelectedId]   = useState('')
  const [cachedInsights, setCachedInsights] = useState(null)

  useEffect(() => {
    getRestaurants().then(d => {
      const items = d.items || []
      setRestaurants(items)
      if (items.length) setSelectedId(items[0].id)
    })
  }, [])

  useEffect(() => {
    if (!selectedId) return
    setCachedInsights(null)
    getInsights(selectedId)
      .then(d => d.insights && setCachedInsights(d.insights))
      .catch(() => {})
  }, [selectedId])

  const selectedOutlet = restaurants.find(r => r.id === selectedId)

  return (
    <div className="flex flex-col h-full">
      <Header title="AI Insights" subtitle="Gemini-powered operational recommendations" />
      <div className="flex-1 overflow-y-auto p-6 space-y-5">

        {/* Outlet selector */}
        <div className="card p-4 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Building2 size={16} className="text-slate-500" />
            <p className="text-sm text-slate-400">Analyzing outlet:</p>
          </div>
          <select
            className="bg-dark-600 border border-dark-400 rounded-xl px-3 py-2 text-sm text-slate-200 outline-none focus:border-brand-500 min-w-64"
            value={selectedId}
            onChange={e => setSelectedId(e.target.value)}
          >
            {restaurants.map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
          {selectedOutlet && (
            <div className="flex gap-3 ml-auto">
              <span className="badge bg-dark-600 text-slate-400 border-dark-400">
                {selectedOutlet.city}
              </span>
              {selectedOutlet.avg_rating && (
                <span className="badge bg-amber-500/10 text-amber-400 border-amber-500/20">
                  ★ {selectedOutlet.avg_rating}
                </span>
              )}
              <span className="badge bg-dark-600 text-slate-400 border-dark-400">
                {selectedOutlet.total_reviews || 0} reviews
              </span>
            </div>
          )}
        </div>

        {/* Tips banner */}
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-violet-500/5 border border-violet-500/15">
          <Sparkles size={14} className="text-violet-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-slate-400 leading-relaxed">
            AI insights analyze your last 90 days of reviews, including sentiment trends,
            top complaint categories, and rating changes. Results are cached for 24 hours.
            Click <strong className="text-slate-300">Generate Insights</strong> to get your first report,
            or <strong className="text-slate-300">Refresh</strong> to regenerate with the latest data.
          </p>
        </div>

        {/* Main insights panel */}
        <div className="card p-6 min-h-[480px] flex flex-col">
          <AIInsightsPanel
            restaurantId={selectedId || null}
            initialInsights={cachedInsights}
          />
        </div>
      </div>
    </div>
  )
}
