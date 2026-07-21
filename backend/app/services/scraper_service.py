"""
Scraper service: orchestrates all platform scrapers,
deduplicates reviews, and persists them to the database using Prisma.
"""
import asyncio
import logging
import uuid
from datetime import datetime
from typing import Optional

from prisma import Prisma, Json

from app.scrapers.base_scraper import RawReview
from app.scrapers.google_scraper import GoogleScraper
from app.scrapers.zomato_scraper import ZomatoScraper
from app.scrapers.tripadvisor_scraper import TripAdvisorScraper
from app.scrapers.swiggy_scraper import SwiggyScraper

logger = logging.getLogger(__name__)

# In-memory job registry (use Redis for multi-worker production)
_JOBS: dict[str, dict] = {}


async def get_job_status(job_id: str) -> Optional[dict]:
    return _JOBS.get(job_id)


async def trigger_scrape(
    restaurant_id: uuid.UUID,
    db: Prisma,
    platform: Optional[str] = None,
    max_reviews: int = 50,
) -> str:
    """
    Start an async scraping job for a restaurant.
    Returns a job_id that can be polled for status.
    """
    job_id = str(uuid.uuid4())
    _JOBS[job_id] = {
        "job_id": job_id,
        "restaurant_id": str(restaurant_id),
        "platform": platform,
        "status": "pending",
        "reviews_scraped": 0,
        "message": "Job queued",
        "started_at": datetime.utcnow().isoformat(),
        "completed_at": None,
    }
    # Run in background without blocking the request
    asyncio.create_task(
        _run_scrape_job(job_id, restaurant_id, db, platform, max_reviews)
    )
    return job_id


async def _run_scrape_job(
    job_id: str,
    restaurant_id: uuid.UUID,
    db: Prisma,
    platform: Optional[str],
    max_reviews: int,
) -> None:
    """Background task: fetch restaurant, run scrapers, save reviews."""
    _JOBS[job_id]["status"] = "running"

    try:
        # Load restaurant
        restaurant = await db.restaurant.find_first(
            where={"id": str(restaurant_id)}
        )
        if not restaurant:
            raise ValueError(f"Restaurant {restaurant_id} not found")

        all_raw: list[RawReview] = []

        # Determine which platforms to scrape
        tasks = []
        if (platform is None or platform == "google") and restaurant.google_place_id:
            url = f"https://www.google.com/maps/place/?q=place_id:{restaurant.google_place_id}"
            tasks.append(("google", GoogleScraper(), url))

        if (platform is None or platform == "zomato") and restaurant.zomato_url:
            tasks.append(("zomato", ZomatoScraper(), restaurant.zomato_url))

        if (platform is None or platform == "tripadvisor") and restaurant.tripadvisor_url:
            tasks.append(("tripadvisor", TripAdvisorScraper(), restaurant.tripadvisor_url))

        if (platform is None or platform == "swiggy") and restaurant.swiggy_url:
            tasks.append(("swiggy", SwiggyScraper(), restaurant.swiggy_url))

        if not tasks:
            _JOBS[job_id]["status"] = "completed"
            _JOBS[job_id]["message"] = "No platform URLs configured for this restaurant"
            _JOBS[job_id]["completed_at"] = datetime.utcnow().isoformat()
            return

        # Run scrapers sequentially rather than concurrently. Launching multiple
        # headless Chromium instances at once competes for CPU/memory and has been
        # observed to prevent JS-heavy pages (Maps, Zomato, Swiggy, TripAdvisor)
        # from fully hydrating before their content is read — resulting in 0
        # reviews across the board even though each site works fine on its own.
        scraper_results = []
        for _, scraper, url in tasks:
            try:
                result = await scraper.scrape(url, max_reviews)
            except Exception as e:
                result = e
            scraper_results.append(result)

        for (plat, _, _), result in zip(tasks, scraper_results):
            if isinstance(result, Exception):
                logger.error(f"[ScraperService] {plat} scraper failed: {result}")
            else:
                all_raw.extend(result)

        # Deduplicate and save
        saved = await _save_reviews(restaurant_id, all_raw, db)
        _JOBS[job_id]["reviews_scraped"] = saved
        _JOBS[job_id]["status"] = "completed"
        _JOBS[job_id]["message"] = f"Scraped and saved {saved} new reviews"
        _JOBS[job_id]["completed_at"] = datetime.utcnow().isoformat()

    except Exception as e:
        logger.exception(f"[ScraperService] Job {job_id} failed")
        _JOBS[job_id]["status"] = "failed"
        _JOBS[job_id]["message"] = str(e)
        _JOBS[job_id]["completed_at"] = datetime.utcnow().isoformat()


async def _save_reviews(
    restaurant_id: uuid.UUID,
    raw_reviews: list[RawReview],
    db: Prisma,
) -> int:
    """Deduplicate by external_id and persist reviews to DB. Returns count saved."""
    if not raw_reviews:
        return 0

    # Fetch existing external_ids to avoid duplicates (removed unsupported 'select')
    reviews_existing = await db.review.find_many(
        where={
            "restaurant_id": str(restaurant_id),
            "external_id": {"not": None}
        }
    )
    existing_ids = {r.external_id for r in reviews_existing if r.external_id}

    saved_count = 0
    # Save newly scraped reviews using a Prisma transaction context
    async with db.tx() as transaction:
        for raw in raw_reviews:
            if raw.external_id and raw.external_id in existing_ids:
                continue  # Already stored
            if not raw.review_text and not raw.rating:
                continue  # Skip empty reviews

            review_datetime = None
            if raw.review_date:
                review_datetime = datetime.combine(raw.review_date, datetime.min.time())

            await transaction.review.create(
                data={
                    "restaurant_id": str(restaurant_id),  # Pass the FK directly as a string
                    "source": raw.source,
                    "external_id": raw.external_id,
                    "reviewer_name": raw.reviewer_name,
                    "rating": raw.rating,
                    "review_text": raw.review_text,
                    "review_date": review_datetime,
                    "raw_metadata": Json(raw.raw_metadata if raw.raw_metadata is not None else {}), # Wrap with Prisma's Json class
                    "scraped_at": datetime.utcnow(),
                }
            )
            saved_count += 1

    logger.info(f"[ScraperService] Saved {saved_count} new reviews for {restaurant_id}")
    return saved_count