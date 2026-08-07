"""
PDF report generation: aggregates review data for a restaurant over a
chosen period (daily/weekly/monthly) into a clean HTML report, then renders
it to PDF using Playwright's headless Chromium — reusing the same browser
automation stack already used for scraping rather than adding a new PDF
dependency. (weasyprint in particular is notoriously painful to install on
Windows, which is why this deliberately avoids it.)
"""
import asyncio
import logging
import re
from datetime import datetime, timedelta, timezone
from typing import Optional

from prisma import Prisma
from playwright.async_api import async_playwright

from app.config import get_settings

logger = logging.getLogger(__name__)

PERIOD_DAYS = {"daily": 1, "weekly": 7, "monthly": 30}
PERIOD_LABELS = {"daily": "Last 24 Hours", "weekly": "Last 7 Days", "monthly": "Last 30 Days"}

CATEGORY_COLORS = {
    "Food Quality": "#f97316",
    "Service Delay": "#ef4444",
    "Staff Behavior": "#a855f7",
    "Pricing": "#eab308",
    "Cleanliness": "#06b6d4",
    "Ambience": "#10b981",
    "Other": "#64748b",
}


def _naive_utc(dt: Optional[datetime]) -> Optional[datetime]:
    """Normalize to naive UTC regardless of whether Prisma returned an aware
    or naive datetime for this field — see the same fix in llm_service.py
    for the background on why guessing wrong here breaks comparisons."""
    if dt is None:
        return None
    if dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


def _esc(text: Optional[str]) -> str:
    """Minimal HTML-escaping for review text dropped into the template."""
    if not text:
        return ""
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


async def _aggregate_report_data(restaurant_id: str, period: str, db: Prisma) -> dict:
    if period not in PERIOD_DAYS:
        raise ValueError(f"Invalid period '{period}'. Must be one of: {list(PERIOD_DAYS)}")

    days = PERIOD_DAYS[period]
    cutoff = datetime.utcnow() - timedelta(days=days)
    now = datetime.utcnow()

    restaurant = await db.restaurant.find_first(where={"id": restaurant_id})
    if not restaurant:
        raise ValueError("Restaurant not found")

    all_reviews = await db.review.find_many(where={"restaurant_id": restaurant_id})
    reviews = [
        r for r in all_reviews
        if _naive_utc(r.scraped_at) and _naive_utc(r.scraped_at) >= cutoff
    ]

    ratings = [r.rating for r in reviews if r.rating is not None]
    avg_rating = round(sum(ratings) / len(ratings), 2) if ratings else None

    sentiment_counts = {"positive": 0, "neutral": 0, "negative": 0}
    platform_counts: dict[str, int] = {}
    category_counts: dict[str, int] = {}

    for r in reviews:
        if r.sentiment:
            sentiment_counts[r.sentiment] = sentiment_counts.get(r.sentiment, 0) + 1
        if r.source:
            platform_counts[r.source] = platform_counts.get(r.source, 0) + 1
        for cat in (r.complaint_categories or []):
            category_counts[cat] = category_counts.get(cat, 0) + 1

    sent_total = sum(sentiment_counts.values()) or 1

    top_negative = sorted(
        [r for r in reviews if r.sentiment == "negative"],
        key=lambda r: _naive_utc(r.scraped_at) or datetime.min,
        reverse=True,
    )[:5]
    top_positive = sorted(
        [r for r in reviews if r.sentiment == "positive"],
        key=lambda r: _naive_utc(r.scraped_at) or datetime.min,
        reverse=True,
    )[:5]

    return {
        "restaurant": restaurant,
        "period": period,
        "period_label": PERIOD_LABELS[period],
        "range_start": cutoff,
        "range_end": now,
        "total_reviews": len(reviews),
        "avg_rating": avg_rating,
        "sentiment_counts": sentiment_counts,
        "sentiment_pct": {k: round(v / sent_total * 100) for k, v in sentiment_counts.items()},
        "platform_counts": platform_counts,
        "category_counts": dict(sorted(category_counts.items(), key=lambda x: -x[1])),
        "top_negative": top_negative,
        "top_positive": top_positive,
    }


def _fallback_ai_analysis(data: dict) -> str:
    """Rule-based analysis used when Gemini isn't configured or fails, so
    report generation never hard-fails on an AI outage."""
    cats = list(data["category_counts"].items())[:3]
    top_cats = ", ".join(c for c, _ in cats) or "no major categories"
    neg_pct = data["sentiment_pct"]["negative"]

    lines = [
        "## Summary",
        f"- This period saw {data['total_reviews']} reviews with an average rating of {data['avg_rating'] or 'N/A'}.",
        f"- {neg_pct}% of reviews were negative, most frequently citing {top_cats}.",
        "## Improvement Suggestions",
    ]
    for cat, count in cats:
        lines.append(
            f"- Address recurring **{cat}** complaints ({count} mentions this period) "
            "with targeted staff training or a process review."
        )
    if not cats:
        lines.append("- No specific complaint categories stood out this period — maintain current standards.")
    lines += [
        "## Future Predictions",
        f"- If **{top_cats or 'current issues'}** are not addressed, expect negative "
        f"sentiment to remain around {neg_pct}% or increase.",
        "- Connect a working Gemini API key for AI-generated, data-specific "
        "forecasting instead of this rule-based summary.",
    ]
    return "\n".join(lines)


async def _generate_ai_analysis(data: dict) -> str:
    """
    Generate a Summary / Improvement Suggestions / Future Predictions section
    scoped to this specific report's period data (not the same as the
    all-time cached AI Insights on the dashboard). Falls back to a rule-based
    version if Gemini isn't configured or the call fails.
    """
    settings = get_settings()

    category_text = "\n".join(
        f"  - {cat}: {count} mentions" for cat, count in data["category_counts"].items()
    ) or "  - No categories recorded"

    negative_excerpts = "\n".join(
        f"- ({r.source}, {r.rating}\u2605): {(r.review_text or '')[:200]}"
        for r in data["top_negative"]
    ) or "No negative reviews in this period."

    prompt = f"""You are a restaurant operations consultant analyzing a {data['period_label'].lower()} review report for {data['restaurant'].name}.

Data for this period:
- Total reviews: {data['total_reviews']}
- Average rating: {data['avg_rating'] or 'N/A'}
- Sentiment: {data['sentiment_counts']['positive']} positive, {data['sentiment_counts']['neutral']} neutral, {data['sentiment_counts']['negative']} negative
- Top complaint categories:
{category_text}
- Sample negative reviews:
{negative_excerpts}

Respond in exactly this structure, using "## " for each heading and "- " for
each bullet point, and nothing else (no extra commentary, no other markdown):

## Summary
(2-3 sentence plain-language summary of how this outlet performed in this period)

## Improvement Suggestions
(3-5 specific, actionable bullet points targeting the top complaint categories above)

## Future Predictions
(2-3 bullet points forecasting likely trends if current patterns continue \u2014 be specific about which categories are trending up or down, not generic)
"""

    if not settings.GEMINI_API_KEY:
        logger.warning("[ReportService] GEMINI_API_KEY not set \u2014 using fallback analysis")
        return _fallback_ai_analysis(data)

    try:
        import google.generativeai as genai
        genai.configure(api_key=settings.GEMINI_API_KEY)
        model = genai.GenerativeModel(model_name=settings.GEMINI_MODEL)
        response = await asyncio.to_thread(model.generate_content, prompt)
        return response.text
    except Exception as e:
        logger.error(f"[ReportService] Gemini call failed: {e}")
        return _fallback_ai_analysis(data)


def _render_ai_markdown(text: str) -> str:
    """
    Small, deliberately limited markdown-to-HTML converter for the AI
    analysis section. Escapes every line first (via _esc), so nothing from
    the model's output — which is itself downstream of review text, i.e.
    untrusted input — can inject raw HTML/script into the rendered PDF.
    Only the specific patterns below (##, -, **) are turned into tags
    afterward, on top of already-escaped text.
    """
    if not text or not text.strip():
        return '<p class="ai-para muted">No analysis available.</p>'

    lines = [_esc(line) for line in text.strip().split("\n")]
    html_parts = []
    in_list = False

    for line in lines:
        stripped = line.strip()
        if not stripped:
            if in_list:
                html_parts.append("</ul>")
                in_list = False
            continue
        if stripped.startswith("## "):
            if in_list:
                html_parts.append("</ul>")
                in_list = False
            html_parts.append(f'<h3 class="ai-heading">{stripped[3:].strip()}</h3>')
        elif stripped.startswith("- ") or stripped.startswith("\u2022 "):
            if not in_list:
                html_parts.append('<ul class="ai-list">')
                in_list = True
            html_parts.append(f"<li>{stripped[2:].strip()}</li>")
        else:
            if in_list:
                html_parts.append("</ul>")
                in_list = False
            html_parts.append(f'<p class="ai-para">{stripped}</p>')

    if in_list:
        html_parts.append("</ul>")

    html = "\n".join(html_parts)
    # **bold** -> <strong>bold</strong>. Safe here since the surrounding text
    # was already escaped above; this only wraps existing safe text in a tag,
    # it doesn't introduce any new raw HTML from the model's output.
    html = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", html)
    return html


def _build_html(data: dict, ai_analysis_html: str) -> str:
    r = data["restaurant"]
    generated = datetime.utcnow().strftime("%d %b %Y, %H:%M UTC")
    date_range = f'{data["range_start"].strftime("%d %b %Y")} \u2013 {data["range_end"].strftime("%d %b %Y")}'
    avg_rating_display = f'{data["avg_rating"]}\u2605' if data["avg_rating"] else '\u2014'

    max_cat = max(data["category_counts"].values()) if data["category_counts"] else 1
    category_rows = "".join(
        f'''
        <div class="cat-row">
          <span class="cat-label">{_esc(cat)}</span>
          <div class="cat-bar-track">
            <div class="cat-bar" style="width:{min(count / max_cat * 100, 100)}%; background:{CATEGORY_COLORS.get(cat, "#64748b")}"></div>
          </div>
          <span class="cat-count">{count}</span>
        </div>''' for cat, count in list(data["category_counts"].items())[:7]
    ) or '<p class="muted">No complaint categories recorded in this period.</p>'

    def review_block(review, tone):
        stars = "\u2605" * int(review.rating or 0) + "\u2606" * (5 - int(review.rating or 0))
        return f'''
        <div class="review-card review-{tone}">
          <div class="review-meta">
            <span class="stars">{stars}</span>
            <span class="source-tag">{_esc(review.source)}</span>
          </div>
          <p class="review-text">{_esc((review.review_text or "")[:280])}</p>
        </div>'''

    negative_html = "".join(review_block(rv, "negative") for rv in data["top_negative"]) \
        or '<p class="muted">No negative reviews in this period.</p>'
    positive_html = "".join(review_block(rv, "positive") for rv in data["top_positive"]) \
        or '<p class="muted">No positive reviews in this period.</p>'

    platform_html = "".join(
        f'<div class="platform-pill">{_esc(p.capitalize())}: <strong>{c}</strong></div>'
        for p, c in data["platform_counts"].items()
    ) or '<p class="muted">No platform data.</p>'

    return f'''<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{
    font-family: -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif;
    color: #1e293b;
    padding: 40px 48px;
    font-size: 13px;
    line-height: 1.5;
  }}
  .header {{
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 3px solid #f97316;
    padding-bottom: 16px;
    margin-bottom: 24px;
  }}
  .brand {{ font-size: 20px; font-weight: 800; color: #0f172a; }}
  .brand-sub {{ font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }}
  .meta {{ text-align: right; font-size: 11px; color: #64748b; }}
  .outlet-name {{ font-size: 22px; font-weight: 700; margin-bottom: 2px; }}
  .outlet-sub {{ font-size: 12px; color: #64748b; margin-bottom: 24px; }}
  .period-badge {{
    display: inline-block; background: #fff7ed; color: #ea580c;
    border: 1px solid #fed7aa; padding: 4px 12px; border-radius: 999px;
    font-size: 11px; font-weight: 600; margin-bottom: 24px;
  }}
  .stats-grid {{ display: flex; gap: 12px; margin-bottom: 28px; }}
  .stat-card {{
    flex: 1; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px;
    background: #f8fafc;
  }}
  .stat-label {{ font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em; }}
  .stat-value {{ font-size: 24px; font-weight: 800; color: #0f172a; margin-top: 4px; }}
  h2 {{ font-size: 14px; font-weight: 700; margin: 24px 0 12px; color: #0f172a;
        border-left: 4px solid #f97316; padding-left: 8px; }}
  .sentiment-bar {{ display: flex; height: 22px; border-radius: 6px; overflow: hidden; margin-bottom: 8px; }}
  .sentiment-legend {{ display: flex; gap: 16px; font-size: 11px; color: #475569; }}
  .cat-row {{ display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }}
  .cat-label {{ width: 120px; font-size: 11px; color: #334155; flex-shrink: 0; }}
  .cat-bar-track {{ flex: 1; background: #f1f5f9; border-radius: 4px; height: 12px; overflow: hidden; }}
  .cat-bar {{ height: 100%; border-radius: 4px; }}
  .cat-count {{ width: 28px; text-align: right; font-size: 11px; font-weight: 600; color: #0f172a; }}
  .platform-pill {{
    display: inline-block; background: #f1f5f9; border-radius: 999px;
    padding: 4px 12px; font-size: 11px; margin-right: 8px; color: #334155;
  }}
  .review-card {{ border-radius: 10px; padding: 12px 14px; margin-bottom: 10px; border-left: 4px solid; }}
  .review-negative {{ background: #fef2f2; border-color: #ef4444; }}
  .review-positive {{ background: #f0fdf4; border-color: #10b981; }}
  .review-meta {{ display: flex; justify-content: space-between; margin-bottom: 4px; }}
  .stars {{ color: #f59e0b; font-size: 12px; }}
  .source-tag {{ font-size: 10px; text-transform: uppercase; color: #64748b; letter-spacing: 0.04em; }}
  .review-text {{ font-size: 12px; color: #334155; }}
  .muted {{ color: #94a3b8; font-size: 12px; font-style: italic; }}
  .columns {{ display: flex; gap: 24px; }}
  .col {{ flex: 1; }}
  .ai-section {{
    background: linear-gradient(145deg, #faf5ff 0%, #f5f3ff 100%);
    border: 1px solid #ddd6fe;
    border-radius: 12px;
    padding: 18px 20px;
    margin-bottom: 8px;
  }}
  .ai-section-title {{
    font-size: 13px; font-weight: 700; color: #7c3aed;
    text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 10px;
  }}
  .ai-heading {{ font-size: 13px; font-weight: 700; color: #5b21b6; margin: 14px 0 6px; }}
  .ai-heading:first-child {{ margin-top: 0; }}
  .ai-para {{ font-size: 12px; color: #334155; margin-bottom: 6px; }}
  .ai-list {{ padding-left: 18px; margin-bottom: 8px; }}
  .ai-list li {{ font-size: 12px; color: #334155; margin-bottom: 4px; }}
  .footer {{ margin-top: 32px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 10px; color: #94a3b8; text-align: center; }}
</style>
</head>
<body>
  <div class="header">
    <div>
      <div class="brand">First Fiddle</div>
      <div class="brand-sub">Reputation Report</div>
    </div>
    <div class="meta">
      Generated {generated}<br>
      Period: {date_range}
    </div>
  </div>

  <div class="outlet-name">{_esc(r.name)}</div>
  <div class="outlet-sub">{_esc(r.branch_code)} \u00b7 {_esc(r.city)}</div>
  <div class="period-badge">{data["period_label"]}</div>

  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-label">Total Reviews</div>
      <div class="stat-value">{data["total_reviews"]}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Avg Rating</div>
      <div class="stat-value">{avg_rating_display}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Positive</div>
      <div class="stat-value" style="color:#10b981">{data["sentiment_pct"]["positive"]}%</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Negative</div>
      <div class="stat-value" style="color:#ef4444">{data["sentiment_pct"]["negative"]}%</div>
    </div>
  </div>

  <h2>AI Analysis</h2>
  <div class="ai-section">
    {ai_analysis_html}
  </div>

  <h2>Sentiment Distribution</h2>
  <div class="sentiment-bar">
    <div style="width:{data["sentiment_pct"]["positive"]}%; background:#10b981"></div>
    <div style="width:{data["sentiment_pct"]["neutral"]}%; background:#64748b"></div>
    <div style="width:{data["sentiment_pct"]["negative"]}%; background:#ef4444"></div>
  </div>
  <div class="sentiment-legend">
    <span>Positive: {data["sentiment_counts"]["positive"]}</span>
    <span>Neutral: {data["sentiment_counts"]["neutral"]}</span>
    <span>Negative: {data["sentiment_counts"]["negative"]}</span>
  </div>

  <h2>Top Complaint Categories</h2>
  {category_rows}

  <h2>Reviews by Platform</h2>
  {platform_html}

  <div class="columns">
    <div class="col">
      <h2>Recent Negative Reviews</h2>
      {negative_html}
    </div>
    <div class="col">
      <h2>Recent Positive Reviews</h2>
      {positive_html}
    </div>
  </div>

  <div class="footer">
    First Fiddle Reputation Platform &middot; Auto-generated report
  </div>
</body>
</html>'''


async def generate_report_pdf(restaurant_id: str, period: str, db: Prisma) -> bytes:
    """Aggregate review data, generate the AI analysis section, and render
    the whole thing to a PDF via headless Chromium."""
    data = await _aggregate_report_data(restaurant_id, period, db)
    ai_analysis_text = await _generate_ai_analysis(data)
    ai_analysis_html = _render_ai_markdown(ai_analysis_text)
    html = _build_html(data, ai_analysis_html)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=["--no-sandbox"])
        try:
            page = await browser.new_page()
            await page.set_content(html, wait_until="load")
            pdf_bytes = await page.pdf(
                format="A4",
                print_background=True,
                margin={"top": "0", "bottom": "0", "left": "0", "right": "0"},
            )
            return pdf_bytes
        finally:
            await browser.close()