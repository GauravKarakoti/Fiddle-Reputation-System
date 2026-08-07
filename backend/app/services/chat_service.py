import asyncio
import logging
from datetime import datetime, timedelta, timezone

from app.config import get_settings

logger = logging.getLogger(__name__)

MAX_HISTORY_TURNS = 10  # keep the prompt bounded as a conversation grows


def _naive_utc(dt):
    """Normalize to naive UTC regardless of whether Prisma returned an aware
    or naive datetime — see the same fix in llm_service.py/report_service.py."""
    if dt is None:
        return None
    if dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


async def _build_context(restaurant_id, db):
    """
    Aggregate real stats — either for one outlet or across all active
    outlets — to ground the assistant's answers in actual data rather than
    letting it guess or hallucinate numbers.
    """
    cutoff = datetime.utcnow() - timedelta(days=30)

    if restaurant_id:
        restaurant = await db.restaurant.find_first(where={"id": restaurant_id})
        if not restaurant:
            return "No outlet found with that ID."
        reviews = await db.review.find_many(where={"restaurant_id": restaurant_id})
        scope_label = "{0} ({1}, {2})".format(restaurant.name, restaurant.branch_code, restaurant.city)
    else:
        restaurants = await db.restaurant.find_many(where={"is_active": True})
        reviews = await db.review.find_many()
        scope_label = "All First Fiddle outlets ({0} active)".format(len(restaurants))

    recent = [
        r for r in reviews
        if _naive_utc(r.scraped_at) and _naive_utc(r.scraped_at) >= cutoff
    ]

    ratings = [r.rating for r in reviews if r.rating is not None]
    avg_rating = round(sum(ratings) / len(ratings), 2) if ratings else None

    sentiment_counts = {"positive": 0, "neutral": 0, "negative": 0}
    category_counts = {}
    for r in reviews:
        if r.sentiment:
            sentiment_counts[r.sentiment] = sentiment_counts.get(r.sentiment, 0) + 1
        for cat in (r.complaint_categories or []):
            category_counts[cat] = category_counts.get(cat, 0) + 1
    category_counts = dict(sorted(category_counts.items(), key=lambda x: -x[1])[:5])

    lines = []
    lines.append("SCOPE: {0}".format(scope_label))
    lines.append("Total reviews (all time): {0}".format(len(reviews)))
    lines.append("Reviews in last 30 days: {0}".format(len(recent)))
    lines.append("Average rating: {0}".format(avg_rating if avg_rating else "N/A"))
    lines.append(
        "Sentiment breakdown (all time): {0} positive, {1} neutral, {2} negative".format(
            sentiment_counts["positive"], sentiment_counts["neutral"], sentiment_counts["negative"]
        )
    )
    if category_counts:
        cat_text = ", ".join("{0} ({1})".format(c, n) for c, n in category_counts.items())
        lines.append("Top complaint categories: {0}".format(cat_text))
    else:
        lines.append("Top complaint categories: none recorded")

    return "\n".join(lines)


def _fallback_reply():
    return (
        "I'm having trouble reaching the AI service right now, so I can't answer that in "
        "detail. You can still check the Dashboard and Reviews pages directly for your "
        "current stats, or try asking me again in a moment."
    )


async def get_chat_reply(message, restaurant_id, history, db):
    """
    Generate a reply to a chat message, grounded in real review data for
    the given outlet (or all outlets if restaurant_id is None). `history`
    is a list of {"role": "user"|"assistant", "content": str} dicts from
    the current conversation, oldest first.
    """
    settings = get_settings()
    context = await _build_context(restaurant_id, db)

    system_instruction = (
        "You are the AI assistant built into the First Fiddle Reputation Management "
        "platform, helping a restaurant manager understand their customer reviews and "
        "reputation data. Answer using ONLY the data provided below \u2014 never invent "
        "numbers, categories, or reviews that aren't given to you. If the data doesn't "
        "cover what's being asked, say so plainly rather than guessing. Keep answers "
        "concise and practical, like a knowledgeable colleague, not a formal report. "
        "You can suggest operational actions based on the data, but always tie them "
        "back to a specific number or trend you were given.\n\n"
        "CURRENT DATA:\n{0}"
    ).format(context)

    if not settings.GEMINI_API_KEY:
        logger.warning("[ChatService] GEMINI_API_KEY not set")
        return _fallback_reply()

    try:
        import google.generativeai as genai
        genai.configure(api_key=settings.GEMINI_API_KEY)
        model = genai.GenerativeModel(
            model_name=settings.GEMINI_MODEL,
            system_instruction=system_instruction,
        )

        trimmed_history = history[-(MAX_HISTORY_TURNS * 2):] if history else []
        gemini_history = []
        for turn in trimmed_history:
            role = "model" if turn.get("role") == "assistant" else "user"
            gemini_history.append({"role": role, "parts": [turn.get("content", "")]})

        chat = model.start_chat(history=gemini_history)
        response = await asyncio.to_thread(chat.send_message, message)
        return response.text
    except Exception as e:
        logger.error("[ChatService] Gemini call failed: {0}".format(e))
        return _fallback_reply()