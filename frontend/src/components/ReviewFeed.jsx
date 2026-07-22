import { Star, MessageCircle, ExternalLink, ThumbsUp, ThumbsDown, Minus } from 'lucide-react'
import clsx from 'clsx'

const SOURCE_STYLES = {
  google:      { label: 'Google',      bg: 'bg-blue-500/10',    text: 'text-blue-400',    border: 'border-blue-500/20',    dot: '#3b82f6' },
  zomato:      { label: 'Zomato',      bg: 'bg-red-500/10',     text: 'text-red-400',     border: 'border-red-500/20',     dot: '#ef4444' },
  tripadvisor: { label: 'TripAdvisor', bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20', dot: '#10b981' },
}

const SENTIMENT_CONFIG = {
  positive: { icon: ThumbsUp,   cls: 'badge-positive', label: 'Positive' },
  negative: { icon: ThumbsDown, cls: 'badge-negative', label: 'Negative' },
  neutral:  { icon: Minus,      cls: 'badge-neutral',  label: 'Neutral'  },
}

function StarRating({ rating }) {
  if (!rating) return null
  const full = Math.floor(rating)
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={11}
          className={i < full ? 'text-amber-400 fill-amber-400' : 'text-dark-400 fill-dark-400'}
        />
      ))}
      <span className="ml-1.5 text-xs font-bold text-amber-400">{rating?.toFixed(1)}</span>
    </div>
  )
}

function ReviewCard({ review }) {
  const src = SOURCE_STYLES[review.source] || { label: review.source, bg: 'bg-dark-600', text: 'text-slate-400', border: 'border-dark-400', dot: '#64748b' }
  const sent = SENTIMENT_CONFIG[review.sentiment]
  const SentIcon = sent?.icon

  return (
    <div className="card-hover p-4 animate-fade-in group">
      {/* Top row */}
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Source */}
          <span className={clsx('badge text-[10px] capitalize', src.bg, src.text, src.border)}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: src.dot }} />
            {src.label}
          </span>
          {/* Sentiment */}
          {sent && (
            <span className={clsx(sent.cls, 'flex items-center gap-1 text-[10px]')}>
              <SentIcon size={9} />
              {sent.label}
            </span>
          )}
        </div>
        <StarRating rating={review.rating} />
      </div>

      {/* Review text */}
      <p className="text-xs text-slate-300 leading-relaxed line-clamp-3">
        {review.review_text || <span className="text-slate-500 italic">No text available</span>}
      </p>

      {/* Complaint tags */}
      {review.complaint_categories?.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {review.complaint_categories.map(cat => (
            <span
              key={cat}
              className="px-1.5 py-0.5 rounded-md bg-dark-600/80 text-slate-500 text-[10px] border border-dark-400/60"
            >
              {cat}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-3 pt-2 border-t border-dark-600/60">
        <div className="flex items-center gap-1.5">
          <div className="w-5 h-5 rounded-full bg-dark-600 flex items-center justify-center text-[9px] font-bold text-slate-400">
            {(review.reviewer_name || 'A')[0].toUpperCase()}
          </div>
          <span className="text-[11px] text-slate-500 truncate max-w-[100px]">
            {review.reviewer_name || 'Anonymous'}
          </span>
        </div>
        <span className="text-[10px] text-slate-600">
          {review.review_date
            ? new Date(review.review_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })
            : '—'}
        </span>
      </div>
    </div>
  )
}

export default function ReviewFeed({ reviews = [], loading = false }) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton h-28 w-full rounded-2xl" />
        ))}
      </div>
    )
  }

  if (!reviews.length) {
    return (
      <div className="flex flex-col items-center justify-center h-32 text-slate-600 gap-2">
        <MessageCircle size={22} className="opacity-30" />
        <p className="text-xs">No reviews to display</p>
      </div>
    )
  }

  return (
    <div className="space-y-3 max-h-[480px] overflow-y-auto pr-0.5">
      {reviews.map(review => (
        <ReviewCard key={review.id} review={review} />
      ))}
    </div>
  )
}
