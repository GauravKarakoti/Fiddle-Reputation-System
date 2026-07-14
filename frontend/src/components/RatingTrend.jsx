import {
  ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts'

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-dark-700 border border-dark-400 rounded-xl p-3 shadow-card text-sm space-y-1">
      <p className="text-slate-400 text-xs mb-2">{label}</p>
      {payload.map(p => (
        <div key={p.name} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
            <span className="text-slate-300">{p.name}</span>
          </span>
          <span className="font-semibold text-slate-100">{p.value}</span>
        </div>
      ))}
    </div>
  )
}

export default function RatingTrend({ data = [] }) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-500">
        <p className="text-sm">No trend data available</p>
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
      <ComposedChart data={formatted} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis
          dataKey="week"
          tick={{ fill: '#64748b', fontSize: 11 }}
          axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          yAxisId="left"
          domain={[1, 5]}
          tick={{ fill: '#64748b', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={{ fill: '#64748b', fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ color: '#94a3b8', fontSize: '12px' }}
          iconType="circle"
          iconSize={8}
        />
        <Bar
          yAxisId="right"
          dataKey="review_count"
          name="Reviews"
          fill="rgba(249,115,22,0.2)"
          radius={[4, 4, 0, 0]}
          stroke="rgba(249,115,22,0.5)"
          strokeWidth={1}
        />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="avg_rating"
          name="Avg Rating"
          stroke="#f97316"
          strokeWidth={2.5}
          dot={{ fill: '#f97316', r: 4, strokeWidth: 0 }}
          activeDot={{ r: 6, fill: '#fb923c', stroke: 'rgba(249,115,22,0.4)', strokeWidth: 4 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}
