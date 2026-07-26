import { useState } from 'react'
import { Sparkles, RefreshCw, Loader2, AlertCircle } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { generateInsights } from '../api/client'
import { useNotifications } from '../context/NotificationsContext'

export default function AIInsightsPanel({ restaurantId, initialInsights = null }) {
  const { addNotification } = useNotifications()
  const [insights, setInsights] = useState(initialInsights)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleGenerate = async (forceRefresh = false) => {
    if (!restaurantId) {
      setError('Please select an outlet first')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const data = await generateInsights(restaurantId, forceRefresh)
      setInsights(data.insights)
      addNotification({
        type: 'info',
        title: '🤖 AI Insights ready',
        sub: 'New recommendations have been generated.',
      })
    } catch (e) {
      const message = e.response?.data?.detail || 'Failed to generate insights. Check your Gemini API key.'
      setError(message)
      addNotification({
        type: 'alert',
        title: '❌ AI Insights generation failed',
        sub: message,
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Panel header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-violet-500 to-purple-700 rounded-lg flex items-center justify-center shadow-lg">
            <Sparkles size={15} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-200">AI Recommendations</p>
            <p className="text-xs text-slate-500">Powered by Google Gemini</p>
          </div>
        </div>

        <div className="flex gap-2">
          {insights && (
            <button
              onClick={() => handleGenerate(true)}
              disabled={loading}
              className="btn-ghost text-xs px-3 py-1.5"
              title="Regenerate insights"
            >
              {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              Refresh
            </button>
          )} 
          {!insights && !loading && (
            <button
              onClick={() => handleGenerate(false)}
              className="btn-primary text-sm py-2 px-4"
              disabled={!restaurantId}
            >
              <Sparkles size={14} />
              Generate Insights
            </button>
          )} 
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto">
        {loading && (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-2 border-dark-500" />
              <div className="absolute inset-0 w-12 h-12 rounded-full border-t-2 border-violet-500 animate-spin" />
              <Sparkles size={16} className="absolute inset-0 m-auto text-violet-400" />
            </div>
            <div className="text-center">
              <p className="text-sm text-slate-300 font-medium">Analyzing review patterns…</p>
              <p className="text-xs text-slate-500 mt-1">Gemini is generating operational recommendations</p>
            </div>
          </div>
        )}

        {error && !loading && (
          <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
            <AlertCircle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-red-300 font-medium">Generation Failed</p>
              <p className="text-xs text-red-400/80 mt-1">{error}</p>
            </div>
          </div>
        )}

        {!loading && !error && !insights && (
          <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
            <div className="w-14 h-14 rounded-2xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
              <Sparkles size={22} className="text-violet-400" />
            </div>
            <div>
              <p className="text-sm text-slate-300 font-medium">No insights generated yet</p>
              <p className="text-xs text-slate-500 mt-1">
                Select an outlet and click Generate Insights<br />to get AI-powered recommendations
              </p>
            </div>
          </div>
        )}

        {!loading && insights && (
          <div className="prose-insights animate-fade-in">
            <ReactMarkdown>{insights}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  )
}