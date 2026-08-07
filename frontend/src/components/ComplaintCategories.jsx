import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Cell, ResponsiveContainer
} from 'recharts'

const CATEGORY_COLORS = {
  'Food Quality':   '#FAAF1D', // Brand Yellow
  'Service Delay':  '#C16D32', // Warm amber-rust
  'Staff Behavior': '#543721', // Lighter coffee
  'Pricing':        '#D8CDB6', // Soft Linen variant
  'Cleanliness':    '#687680', // Slate carbon
  'Ambience':       '#A39B87', // Muted gold-gray
  'Other':          '#4B545A', // Dark gray carbon
}

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  const { name, value } = payload[0].payload
  return (
    <div className="bg-dark-700 border border-dark-400 rounded-xl p-3 shadow-card text-sm">
      <p className="text-slate-300 font-medium mb-1">{name}</p>
      <p className="text-slate-100 font-bold">{value} mentions</p>
    </div>
  )
}

export default function ComplaintCategories({ data = {} }) {
  const chartData = Object.entries(data)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)

  if (!chartData.length) {
    return (
      <div className="flex items-center justify-center h-48 text-slate-500">
        <p className="text-sm">No complaint data yet</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <ResponsiveContainer width="100%" height={200}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fill: '#64748b', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={110}
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
          <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={20}>
            {chartData.map((entry) => (
              <Cell
                key={entry.name}
                fill={CATEGORY_COLORS[entry.name] || '#64748b'}
                fillOpacity={0.85}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Category pills */}
      <div className="flex flex-wrap gap-2 pt-1">
        {chartData.map(({ name, value }) => (
          <div
            key={name}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-dark-600 border border-dark-400 text-xs"
          >
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: CATEGORY_COLORS[name] || '#64748b' }}
            />
            <span className="text-slate-400">{name}</span>
            <span className="font-semibold text-slate-200">{value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
