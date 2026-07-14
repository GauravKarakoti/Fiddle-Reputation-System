"""
NLP Service: processes unanalyzed reviews through the sentiment
and complaint categorization pipeline, then updates the database using Prisma.
"""
import logging
import uuid
from datetime import datetime
from typing import Optional

from prisma import Prisma

from app.nlp.sentiment import get_sentiment_analyzer
from app.nlp.categorizer import get_categorizer

logger = logging.getLogger(__name__)

BATCH_SIZE = 32


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

    # Batch sentiment analysis
    sentiment_results = analyzer.analyze_batch(texts, batch_size=BATCH_SIZE)

    # Complaint categorization (one by one)
    category_results = categorizer.categorize_batch(texts)

    now = datetime.utcnow()
    processed_count = 0

    # Save updates using a Prisma transaction context
    async with db.tx() as transaction:
        for r, sent, cats in zip(reviews, sentiment_results, category_results):
            try:
                await transaction.review.update(
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
