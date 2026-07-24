// import { useState, useEffect, useCallback } from 'react'
// import { Sparkles, Building2, Star, MessageCircle, AlertTriangle } from 'lucide-react'
// import Header from '../components/Header'
// import SentimentDonut from '../components/SentimentDonut'
// import ComplaintCategories from '../components/ComplaintCategories'
// import AIInsightsPanel from '../components/AIInsightsPanel'
// import { getRestaurants, getOutletAnalytics } from '../api/client'

// function StatCard({ icon: Icon, label, value, sub, color = 'brand' }) {
//   const colorMap = {
//     brand:   'from-brand-500/20 to-brand-600/10 border-brand-500/20 text-brand-400',
//     green:   'from-emerald-500/20 to-emerald-600/10 border-emerald-500/20 text-emerald-400',
//     red:     'from-red-500/20 to-red-600/10 border-red-500/20 text-red-400',
//     purple:  'from-violet-500/20 to-violet-600/10 border-violet-500/20 text-violet-400',
//   }
//   return (
//     <div className={`stat-card bg-gradient-to-br ${colorMap[color]} border p-4`}>
//       <div className="flex items-center justify-between">
//         <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">{label}</p>
//         <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-dark-700">
//           <Icon size={13} className={colorMap[color].split(' ').pop()} />
//         </div>
//       </div>
//       <p className="font-display font-bold text-xl text-slate-100 mt-1">{value ?? '—'}</p>
//       {sub && <p className="text-[10px] text-slate-500 mt-0.5 truncate">{sub}</p>}
//     </div>
//   )
// }

// export default function Insights() {
//   const [restaurants, setRestaurants] = useState([])
//   const [selectedOutlet, setSelectedOutlet] = useState('')
//   const [outletData, setOutletData] = useState(null)
//   const [loading, setLoading] = useState(true)
//   const [loadingOutlet, setLoadingOutlet] = useState(false)
//   const [refreshKey, setRefreshKey] = useState(0)

//   const loadInitial = useCallback(async () => {
//     setLoading(true)
//     try {
//       const rests = await getRestaurants()
//       const items = rests.items || []
//       setRestaurants(items)
//       if (items.length > 0) {
//         setSelectedOutlet(items[0].id)
//         await fetchOutletData(items[0].id)
//       }
//     } catch (e) {
//       console.error('Failed to load restaurants', e)
//     } finally {
//       setLoading(false)
//     }
//   }, [])

//   const fetchOutletData = async (outletId) => {
//     setLoadingOutlet(true)
//     try {
//       const data = await getOutletAnalytics(outletId)
//       setOutletData(data)
//     } catch (e) {
//       console.error('Failed to load outlet analytics', e)
//     } finally {
//       setLoadingOutlet(false)
//     }
//   }

//   useEffect(() => {
//     loadInitial()
//   }, [loadInitial, refreshKey])

//   const handleOutletChange = async (outletId) => {
//     setSelectedOutlet(outletId)
//     if (outletId) {
//       await fetchOutletData(outletId)
//     } else {
//       setOutletData(null)
//     }
//   }

//   const negPct = outletData
//     ? Math.round(
//         ((outletData.sentiment_counts?.negative || 0) /
//           Math.max(Object.values(outletData.sentiment_counts || {}).reduce((a, b) => a + b, 0), 1)) * 100
//       )
//     : 0

//   return (
//     <div className="flex flex-col h-full">
//       <Header
//         title="AI Insights"
//         subtitle="AI-powered operational recommendations and sentiment analysis for First Fiddle branches"
//         onRefresh={() => setRefreshKey(k => k + 1)}
//       />

//       <div className="flex-1 overflow-y-auto p-6 space-y-6">
//         {/* Controls */}
//         <div className="card p-4 flex flex-wrap gap-4 items-center justify-between">
//           <div className="flex items-center gap-3">
//             <div className="w-9 h-9 bg-gradient-to-br from-violet-500 to-purple-700 rounded-xl flex items-center justify-center shadow-lg">
//               <Sparkles size={16} className="text-white" />
//             </div>
//             <div>
//               <p className="font-semibold text-slate-100 text-sm">Select Outlet for AI Analysis</p>
//               <p className="text-xs text-slate-500">Analyze reviews and generate operational recommendations</p>
//             </div>
//           </div>

//           {restaurants.length > 0 && (
//             <div className="flex items-center gap-3">
//               <label className="text-xs text-slate-400">Viewing outlet:</label>
//               <select
//                 className="bg-dark-600 border border-dark-400 rounded-xl px-3 py-2 text-sm text-slate-200 outline-none focus:border-brand-500 transition-colors"
//                 value={selectedOutlet}
//                 onChange={e => handleOutletChange(e.target.value)}
//               >
//                 {restaurants.map(r => (
//                   <option key={r.id} value={r.id}>{r.name}</option>
//                 ))}
//               </select>
//             </div>
//           )}
//         </div>

//         {loading ? (
//           <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
//             <div className="skeleton h-[400px] rounded-2xl" />
//             <div className="lg:col-span-2 skeleton h-[500px] rounded-2xl" />
//           </div>
//         ) : !selectedOutlet ? (
//           <div className="flex flex-col items-center justify-center h-64 text-slate-500 gap-3">
//             <Building2 size={40} className="opacity-20" />
//             <p>Please select an outlet to start the AI Analysis.</p>
//           </div>
//         ) : (
//           <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
//             {/* Left: Outlet Data and Charts */}
//             <div className="space-y-6">
//               {/* Stat summary for outlet */}
//               <div className="grid grid-cols-2 gap-4">
//                 <StatCard
//                   icon={MessageCircle}
//                   label="Reviews"
//                   value={loadingOutlet ? '…' : outletData?.total_reviews}
//                   sub="Last 30 days"
//                   color="purple"
//                 />
//                 <StatCard
//                   icon={Star}
//                   label="Avg Rating"
//                   value={loadingOutlet ? '…' : outletData?.avg_rating ? `${outletData.avg_rating}★` : '—'}
//                   sub="Last 30 days"
//                   color="green"
//                 />
//                 <StatCard
//                   icon={AlertTriangle}
//                   label="Negative Rate"
//                   value={loadingOutlet ? '…' : `${negPct}%`}
//                   sub={`${outletData?.sentiment_counts?.negative || 0} reviews`}
//                   color={negPct > 30 ? 'red' : 'brand'}
//                 />
//               </div>

//               {/* Sentiment distribution for outlet */}
//               <div className="card p-5">
//                 <p className="text-xs text-slate-500 uppercase tracking-wider font-medium mb-3">Sentiment Distribution</p>
//                 {loadingOutlet ? (
//                   <div className="skeleton h-48 rounded-xl" />
//                 ) : (
//                   <SentimentDonut data={outletData?.sentiment_counts || {}} />
//                 )}
//               </div>

//               {/* Top complaints categories */}
//               <div className="card p-5">
//                 <p className="text-xs text-slate-500 uppercase tracking-wider font-medium mb-3">Key Feedback Categories</p>
//                 {loadingOutlet ? (
//                   <div className="skeleton h-48 rounded-xl" />
//                 ) : (
//                   <ComplaintCategories data={outletData?.category_counts || {}} />
//                 )}
//               </div>
//             </div>

//             {/* Right: AI Insights Panel */}
//             <div className="lg:col-span-2 card p-6 min-h-[500px]">
//               <AIInsightsPanel restaurantId={selectedOutlet} />
//             </div>
//           </div>
//         )}
//       </div>
//     </div>
//   )
// }
