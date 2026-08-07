import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, LabelList
} from 'recharts'

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-dark-700 border border-dark-400 rounded-xl p-3 shadow-card text-sm space-y-1.5">
      <p className="text-slate-400 text-xs font-medium mb-1">{label}</p>
      {payload.map(p => (
        <div key={p.name} className="flex items-center gap-3 justify-between">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.fill }} />
            <span className="text-slate-300 text-xs">{p.name}</span>
          </span>
          <span className="font-semibold text-slate-100 text-xs">{p.value}</span>
        </div>
      ))}
    </div>
  )
}

export default function OutletComparison({ data = [] }) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-500">
        <p className="text-sm">No outlet data available</p>
      </div>
    )
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
    <div className="space-y-6">
      {/* Average rating comparison */}
      <div>
        <p className="text-xs text-slate-500 uppercase tracking-wider font-medium mb-3">Avg Rating by Outlet</p>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={chartData} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
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

      {/* Sentiment stack comparison */}
      <div>
        <p className="text-xs text-slate-500 uppercase tracking-wider font-medium mb-3">Sentiment by Outlet</p>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={chartData} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
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
            <Legend wrapperStyle={{ color: '#94a3b8', fontSize: '11px' }} iconType="circle" iconSize={7} />
            <Bar dataKey="positive" name="Positive" stackId="a" fill="#FAAF1D" />
            <Bar dataKey="neutral"  name="Neutral"  stackId="a" fill="#64748b" />
            <Bar dataKey="negative" name="Negative" stackId="a" fill="#ef4444" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
