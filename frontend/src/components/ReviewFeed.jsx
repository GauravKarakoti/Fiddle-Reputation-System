import { Star, MessageCircle, ExternalLink } from 'lucide-react'
import clsx from 'clsx'

const SOURCE_COLORS = {
  google:      { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' },
  zomato:      { bg: 'bg-red-500/10',  text: 'text-red-400',  border: 'border-red-500/20'  },
  tripadvisor: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
}

function StarRating({ rating }) {
  if (!rating) return null
  const full = Math.floor(rating)
  const half = rating - full >= 0.5

  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={12}
          className={i < full ? 'text-amber-400 fill-amber-400' : 'text-slate-600'}
        />
      ))}
      <span className="ml-1.5 text-xs font-semibold text-amber-400">{rating?.toFixed(1)}</span>
    </div>
  )
}

function ReviewCard({ review }) {
  const sourceStyle = SOURCE_COLORS[review.source] || {}
  const sentimentClass = {
    positive: 'badge-positive',
    negative: 'badge-negative',
    neutral:  'badge-neutral',
  }[review.sentiment] || 'badge-neutral'

  return (
    <div className="card-hover p-4 animate-fade-in">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Source badge */}
          <span className={clsx(
            'badge text-xs capitalize',
            sourceStyle.bg, sourceStyle.text, sourceStyle.border
          )}>
            {review.source}
          </span>
          {/* Sentiment badge */}
          {review.sentiment && (
            <span className={sentimentClass}>
              {review.sentiment}
            </span>
          )}
        </div>
        <StarRating rating={review.rating} />
      </div>

      {/* Review text */}
      <p className="text-sm text-slate-300 leading-relaxed line-clamp-3">
        {review.review_text || <span className="text-slate-500 italic">No text available</span>}
      </p>

      {/* Categories */}
      {review.complaint_categories?.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {review.complaint_categories.map(cat => (
            <span
              key={cat}
              className="px-2 py-0.5 rounded-md bg-dark-600 text-slate-400 text-xs border border-dark-400"
            >
              {cat}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-3 pt-2 border-t border-dark-500">
        <div className="flex items-center gap-1.5">
          <div className="w-6 h-6 bg-dark-600 rounded-full flex items-center justify-center">
            <MessageCircle size={11} className="text-slate-400" />
          </div>
          <span className="text-xs text-slate-500">
            {review.reviewer_name || 'Anonymous'}
          </span>
        </div>
        <span className="text-xs text-slate-600">
          {review.review_date
            ? new Date(review.review_date).toLocaleDateString('en-IN', {
                day: 'numeric', month: 'short', year: 'numeric'
              })
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
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-28 w-full rounded-2xl" />
        ))}
      </div>
    )
  }

  if (!reviews.length) {
    return (
      <div className="flex flex-col items-center justify-center h-32 text-slate-500 gap-2">
        <MessageCircle size={24} className="opacity-30" />
        <p className="text-sm">No reviews found</p>
      </div>
    )
  }

  return (
    <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
      {reviews.map(review => (
        <ReviewCard key={review.id} review={review} />
      ))}
    </div>
  )
}
