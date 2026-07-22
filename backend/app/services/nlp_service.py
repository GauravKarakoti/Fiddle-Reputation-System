"""
NLP Service: processes unanalyzed reviews through the sentiment
and complaint categorization pipeline, then updates the database using Prisma.
"""
import asyncio
import logging
import uuid
from datetime import datetime
from typing import Optional

from prisma import Prisma

from app.nlp.sentiment import get_sentiment_analyzer
from app.nlp.categorizer import get_categorizer

logger = logging.getLogger(__name__)

BATCH_SIZE = 32

# In-memory job registry (use Redis for multi-worker production) — mirrors the
# pattern used by scraper_service so the frontend can poll instead of holding
# a single HTTP request open for the whole run.
_NLP_JOBS: dict[str, dict] = {}


async def get_nlp_job_status(job_id: str) -> Optional[dict]:
    return _NLP_JOBS.get(job_id)


async def trigger_nlp_processing(
    db: Prisma,
    restaurant_id: Optional[uuid.UUID] = None,
    limit: int = 500,
) -> str:
    """
    Start NLP processing as a background task and return a job_id immediately.
    Poll get_nlp_job_status(job_id) for progress/completion.
    """
    job_id = str(uuid.uuid4())
    _NLP_JOBS[job_id] = {
        "job_id": job_id,
        "status": "pending",
        "processed": 0,
        "message": "Job queued",
        "started_at": datetime.utcnow().isoformat(),
        "completed_at": None,
    }
    asyncio.create_task(
        _run_nlp_job(job_id, db, restaurant_id, limit)
    )
    return job_id


async def _run_nlp_job(
    job_id: str,
    db: Prisma,
    restaurant_id: Optional[uuid.UUID],
    limit: int,
) -> None:
    _NLP_JOBS[job_id]["status"] = "running"
    try:
        count = await process_pending_reviews(db=db, restaurant_id=restaurant_id, limit=limit)
        _NLP_JOBS[job_id]["processed"] = count
        _NLP_JOBS[job_id]["status"] = "completed"
        _NLP_JOBS[job_id]["message"] = f"NLP analysis complete for {count} reviews"
        _NLP_JOBS[job_id]["completed_at"] = datetime.utcnow().isoformat()
    except Exception as e:
        logger.exception(f"[NLPService] Job {job_id} failed")
        _NLP_JOBS[job_id]["status"] = "failed"
        _NLP_JOBS[job_id]["message"] = str(e)
        _NLP_JOBS[job_id]["completed_at"] = datetime.utcnow().isoformat()


async def process_pending_reviews(
    db: Prisma,
    restaurant_id: Optional[uuid.UUID] = None,
    limit: int = 500,
) -> int:
    """
    Run NLP pipeline on all reviews that have not yet been processed.

    Args:
        db: Prisma client instance
        restaurant_id: Filter to a specific restaurant (None = all)
        limit: Max reviews to process in one call

    Returns:
        Number of reviews processed
    """
    where = {"processed_at": None}
    if restaurant_id:
        where["restaurant_id"] = str(restaurant_id)

    reviews = await db.review.find_many(
        where=where,
        take=limit
    )

    if not reviews:
        logger.info("[NLPService] No pending reviews to process")
        return 0

    logger.info(f"[NLPService] Processing {len(reviews)} reviews...")

    analyzer = get_sentiment_analyzer()
    categorizer = get_categorizer()

    # Extract texts for batch processing
    texts = [r.review_text or "" for r in reviews]

    # Batch sentiment analysis + categorization — both call synchronous,
    # CPU-bound HuggingFace pipelines under the hood. Running them directly
    # inside this async function would block the ENTIRE event loop for the
    # whole duration (which is what was happening: the server looked frozen
    # and no other request, including simple polling, could be served).
    # asyncio.to_thread offloads the blocking work to a worker thread so the
    # event loop stays free to serve other requests concurrently.
    sentiment_results = await asyncio.to_thread(
        analyzer.analyze_batch, texts, BATCH_SIZE
    )
    category_results = await asyncio.to_thread(
        categorizer.categorize_batch, texts
    )

    now = datetime.utcnow()
    processed_count = 0

    # These are independent, unrelated row updates — there's no atomicity
    # requirement between "review A's sentiment" and "review B's sentiment" —
    # so a single interactive transaction is the wrong tool here. Prisma's
    # interactive transactions default to a 5000ms timeout, and a loop of
    # 100+ sequential updates can easily blow past that, which is exactly
    # what was happening (the transaction closed mid-loop and every update
    # after that point failed with "Transaction already closed").
    # Plain per-row updates avoid that ceiling entirely.
    for r, sent, cats in zip(reviews, sentiment_results, category_results):
        try:
            await db.review.update(
                where={"id": r.id},
                data={
                    "sentiment": sent.label,
                    "sentiment_score": round(sent.compound, 4),
                    "complaint_categories": cats.categories,
                    "processed_at": now
                }
            )
            processed_count += 1
        except Exception as e:
            logger.warning(f"[NLPService] Failed to update review {r.id}: {e}")

    logger.info(f"[NLPService] Successfully processed {processed_count} reviews")
    return processed_count