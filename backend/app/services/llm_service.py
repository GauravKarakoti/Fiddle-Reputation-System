"""
LLM Service: uses Google Gemini to analyze aggregated review trends
and generate operational recommendations for restaurant managers using Prisma.

Prompt engineering ensures structured, actionable output.
Results are cached in the analytics_cache table for 24 hours.
"""
import logging
import uuid
from datetime import datetime, timedelta
from typing import Optional

from prisma import Prisma

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

CACHE_TTL_HOURS = 24

SYSTEM_PROMPT = """You are an expert restaurant operations consultant for First Fiddle Restaurants.
Your job is to analyze customer review data and provide clear, specific, actionable recommendations
to help restaurant managers improve their service quality and customer satisfaction.

Respond in well-structured markdown with:
- A brief executive summary (2-3 sentences)
- Key Issues Found (bullet list with severity: 🔴 Critical / 🟡 Moderate / 🟢 Minor)
- Specific Operational Recommendations (numbered, each with a clear action and expected impact)
- Quick Wins (things that can be done in the next 7 days)

Be direct, practical, and avoid generic advice. Base all recommendations strictly on the data provided.
"""


async def generate_insights(
    restaurant_id: uuid.UUID,
    db: Prisma,
    force_refresh: bool = False,
) -> str:
    """
    Generate LLM-powered operational insights for a restaurant.

    1. Check cache — return cached insights if fresh (< 24h old)
    2. Aggregate review statistics from DB
    3. Call Gemini API with structured prompt
    4. Cache and return the result

    Args:
        restaurant_id: Target restaurant UUID
        db: Prisma client instance
        force_refresh: Bypass cache and regenerate

    Returns:
        Markdown-formatted insights string
    """
    # ── 1. Check cache ────────────────────────────────────────────────────
    if not force_refresh:
        cached = await _get_cached_insights(restaurant_id, db)
        if cached:
            logger.info(f"[LLMService] Returning cached insights for {restaurant_id}")
            return cached

    # ── 2. Aggregate review data ──────────────────────────────────────────
    try:
        data = await _aggregate_review_data(restaurant_id, db)
    except Exception as e:
        logger.error(f"[LLMService] Data aggregation failed: {e}")
        return "⚠️ Could not generate insights: insufficient review data."

    if data["total_reviews"] < 5:
        return (
            "📊 **Insufficient Data**\n\n"
            "At least 5 processed reviews are needed to generate meaningful insights. "
            f"Currently there are only **{data['total_reviews']}** processed reviews."
        )

    # ── 3. Call Gemini API ────────────────────────────────────────────────
    try:
        insights = await _call_gemini(data)
    except Exception as e:
        logger.error(f"[LLMService] Gemini call failed: {e}")
        return _fallback_insights(data)

    # ── 4. Cache result ───────────────────────────────────────────────────
    await _cache_insights(restaurant_id, insights, db)
    return insights


async def _aggregate_review_data(restaurant_id: uuid.UUID, db: Prisma) -> dict:
    """Aggregate review statistics needed for the LLM prompt."""
    # Fetch restaurant info
    restaurant = await db.restaurant.find_first(
        where={"id": str(restaurant_id)}
    )

    # Reviews that have been processed
    reviews = await db.review.find_many(
        where={
            "restaurant_id": str(restaurant_id),
            "processed_at": {"not": None},
        }
    )

    if not reviews:
        return {"total_reviews": 0}

    # Sentiment breakdown
    sentiment_counts = {"positive": 0, "neutral": 0, "negative": 0}
    for r in reviews:
        if r.sentiment:
            # Prisma returns string values or enums that match string
            sentiment_counts[r.sentiment] = sentiment_counts.get(r.sentiment, 0) + 1

    # Average rating
    ratings = [r.rating for r in reviews if r.rating is not None]
    avg_rating = round(sum(ratings) / len(ratings), 2) if ratings else None

    # Category frequency
    category_counts: dict[str, int] = {}
    for r in reviews:
        for cat in (r.complaint_categories or []):
            category_counts[cat] = category_counts.get(cat, 0) + 1

    # Top negative reviews (most recent 10)
    negative_reviews = sorted(
        [r for r in reviews if r.sentiment == "negative"],
        key=lambda r: r.scraped_at,
        reverse=True,
    )[:10]
    negative_excerpts = [
        f"- ({r.source}, {r.rating}★): {(r.review_text or '')[:200]}"
        for r in negative_reviews
    ]

    # Recent rating trend (last 30 days vs previous 30)
    recent_cutoff = datetime.utcnow() - timedelta(days=30)
    recent_ratings = [r.rating for r in reviews if r.rating and r.scraped_at >= recent_cutoff]
    older_ratings = [r.rating for r in reviews if r.rating and r.scraped_at < recent_cutoff]
    recent_avg = round(sum(recent_ratings) / len(recent_ratings), 2) if recent_ratings else None
    older_avg = round(sum(older_ratings) / len(older_ratings), 2) if older_ratings else None

    return {
        "restaurant_name": restaurant.name if restaurant else "Unknown",
        "branch_code": restaurant.branch_code if restaurant else "",
        "city": restaurant.city if restaurant else "",
        "total_reviews": len(reviews),
        "avg_rating": avg_rating,
        "recent_avg": recent_avg,
        "older_avg": older_avg,
        "sentiment_counts": sentiment_counts,
        "category_counts": dict(sorted(category_counts.items(), key=lambda x: -x[1])),
        "negative_excerpts": negative_excerpts,
    }


async def _call_gemini(data: dict) -> str:
    """Send aggregated data to Gemini and return markdown response."""
    import google.generativeai as genai

    if not settings.GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY not configured")

    genai.configure(api_key=settings.GEMINI_API_KEY)
    model = genai.GenerativeModel(
        model_name=settings.GEMINI_MODEL,
        system_instruction=SYSTEM_PROMPT,
    )

    # Build structured data prompt
    category_text = "\n".join(
        f"  - {cat}: {count} mentions"
        for cat, count in (data.get("category_counts") or {}).items()
    )

    trend_text = ""
    if data.get("recent_avg") and data.get("older_avg"):
        delta = round(data["recent_avg"] - data["older_avg"], 2)
        direction = "📈 improved" if delta > 0 else "📉 declined"
        trend_text = f"Rating trend (last 30d vs previous): {direction} by {abs(delta)} stars"

    negative_text = "\n".join(data.get("negative_excerpts", [])[:8])

    prompt = f"""
## Restaurant Review Analysis Report

**Outlet:** {data['restaurant_name']} ({data['branch_code']}) — {data['city']}
**Total Reviews Analyzed:** {data['total_reviews']}
**Overall Average Rating:** {data.get('avg_rating', 'N/A')} / 5.0
{trend_text}

### Sentiment Distribution
- Positive: {data['sentiment_counts'].get('positive', 0)} reviews
- Neutral: {data['sentiment_counts'].get('neutral', 0)} reviews
- Negative: {data['sentiment_counts'].get('negative', 0)} reviews

### Top Complaint Categories (by frequency)
{category_text or "No categories identified yet."}

### Sample Negative Reviews
{negative_text or "No negative reviews available."}

---
Based on this data, provide your operational recommendations for the restaurant manager.
"""

    response = model.generate_content(prompt)
    return response.text


def _fallback_insights(data: dict) -> str:
    """Generate rule-based insights when Gemini API is unavailable."""
    lines = [
        f"## 📊 Auto-Generated Insights — {data.get('restaurant_name', 'Restaurant')}",
        "",
        f"**Total Reviews:** {data.get('total_reviews', 0)} | "
        f"**Avg Rating:** {data.get('avg_rating', 'N/A')}★",
        "",
        "### Key Issues (by mention frequency)",
    ]

    cats = data.get("category_counts", {})
    for cat, count in list(cats.items())[:5]:
        severity = "🔴" if count > 10 else "🟡" if count > 5 else "🟢"
        lines.append(f"- {severity} **{cat}**: {count} mentions")

    sent = data.get("sentiment_counts", {})
    total = sum(sent.values()) or 1
    neg_pct = round(sent.get("negative", 0) / total * 100)

    lines += [
        "",
        f"### Summary",
        f"- {neg_pct}% of reviews are negative",
        "- Focus on top complaint categories above",
        "- Consider conducting a staff training session this week",
        "",
        "_⚠️ Connect your Gemini API key for AI-powered detailed recommendations._",
    ]
    return "\n".join(lines)


async def _get_cached_insights(restaurant_id: uuid.UUID, db: Prisma) -> Optional[str]:
    """Return cached LLM insights if not expired."""
    cutoff = datetime.utcnow() - timedelta(hours=CACHE_TTL_HOURS)
    cache = await db.analyticscache.find_first(
        where={
            "restaurant_id": str(restaurant_id),
            "llm_insights": {"not": None},
            "llm_generated_at": {"gte": cutoff}
        }
    )
    return cache.llm_insights if cache else None


async def _cache_insights(
    restaurant_id: uuid.UUID, insights: str, db: Prisma
) -> None:
    """Upsert LLM insights into analytics cache."""
    cache = await db.analyticscache.find_first(
        where={"restaurant_id": str(restaurant_id)}
    )

    if cache:
        await db.analyticscache.update(
            where={"id": cache.id},
            data={
                "llm_insights": insights,
                "llm_generated_at": datetime.utcnow()
            }
        )
    else:
        await db.analyticscache.create(
            data={
                "restaurant_id": str(restaurant_id),
                "period": "all",
                "llm_insights": insights,
                "llm_generated_at": datetime.utcnow()
            }
        )
