import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer
} from 'recharts'

const COLORS = {
  positive: '#FAAF1D',
  neutral:  '#64748b',
  negative: '#ef4444',
}

const LABELS = {
  positive: 'Positive Feedback',
  neutral:  'Neutral Response',
  negative: 'Critical Reviews',
}

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  const { name, value } = payload[0]
  return (
    <div className="bg-dark-800 border border-brand-500/20 rounded-xl p-3 shadow-2xl text-xs backdrop-blur-md">
      <p className="text-slate-400 font-bold uppercase tracking-wider text-[10px]">{LABELS[name] || name}</p>
      <p className="text-slate-100 font-black text-sm mt-1">{value} reviews</p>
    </div>
  )
}

const CustomLegend = ({ data, total }) => (
  <div className="flex flex-col gap-2.5 mt-4">
    {data.map(item => {
      const pct = total > 0 ? Math.round((item.value / total) * 100) : 0
      return (
        <div key={item.name} className="flex items-center justify-between border-b border-dark-600/30 pb-2 last:border-0 last:pb-0">
          <div className="flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{
                backgroundColor: COLORS[item.name] || '#64748b',
                boxShadow: item.name === 'positive' ? '0 0 8px rgba(249, 178, 30, 0.6)' : 'none'
              }}
            />
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">{LABELS[item.name] || item.name}</span>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="text-xs font-black text-slate-100">{item.value.toLocaleString()}</span>
            <span className="text-[10px] font-bold text-slate-500">({pct}%)</span>
          </div>
        </div>
      )
    })}
  </div>
)

export default function SentimentDonut({ data = {} }) {
  const chartData = Object.entries(data)
    .filter(([, v]) => v > 0)
    .map(([name, value]) => ({ name, value }))

  const total = chartData.reduce((s, d) => s + d.value, 0)

  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-slate-500">
        <p className="text-xs font-bold uppercase tracking-wider">No sentiment data yet</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      <div className="relative w-full h-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <defs>
              <linearGradient id="posGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#FAAF1D" />
                <stop offset="100%" stopColor="#fac24b" />
              </linearGradient>
              <linearGradient id="neuGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#475569" />
                <stop offset="100%" stopColor="#64748B" />
              </linearGradient>
              <linearGradient id="negGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#DC2626" />
                <stop offset="100%" stopColor="#EF4444" />
              </linearGradient>
            </defs>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={52}
              outerRadius={75}
              paddingAngle={4}
              dataKey="value"
              strokeWidth={0}
            >
              {chartData.map((entry) => (
                <Cell
                  key={entry.name}
                  fill={`url(#${entry.name === 'positive' ? 'posGrad' : entry.name === 'neutral' ? 'neuGrad' : 'negGrad'})`}
                  style={{
                    filter: entry.name === 'positive' 
                      ? 'drop-shadow(0 0 10px rgba(249, 178, 30, 0.45))' 
                      : entry.name === 'negative'
                      ? 'drop-shadow(0 0 10px rgba(239, 68, 68, 0.35))'
                      : 'none',
                    cursor: 'pointer'
                  }}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>

        {/* Center label overlay */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <p className="font-display font-black text-2xl text-slate-100 leading-none">{total}</p>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">reviews</p>
          </div>
        </div>
      </div>

      <CustomLegend data={chartData} total={total} />
    </div>
  )
}
