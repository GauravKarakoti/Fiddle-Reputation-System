"""FastAPI router: Reviews retrieval and scraping job management using Prisma."""
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from prisma import Prisma

from app.database import get_db
from app.schemas.review import (
    ReviewListResponse,
    ReviewResponse,
    ScrapeJobStatus,
    ScrapeRequest,
)
from app.services import scraper_service, nlp_service

router = APIRouter(prefix="/api", tags=["Reviews & Scraping"])


# ── Scraping ─────────────────────────────────────────────────────────────────

@router.post(
    "/scrape/{restaurant_id}",
    response_model=ScrapeJobStatus,
    status_code=202,
    summary="Trigger review scraping for an outlet",
)
async def trigger_scrape(
    restaurant_id: uuid.UUID,
    payload: ScrapeRequest,
    db: Prisma = Depends(get_db),
):
    """
    Trigger an asynchronous review scraping job for the given outlet.
    Optionally specify a platform ('google', 'zomato', 'tripadvisor', 'swiggy').
    Leave unset to scrape every platform configured for the outlet — Google
    is always attempted, and zomato/tripadvisor/swiggy are included
    automatically whenever the outlet has a URL saved for them.
    Poll /api/scrape/status/{job_id} to check progress.
    """
    job_id = await scraper_service.trigger_scrape(
        restaurant_id=restaurant_id,
        db=db,
        platform=payload.platform,
        max_reviews=payload.max_reviews or 50,
    )
    return ScrapeJobStatus(
        job_id=job_id,
        restaurant_id=restaurant_id,
        platform=payload.platform,
        status="pending",
        message="Scraping job queued",
    )


@router.get(
    "/scrape/status/{job_id}",
    response_model=ScrapeJobStatus,
    summary="Poll scraping job status",
)
async def get_scrape_status(job_id: str):
    """Returns the current status of a scraping job."""
    job = await scraper_service.get_job_status(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return ScrapeJobStatus(**job)


# ── NLP Processing ────────────────────────────────────────────────────────────

@router.post(
    "/reviews/process-nlp",
    response_model=ScrapeJobStatus,
    status_code=202,
    summary="Trigger NLP pipeline on unprocessed reviews (background job)",
)
async def process_nlp(
    restaurant_id: Optional[uuid.UUID] = Query(None),
    limit: int = Query(500, ge=1, le=2000),
    db: Prisma = Depends(get_db),
):
    """
    Trigger NLP analysis (sentiment + complaint categories) on all
    unprocessed reviews. Runs as a background job — poll
    /api/reviews/process-nlp/status/{job_id} for progress, since sentiment
    and zero-shot categorization can take several minutes for larger batches
    and would otherwise hold the request open the whole time.
    """
    job_id = await nlp_service.trigger_nlp_processing(
        db=db, restaurant_id=restaurant_id, limit=limit
    )
    return ScrapeJobStatus(
        job_id=job_id,
        restaurant_id=restaurant_id or uuid.UUID(int=0),
        status="pending",
        message="NLP processing job queued",
    )


@router.get(
    "/reviews/process-nlp/status/{job_id}",
    summary="Poll NLP processing job status",
)
async def get_nlp_status(job_id: str):
    """Returns the current status of an NLP processing job."""
    job = await nlp_service.get_nlp_job_status(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


# ── Review Retrieval ──────────────────────────────────────────────────────────

@router.get(
    "/reviews/{restaurant_id}",
    response_model=ReviewListResponse,
    summary="Get paginated reviews for an outlet",
)
async def get_reviews(
    restaurant_id: uuid.UUID,
    source: Optional[str] = Query(None, description="Filter by source platform"),
    sentiment: Optional[str] = Query(None, description="Filter by sentiment label"),
    min_rating: Optional[float] = Query(None, ge=1.0, le=5.0),
    max_rating: Optional[float] = Query(None, ge=1.0, le=5.0),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Prisma = Depends(get_db),
):
    """
    Retrieve paginated, filterable reviews for a restaurant outlet.
    Supports filtering by source platform, sentiment, and rating range.
    """
    where = {"restaurant_id": str(restaurant_id)}

    if source:
        where["source"] = source
    if sentiment:
        where["sentiment"] = sentiment

    rating_filter = {}
    if min_rating is not None:
        rating_filter["gte"] = min_rating
    if max_rating is not None:
        rating_filter["lte"] = max_rating
    if rating_filter:
        where["rating"] = rating_filter

    # Count total
    total = await db.review.count(where=where)

    # Fetch paginated items
    reviews = await db.review.find_many(
        where=where,
        order={"scraped_at": "desc"},
        skip=(page - 1) * page_size,
        take=page_size,
    )

    items = [ReviewResponse(**r.dict()) for r in reviews]

    return ReviewListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
    )