import { useState, useEffect, useCallback } from 'react'
import { Award, MessageSquare, ThumbsUp, Building2, TrendingUp, BarChart3 } from 'lucide-react'
import Header from '../components/Header'
import { getOutletComparison } from '../api/client'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, LabelList
} from 'recharts'

function StatCard({ icon: Icon, label, value, sub, color = 'brand' }) {
  const colorMap = {
    brand:   'from-brand-500/10 to-transparent border-brand-500/15 text-brand-400 hover:border-brand-500/35',
    green:   'from-emerald-500/10 to-transparent border-emerald-500/15 text-emerald-400 hover:border-emerald-500/35',
    red:     'from-red-500/10 to-transparent border-red-500/15 text-red-400 hover:border-red-500/35',
    purple:  'from-violet-500/10 to-transparent border-violet-500/15 text-violet-400 hover:border-violet-500/35',
  }

  const glowColor = {
    brand: 'rgba(249, 178, 30, 0.08)',
    green: 'rgba(16, 185, 129, 0.06)',
    red: 'rgba(239, 68, 68, 0.06)',
    purple: 'rgba(139, 92, 246, 0.06)'
  }

  return (
    <div 
      className={`stat-card bg-gradient-to-br ${colorMap[color]} border transition-all duration-300 relative overflow-hidden`}
      style={{
        boxShadow: `0 8px 30px -5px rgba(0,0,0,0.5), 0 0 15px ${glowColor[color]}`
      }}
    >
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-current to-transparent opacity-30" />
      <div className="flex items-center justify-between relative z-10">
        <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest">{label}</p>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-dark-800 border border-dark-600">
          <Icon size={14} className={colorMap[color].split(' ').pop()} />
        </div>
      </div>
      <p className="font-display font-black text-2xl text-slate-100 mt-3 relative z-10 tracking-tight">{value ?? '—'}</p>
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-dark-600/30 relative z-10">
        {sub && <p className="text-[10px] text-slate-500 font-medium truncate max-w-full">{sub}</p>}
      </div>
    </div>
  )
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-dark-800 border border-brand-500/20 rounded-xl p-3 shadow-2xl text-xs space-y-1 backdrop-blur-md">
      <p className="text-slate-500 font-bold uppercase tracking-wider text-[9px] mb-2">{label}</p>
      {payload.map(p => (
        <div key={p.name} className="flex items-center gap-3 justify-between">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.fill || '#FAAF1D' }} />
            <span className="text-slate-300 font-medium">{p.name}</span>
          </span>
          <span className="font-black text-slate-100">{p.value}</span>
        </div>
      ))}
    </div>
  )
}

export default function Comparison() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getOutletComparison()
      setData(res.outlets || [])
    } catch (e) {
      console.error('Failed to load comparison data', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData, refreshKey])

  // Compute stats
  let totalOutlets = data.length
  let bestOutlet = null
  let mostReviewed = null
  let highestPositivity = null

  if (totalOutlets > 0) {
    // 1. Best performing
    bestOutlet = [...data]
      .filter(o => o.avg_rating !== null)
      .sort((a, b) => b.avg_rating - a.avg_rating)[0]

    // 2. Most reviewed
    mostReviewed = [...data]
      .sort((a, b) => b.total_reviews - a.total_reviews)[0]

    // 3. Highest positivity percentage
    highestPositivity = [...data]
      .map(o => {
        const total = (o.sentiment?.positive || 0) + (o.sentiment?.neutral || 0) + (o.sentiment?.negative || 0)
        const pct = total > 0 ? (o.sentiment.positive / total) * 100 : 0
        return { ...o, positive_pct: pct }
      })
      .sort((a, b) => b.positive_pct - a.positive_pct)[0]
  }

  const chartData = data.map(outlet => ({
    name: outlet.branch_code || outlet.name?.split(' - ')[1] || outlet.name,
    fullName: outlet.name,
    avg_rating: outlet.avg_rating || 0,
    reviews: outlet.total_reviews || 0,
    positive: outlet.sentiment?.positive || 0,
    neutral: outlet.sentiment?.neutral || 0,
    negative: outlet.sentiment?.negative || 0,
  }))

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Outlet Comparison"
        subtitle="Compare reputation, review volume, and sentiment trends across all branches"
        onRefresh={() => setRefreshKey(k => k + 1)}
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {loading ? (
          <>
            {/* Skeletons for stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="skeleton h-28 rounded-2xl" />
              ))}
            </div>
            {/* Skeletons for charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="skeleton h-[420px] rounded-2xl" />
              <div className="skeleton h-[420px] rounded-2xl" />
            </div>
          </>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-500 gap-3">
            <Building2 size={40} className="opacity-20" />
            <p>No outlet comparison data available.</p>
          </div>
        ) : (
          <>
            {/* Stats Summary cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                icon={Building2}
                label="Branches Compared"
                value={totalOutlets}
                sub="Active locations"
                color="brand"
              />
              <StatCard
                icon={Award}
                label="Highest Rated"
                value={bestOutlet ? `${bestOutlet.avg_rating.toFixed(2)}★` : '—'}
                sub={bestOutlet ? bestOutlet.name : 'No rating data'}
                color="green"
              />
              <StatCard
                icon={MessageSquare}
                label="Most Active"
                value={mostReviewed ? mostReviewed.total_reviews.toLocaleString() : '—'}
                sub={mostReviewed ? `${mostReviewed.name} (reviews)` : 'No reviews'}
                color="purple"
              />
              <StatCard
                icon={ThumbsUp}
                label="Highest Positivity"
                value={highestPositivity ? `${Math.round(highestPositivity.positive_pct)}%` : '—'}
                sub={highestPositivity ? highestPositivity.name : 'No sentiment data'}
                color="green"
              />
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Avg Rating Card */}
              <div className="card p-6 h-[420px] flex flex-col justify-between">
                <div className="flex items-center gap-2 mb-4 border-b border-dark-500 pb-3 flex-shrink-0">
                  <TrendingUp size={18} className="text-brand-400" />
                  <p className="font-display font-semibold text-slate-100 text-base">Average Rating by Outlet</p>
                </div>
                <div className="w-full flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 12, right: 8, left: -24, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis
                        dataKey="name"
                        tick={{ fill: '#94a3b8', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        domain={[0, 5]}
                        tick={{ fill: '#64748b', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                      <Bar dataKey="avg_rating" name="Avg Rating" fill="#FAAF1D" radius={[6, 6, 0, 0]} maxBarSize={40}>
                        <LabelList dataKey="avg_rating" position="top" style={{ fill: '#94a3b8', fontSize: 10 }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Sentiment Stack Card */}
              <div className="card p-6 h-[420px] flex flex-col justify-between">
                <div className="flex items-center gap-2 mb-4 border-b border-dark-500 pb-3 flex-shrink-0">
                  <BarChart3 size={18} className="text-brand-400" />
                  <p className="font-display font-semibold text-slate-100 text-base">Sentiment Distribution by Outlet</p>
                </div>
                <div className="w-full flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 12, right: 8, left: -24, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis
                        dataKey="name"
                        tick={{ fill: '#94a3b8', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: '#64748b', fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                      <Legend wrapperStyle={{ color: '#94a3b8', fontSize: '11px', paddingTop: '10px' }} iconType="circle" iconSize={7} />
                      <Bar dataKey="positive" name="Positive" stackId="a" fill="#FAAF1D" />
                      <Bar dataKey="neutral"  name="Neutral"  stackId="a" fill="#64748b" />
                      <Bar dataKey="negative" name="Negative" stackId="a" fill="#ef4444" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
