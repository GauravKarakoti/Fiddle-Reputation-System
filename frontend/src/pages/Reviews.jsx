import { useState, useEffect, useCallback } from 'react'
import { Filter, Play, Loader2, RefreshCw, CheckCircle2 } from 'lucide-react'
import Header from '../components/Header'
import ReviewFeed from '../components/ReviewFeed'
import { getRestaurants, getReviews, triggerScrape, getScrapeStatus, processNLP, getNlpStatus } from '../api/client'
import { useNotifications } from '../context/NotificationsContext'

const SENTIMENT_OPTIONS = ['', 'positive', 'neutral', 'negative']
const SOURCE_OPTIONS = ['', 'google', 'zomato', 'tripadvisor']

export default function Reviews() {
  const { addNotification } = useNotifications()

  const [restaurants, setRestaurants] = useState([])
  const [reviews, setReviews]         = useState([])
  const [total, setTotal]             = useState(0)
  const [page, setPage]               = useState(1)
  const [loading, setLoading]         = useState(false)

  const [selectedOutlet, setSelectedOutlet] = useState('')
  const [sentiment, setSentiment]           = useState('')
  const [source, setSource]                 = useState('')

  const [scrapeJob, setScrapeJob]     = useState(null)
  const [scrapeLoading, setScrapeLoading] = useState(false)
  const [nlpJob, setNlpJob]           = useState(null)
  const [nlpLoading, setNlpLoading]   = useState(false)

  const PAGE_SIZE = 20

  const outletName = (id) => restaurants.find(r => r.id === id)?.name || 'the selected outlet'

  // Load restaurants
  useEffect(() => {
    getRestaurants().then(d => setRestaurants(d.items || []))
  }, [])

  const loadReviews = useCallback(async () => {
    if (!selectedOutlet) return
    setLoading(true)
    try {
      const data = await getReviews(selectedOutlet, {
        sentiment: sentiment || undefined,
        source: source || undefined,
        page,
        page_size: PAGE_SIZE,
      })
      setReviews(data.items || [])
      setTotal(data.total || 0)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [selectedOutlet, sentiment, source, page])

  useEffect(() => { loadReviews() }, [loadReviews])

  // Poll scrape job — fires a real notification exactly once, at the moment
  // the job actually finishes (not when it's merely queued).
  useEffect(() => {
    if (!scrapeJob || scrapeJob.status === 'completed' || scrapeJob.status === 'failed') return
    const interval = setInterval(async () => {
      try {
        const status = await getScrapeStatus(scrapeJob.job_id)
        setScrapeJob(status)
        if (status.status === 'completed') {
          loadReviews()
          addNotification({
            type: 'success',
            title: `✅ Scrape completed — ${outletName(status.restaurant_id)}`,
            sub: status.message || 'New reviews fetched successfully.',
          })
          clearInterval(interval)
        } else if (status.status === 'failed') {
          addNotification({
            type: 'alert',
            title: `❌ Scrape failed — ${outletName(status.restaurant_id)}`,
            sub: status.message || 'The scraping job could not complete.',
          })
          clearInterval(interval)
        }
      } catch { clearInterval(interval) }
    }, 2000)
    return () => clearInterval(interval)
  }, [scrapeJob, loadReviews])

  // Poll NLP job — same pattern as scrape. This was previously treating the
  // initial 202 "queued" response as the finished result; the backend
  // actually processes sentiment/categorization in the background and only
  // the status endpoint reflects real completion.
  useEffect(() => {
    if (!nlpJob || nlpJob.status === 'completed' || nlpJob.status === 'failed') return
    const interval = setInterval(async () => {
      try {
        const status = await getNlpStatus(nlpJob.job_id)
        setNlpJob(status)
        if (status.status === 'completed') {
          loadReviews()
          addNotification({
            type: 'success',
            title: '🧠 NLP analysis complete',
            sub: status.message || 'Reviews processed successfully.',
          })
          clearInterval(interval)
        } else if (status.status === 'failed') {
          addNotification({
            type: 'alert',
            title: '❌ NLP processing failed',
            sub: status.message || 'The analysis job could not complete.',
          })
          clearInterval(interval)
        }
      } catch { clearInterval(interval) }
    }, 3000)
    return () => clearInterval(interval)
  }, [nlpJob, loadReviews])

  const handleScrape = async () => {
    if (!selectedOutlet) return
    setScrapeLoading(true)
    try {
      const job = await triggerScrape(selectedOutlet, { max_reviews: 50 })
      setScrapeJob(job)
    } catch (e) {
      console.error(e)
    } finally {
      setScrapeLoading(false)
    }
  }

  const handleNLP = async () => {
    setNlpLoading(true)
    try {
      const job = await processNLP(selectedOutlet || undefined)
      setNlpJob(job) // {job_id, status: "pending", ...} — polling above takes over from here
    } catch (e) {
      console.error(e)
    } finally {
      setNlpLoading(false)
    }
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="flex flex-col h-full">
      <Header title="Reviews" subtitle={`${total.toLocaleString()} reviews found`} />

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* Controls */}
        <div className="card p-4 flex flex-wrap gap-3 items-end">
          {/* Outlet selector */}
          <div className="flex flex-col gap-1 min-w-48">
            <label className="text-xs text-slate-500">Outlet</label>
            <select
              className="bg-dark-600 border border-dark-400 rounded-xl px-3 py-2 text-sm text-slate-200 outline-none focus:border-brand-500"
              value={selectedOutlet}
              onChange={e => { setSelectedOutlet(e.target.value); setPage(1) }}
            >
              <option value="">— Select outlet —</option>
              {restaurants.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>

          {/* Source filter */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500">Platform</label>
            <select
              className="bg-dark-600 border border-dark-400 rounded-xl px-3 py-2 text-sm text-slate-200 outline-none focus:border-brand-500"
              value={source}
              onChange={e => { setSource(e.target.value); setPage(1) }}
            >
              {SOURCE_OPTIONS.map(s => (
                <option key={s} value={s}>{s ? s.charAt(0).toUpperCase() + s.slice(1) : 'All Platforms'}</option>
              ))}
            </select>
          </div>

          {/* Sentiment filter */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500">Sentiment</label>
            <select
              className="bg-dark-600 border border-dark-400 rounded-xl px-3 py-2 text-sm text-slate-200 outline-none focus:border-brand-500"
              value={sentiment}
              onChange={e => { setSentiment(e.target.value); setPage(1) }}
            >
              {SENTIMENT_OPTIONS.map(s => (
                <option key={s} value={s}>{s ? s.charAt(0).toUpperCase() + s.slice(1) : 'All Sentiments'}</option>
              ))}
            </select>
          </div>

          <div className="flex-1" />

          {/* Action buttons */}
          <button
            onClick={handleScrape}
            disabled={!selectedOutlet || scrapeLoading || scrapeJob?.status === 'running'}
            className="btn-primary"
          >
            {scrapeLoading || scrapeJob?.status === 'running'
              ? <Loader2 size={14} className="animate-spin" />
              : <Play size={14} />}
            {scrapeJob?.status === 'running' ? 'Scraping…' : 'Scrape Reviews'}
          </button>

          <button
            onClick={handleNLP}
            disabled={nlpLoading || nlpJob?.status === 'pending' || nlpJob?.status === 'running'}
            className="bg-violet-600 hover:bg-violet-700 text-white font-semibold px-4 py-2.5 rounded-xl flex items-center gap-2 text-sm transition-all disabled:opacity-60"
          >
            {nlpLoading || nlpJob?.status === 'pending' || nlpJob?.status === 'running'
              ? <Loader2 size={14} className="animate-spin" />
              : <RefreshCw size={14} />}
            {nlpJob?.status === 'running' ? 'Processing…' : nlpJob?.status === 'pending' ? 'Queued…' : 'Run NLP'}
          </button>
        </div>

        {/* Status messages */}
        {scrapeJob && (
          <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm border ${
            scrapeJob.status === 'completed' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
            scrapeJob.status === 'failed'    ? 'bg-red-500/10 border-red-500/20 text-red-400' :
            'bg-brand-500/10 border-brand-500/20 text-brand-400'
          }`}>
            {(scrapeJob.status === 'running' || scrapeJob.status === 'pending') && <Loader2 size={14} className="animate-spin" />}
            {scrapeJob.status === 'completed' && <CheckCircle2 size={14} />}
            <span>{scrapeJob.message} ({scrapeJob.status})</span>
          </div>
        )}
        {nlpJob && (
          <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm border ${
            nlpJob.status === 'completed' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
            nlpJob.status === 'failed'    ? 'bg-red-500/10 border-red-500/20 text-red-400' :
            'bg-violet-500/10 border-violet-500/20 text-violet-400'
          }`}>
            {(nlpJob.status === 'running' || nlpJob.status === 'pending') && <Loader2 size={14} className="animate-spin" />}
            {nlpJob.status === 'completed' && <CheckCircle2 size={14} />}
            <span>{nlpJob.message} ({nlpJob.status})</span>
          </div>
        )}

        {/* Review list */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="section-title mb-0">
              Reviews {selectedOutlet ? '' : '— select an outlet above'}
            </p>
            {total > 0 && (
              <span className="text-xs text-slate-500">
                Page {page} of {totalPages}
              </span>
            )}
          </div>

          <ReviewFeed reviews={reviews} loading={loading} />

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t border-dark-500">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-ghost px-3 py-1.5 text-sm disabled:opacity-40"
              >← Prev</button>
              <span className="text-sm text-slate-500">{page} / {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="btn-ghost px-3 py-1.5 text-sm disabled:opacity-40"
              >Next →</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}