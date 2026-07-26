import { useState, useEffect, useCallback } from 'react'
import { Star, MessageCircle, Building2, AlertTriangle, TrendingUp, Activity, CheckCircle2, XCircle } from 'lucide-react'
import Header from '../components/Header'
import SentimentDonut from '../components/SentimentDonut'
import RatingTrend from '../components/RatingTrend'
import ComplaintCategories from '../components/ComplaintCategories'
import ReviewFeed from '../components/ReviewFeed'
import AIInsightsPanel from '../components/AIInsightsPanel'
import {
  getOverview, getRatingTrend, getRestaurants, getReviews, getOutletComparison
} from '../api/client'
import { usePreferences } from '../context/PreferencesContext'

function StatCard({ icon: Icon, label, value, sub, color = 'brand', trend }) {
  const colorMap = {
    brand:   'from-brand-500/15 to-brand-600/5 border-brand-500/25 text-brand-400',
    green:   'from-emerald-500/15 to-emerald-600/5 border-emerald-500/25 text-emerald-400',
    red:     'from-red-500/15 to-red-600/5 border-red-500/25 text-red-400',
    purple:  'from-violet-500/15 to-violet-600/5 border-violet-500/25 text-violet-400',
  }
  return (
    <div className={`stat-card bg-gradient-to-br ${colorMap[color]} border relative overflow-hidden`}>
      {/* Decorative glow circle */}
      <div className="absolute -top-4 -right-4 w-16 h-16 rounded-full opacity-20"
        style={{ background: color === 'brand' ? '#f97316' : color === 'green' ? '#10b981' : color === 'red' ? '#ef4444' : '#8b5cf6' }}
      />
      <div className="flex items-center justify-between relative z-10">
        <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">{label}</p>
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center bg-dark-700/80 border border-dark-500`}>
          <Icon size={14} className={colorMap[color].split(' ').pop()} />
        </div>
      </div>
      <p className="font-display font-bold text-3xl text-slate-100 mt-2 relative z-10">{value ?? '—'}</p>
      <div className="flex items-center justify-between mt-1 relative z-10">
        {sub && <p className="text-[11px] text-slate-500">{sub}</p>}
        {trend && (
          <span className={`text-[10px] font-semibold ${trend > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%
          </span>
        )}
      </div>
    </div>
  )
}

function OutletHealthRow({ outlet }) {
  const ratingColor = outlet.avg_rating >= 4 ? 'text-emerald-400' : outlet.avg_rating >= 3 ? 'text-amber-400' : 'text-red-400'
  const totalSent = (outlet.sentiment?.positive || 0) + (outlet.sentiment?.neutral || 0) + (outlet.sentiment?.negative || 0)
  const posPct = totalSent > 0 ? Math.round((outlet.sentiment?.positive / totalSent) * 100) : 0
  const negPct = totalSent > 0 ? Math.round((outlet.sentiment?.negative / totalSent) * 100) : 0
  const healthy = outlet.avg_rating >= 3.5 && negPct < 30

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-dark-600 last:border-0 hover:bg-dark-600/30 -mx-2 px-2 rounded-lg transition-colors">
      {/* Health indicator */}
      {healthy
        ? <CheckCircle2 size={14} className="text-emerald-400 flex-shrink-0" />
        : <XCircle size={14} className="text-red-400 flex-shrink-0" />
      }
      {/* Name */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-slate-200 truncate">{outlet.branch_code || outlet.name}</p>
        <p className="text-[10px] text-slate-500 truncate">{outlet.city}</p>
      </div>
      {/* Rating */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <Star size={10} className={`${ratingColor} fill-current`} />
        <span className={`text-xs font-bold ${ratingColor}`}>{outlet.avg_rating?.toFixed(1) || '—'}</span>
      </div>
      {/* Positivity mini-bar */}
      <div className="w-16 flex-shrink-0">
        <div className="flex gap-0.5 h-1.5 rounded-full overflow-hidden bg-dark-500">
          <div className="bg-emerald-500 rounded-full" style={{ width: `${posPct}%` }} />
          <div className="bg-red-500 rounded-full" style={{ width: `${negPct}%` }} />
        </div>
        <p className="text-[9px] text-slate-600 text-right mt-0.5">{posPct}% pos</p>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { autoRefresh } = usePreferences()
  const [overview, setOverview]       = useState(null)
  const [trend, setTrend]             = useState([])
  const [reviews, setReviews]         = useState([])
  const [restaurants, setRestaurants] = useState([])
  const [outlets, setOutlets]         = useState([])
  const [selectedOutlet, setSelectedOutlet] = useState(null)
  const [loading, setLoading]         = useState(true)
  const [refreshKey, setRefreshKey]   = useState(0)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [ov, rests, comp] = await Promise.all([
        getOverview(),
        getRestaurants(),
        getOutletComparison(),
      ])
      setOverview(ov)
      setRestaurants(rests.items || [])
      setOutlets(comp.outlets || [])

      if (rests.items?.length) {
        const firstId = rests.items[0].id
        setSelectedOutlet(firstId)
        const [t, r] = await Promise.all([
          getRatingTrend(firstId, '90d'),
          getReviews(firstId, { page_size: 10 }),
        ])
        setTrend(t.trend || [])
        setReviews(r.items || [])
      }
    } catch (e) {
      console.error('Dashboard load error', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData, refreshKey])

  // Auto-refresh: re-trigger the same refresh the manual "Refresh" button
  // uses, every 5 minutes, only while the preference is enabled.
  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(() => setRefreshKey(k => k + 1), 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [autoRefresh])

  const handleOutletChange = async (outletId) => {
    setSelectedOutlet(outletId)
    if (!outletId) return
    const [t, r] = await Promise.all([
      getRatingTrend(outletId, '90d'),
      getReviews(outletId, { page_size: 10 }),
    ])
    setTrend(t.trend || [])
    setReviews(r.items || [])
  }

  const sentTotal = Object.values(overview?.sentiment_counts || {}).reduce((a, b) => a + b, 0)
  const negPct = overview
    ? Math.round(((overview.sentiment_counts?.negative || 0) / Math.max(sentTotal, 1)) * 100)
    : 0
  const posPct = overview
    ? Math.round(((overview.sentiment_counts?.positive || 0) / Math.max(sentTotal, 1)) * 100)
    : 0

  // Sort outlets by rating desc for health table
  const sortedOutlets = [...outlets].sort((a, b) => (b.avg_rating || 0) - (a.avg_rating || 0))

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Reputation Dashboard"
        subtitle="First Fiddle Restaurants — Live Review Intelligence"
        onRefresh={() => setRefreshKey(k => k + 1)}
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* ── Stat Cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={Building2} label="Active Outlets"
            value={loading ? '…' : overview?.total_outlets}
            sub="First Fiddle branches" color="brand"
          />
          <StatCard
            icon={MessageCircle} label="Total Reviews"
            value={loading ? '…' : overview?.total_reviews?.toLocaleString()}
            sub="All platforms combined" color="purple"
          />
          <StatCard
            icon={Star} label="Avg Rating"
            value={loading ? '…' : overview?.avg_rating ? `${overview.avg_rating}★` : '—'}
            sub={`${posPct}% positive sentiment`} color="green"
          />
          <StatCard
            icon={AlertTriangle} label="Negative Rate"
            value={loading ? '…' : `${negPct}%`}
            sub={`${overview?.sentiment_counts?.negative || 0} negative reviews`}
            color={negPct > 30 ? 'red' : 'brand'}
          />
        </div>

        {/* ── Outlet Selector ── */}
        {restaurants.length > 0 && (
          <div className="flex items-center gap-3 p-3 bg-dark-700/50 border border-dark-500 rounded-xl">
            <Activity size={14} className="text-brand-400 flex-shrink-0" />
            <p className="text-xs text-slate-500 flex-shrink-0">Viewing outlet data for:</p>
            <select
              className="bg-dark-600 border border-dark-400 rounded-lg px-3 py-1.5 text-sm text-slate-200 outline-none focus:border-brand-500 transition-colors flex-1 max-w-xs"
              value={selectedOutlet || ''}
              onChange={e => handleOutletChange(e.target.value)}
            >
              {restaurants.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* ── Main Grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left Column: Sentiment + Categories */}
          <div className="space-y-6">
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1 h-5 bg-brand-500 rounded-full" />
                <p className="section-title mb-0">Sentiment Distribution</p>
              </div>
              <SentimentDonut data={overview?.sentiment_counts || {}} />
            </div>
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1 h-5 bg-violet-500 rounded-full" />
                <p className="section-title mb-0">Top Complaint Categories</p>
              </div>
              <ComplaintCategories data={overview?.category_counts || {}} />
            </div>
          </div>

          {/* Center Column: Rating Trend + Outlet Health */}
          <div className="space-y-6">
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1 h-5 bg-emerald-500 rounded-full" />
                <p className="section-title mb-0">Rating & Review Trend</p>
                <span className="ml-auto text-[10px] text-slate-500 bg-dark-600 px-2 py-0.5 rounded-full">90 days</span>
              </div>
              <RatingTrend data={trend} />
            </div>

            {/* Outlet Health Table */}
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1 h-5 bg-amber-500 rounded-full" />
                <p className="section-title mb-0">Outlet Health</p>
                <span className="ml-auto text-[10px] text-slate-500">
                  {sortedOutlets.filter(o => (o.avg_rating || 0) >= 3.5).length}/{sortedOutlets.length} healthy
                </span>
              </div>
              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="skeleton h-10 rounded-lg" />
                  ))}
                </div>
              ) : sortedOutlets.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-6">No outlet data available</p>
              ) : (
                <div className="space-y-0">
                  {sortedOutlets.map(o => (
                    <OutletHealthRow key={o.restaurant_id} outlet={o} />
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Reviews + AI Insights */}
          <div className="space-y-6">
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-1 h-5 bg-blue-500 rounded-full" />
                <p className="section-title mb-0">Recent Reviews</p>
              </div>
              <ReviewFeed reviews={reviews} loading={loading} />
            </div>
            <div className="card p-5 min-h-64">
              <AIInsightsPanel restaurantId={selectedOutlet} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}