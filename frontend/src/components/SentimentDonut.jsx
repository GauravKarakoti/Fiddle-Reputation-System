import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer
} from 'recharts'

const COLORS = {
  positive: '#10b981',
  neutral:  '#64748b',
  negative: '#ef4444',
}

const LABELS = {
  positive: 'Positive',
  neutral:  'Neutral',
  negative: 'Negative',
}

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  const { name, value } = payload[0]
  return (
    <div className="bg-dark-700 border border-dark-400 rounded-xl p-3 shadow-card text-sm">
      <p className="text-slate-300 font-medium">{LABELS[name] || name}</p>
      <p className="text-slate-100 font-bold">{value} reviews</p>
    </div>
  )
}

const CustomLegend = ({ data, total }) => (
  <div className="flex flex-col gap-2.5 mt-2">
    {data.map(item => {
      const pct = total > 0 ? Math.round((item.value / total) * 100) : 0
      return (
        <div key={item.name} className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: COLORS[item.name] || '#64748b' }}
            />
            <span className="text-sm text-slate-400">{LABELS[item.name] || item.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-200">{item.value}</span>
            <span className="text-xs text-slate-500">({pct}%)</span>
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
        <p className="text-sm">No sentiment data yet</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={50}
            outerRadius={78}
            paddingAngle={3}
            dataKey="value"
            strokeWidth={0}
          >
            {chartData.map((entry) => (
              <Cell
                key={entry.name}
                fill={COLORS[entry.name] || '#64748b'}
                style={{ filter: 'drop-shadow(0 0 6px rgba(0,0,0,0.5))' }}
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>

      {/* Center label overlay using absolute positioning trick */}
      <div className="relative -mt-[206px] mb-[26px] flex items-center justify-center pointer-events-none">
        <div className="text-center">
          <p className="font-display font-bold text-2xl text-slate-100">{total}</p>
          <p className="text-xs text-slate-500">reviews</p>
        </div>
      </div>

      <CustomLegend data={chartData} total={total} />
    </div>
  )
}
