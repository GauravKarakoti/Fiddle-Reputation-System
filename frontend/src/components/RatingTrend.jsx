import {
  ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts'

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-dark-800 border border-brand-500/20 rounded-xl p-3 shadow-2xl text-xs space-y-1 backdrop-blur-md">
      <p className="text-slate-500 font-bold uppercase tracking-wider text-[9px] mb-2">{label}</p>
      {payload.map(p => (
        <div key={p.name} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.name === 'Avg Rating' ? '#FAAF1D' : 'rgba(52, 30, 13, 0.5)' }} />
            <span className="text-slate-300 font-medium">{p.name}</span>
          </span>
          <span className="font-black text-slate-100">{p.value}</span>
        </div>
      ))}
    </div>
  )
}

export default function RatingTrend({ data = [] }) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-500">
        <p className="text-xs font-bold uppercase tracking-wider">No trend data available</p>
      </div>
    )
  }

  // Format week labels
  const formatted = data.map(d => ({
    ...d,
    week: d.week?.replace('-W', ' W') || d.week,
    avg_rating: d.avg_rating ? parseFloat(d.avg_rating.toFixed(2)) : null,
  }))

  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={formatted} margin={{ top: 10, right: 8, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="trendLineGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#FAAF1D" />
            <stop offset="100%" stopColor="#fbc433" />
          </linearGradient>
          <linearGradient id="trendBarGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(52, 30, 13, 0.45)" />
            <stop offset="100%" stopColor="rgba(52, 30, 13, 0.02)" />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
        <XAxis
          dataKey="week"
          tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }}
          axisLine={{ stroke: 'rgba(255,255,255,0.05)' }}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          yAxisId="left"
          domain={[1, 5]}
          tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ color: '#94a3b8', fontSize: '11px', fontWeight: 600, paddingTop: '10px' }}
          iconType="circle"
          iconSize={8}
        />
        <Bar
          yAxisId="right"
          dataKey="review_count"
          name="Reviews Volume"
          fill="url(#trendBarGrad)"
          radius={[4, 4, 0, 0]}
          stroke="rgba(52, 30, 13, 0.25)"
          strokeWidth={1}
        />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="avg_rating"
          name="Avg Rating"
          stroke="url(#trendLineGrad)"
          strokeWidth={3}
          dot={{ fill: '#FAAF1D', r: 3, strokeWidth: 0 }}
          activeDot={{ r: 6, fill: '#fbc433', stroke: 'rgba(250, 175, 29, 0.35)', strokeWidth: 4 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
