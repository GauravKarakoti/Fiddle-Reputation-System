import { useState, useEffect, useCallback } from 'react'
import { Star, TrendingUp, MessageCircle, Building2, AlertTriangle } from 'lucide-react'
import Header from '../components/Header'
import SentimentDonut from '../components/SentimentDonut'
import RatingTrend from '../components/RatingTrend'
import ComplaintCategories from '../components/ComplaintCategories'
import OutletComparison from '../components/OutletComparison'
import ReviewFeed from '../components/ReviewFeed'
import AIInsightsPanel from '../components/AIInsightsPanel'
import {
  getOverview, getRatingTrend, getOutletComparison, getRestaurants, getReviews
} from '../api/client' 

function StatCard({ icon: Icon, label, value, sub, color = 'brand' }) {
  const colorMap = {
    brand:   'from-brand-500/20 to-brand-600/10 border-brand-500/20 text-brand-400',
    green:   'from-emerald-500/20 to-emerald-600/10 border-emerald-500/20 text-emerald-400',
    red:     'from-red-500/20 to-red-600/10 border-red-500/20 text-red-400',
    purple:  'from-violet-500/20 to-violet-600/10 border-violet-500/20 text-violet-400',
  }
  return (
    <div className={`stat-card bg-gradient-to-br ${colorMap[color]} border`}>
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">{label}</p>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-dark-700`}>
          <Icon size={15} className={colorMap[color].split(' ').pop()} />
        </div>
      </div>
      <p className="font-display font-bold text-3xl text-slate-100 mt-1">{value ?? '—'}</p>
      {sub && <p className="text-xs text-slate-500">{sub}</p>}
    </div>
  )
}

export default function Dashboard() {
  const [overview, setOverview]     = useState(null)
  const [trend, setTrend]           = useState([])
  const [comparison, setComparison] = useState([])
  const [reviews, setReviews]       = useState([])
  const [restaurants, setRestaurants] = useState([])
  const [selectedOutlet, setSelectedOutlet] = useState(null)
  const [loading, setLoading]       = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [ov, comp, rests] = await Promise.all([
        getOverview(),
        getOutletComparison(),
        getRestaurants(),
      ])
      setOverview(ov)
      setComparison(comp.outlets || [])
      setRestaurants(rests.items || []) 

      // Load trend for first outlet if available
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

  const negPct = overview
    ? Math.round(
        ((overview.sentiment_counts?.negative || 0) /
          Math.max(Object.values(overview.sentiment_counts || {}).reduce((a, b) => a + b, 0), 1)) * 100
      )
    : 0

  return (
    <div className="flex flex-col h-full"> 
      <Header
        title="Reputation Dashboard"
        subtitle="First Fiddle Restaurants — Live Review Intelligence"
        onRefresh={() => setRefreshKey(k => k + 1)}
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Stat cards */}
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
            sub="Across all outlets" color="green"
          />
          <StatCard
            icon={AlertTriangle} label="Negative Rate"
            value={loading ? '…' : `${negPct}%`}
            sub={`${overview?.sentiment_counts?.negative || 0} negative reviews`}
            color={negPct > 30 ? 'red' : 'brand'}
          />
        </div>

        {/* Outlet selector */}
        {restaurants.length > 0 && (
          <div className="flex items-center gap-3">
            <p className="text-sm text-slate-500">Viewing outlet:</p>
            <select
              className="bg-dark-700 border border-dark-400 rounded-xl px-3 py-2 text-sm text-slate-200 outline-none focus:border-brand-500 transition-colors"
              value={selectedOutlet || ''}
              onChange={e => handleOutletChange(e.target.value)}
            >
              {restaurants.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div> 
        )}

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Sentiment + Categories */}
          <div className="space-y-6">
            <div className="card p-5">
              <p className="section-title">Sentiment Distribution</p>
              <SentimentDonut data={overview?.sentiment_counts || {}} />
            </div>
            <div className="card p-5">
              <p className="section-title">Complaint Categories</p>
              <ComplaintCategories data={overview?.category_counts || {}} />
            </div>
          </div>

          {/* Center: Trend + Outlet comparison */}
          <div className="space-y-6">
            <div className="card p-5">
              <p className="section-title">Rating & Review Trend (90 days)</p>
              <RatingTrend data={trend} />
            </div>
            <div className="card p-5">
              <p className="section-title">Outlet Performance Comparison</p>
              <OutletComparison data={comparison} />
            </div>
          </div>

          {/* Right: Reviews + AI Insights */}
          <div className="space-y-6">
            <div className="card p-5">
              <p className="section-title">Recent Reviews</p>
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
