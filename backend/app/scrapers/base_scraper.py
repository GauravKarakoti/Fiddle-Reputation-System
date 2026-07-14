"""
Abstract base class for all review scrapers.
Every platform scraper must inherit from this and implement `scrape()`.
"""
import asyncio
import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import date
from typing import Optional
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


@dataclass
class RawReview:
    """
    Platform-agnostic review data structure returned by all scrapers.
    """
    source: str                          # 'google' | 'zomato' | 'tripadvisor'
    external_id: Optional[str] = None   # Platform's own review ID
    reviewer_name: Optional[str] = None
    rating: Optional[float] = None
    review_text: Optional[str] = None
    review_date: Optional[date] = None
    raw_metadata: dict = field(default_factory=dict)


class BaseScraper(ABC):
    """
    Abstract base scraper. All platform scrapers inherit from this class.

    Subclasses must implement:
        - async scrape(url: str, max_reviews: int) -> list[RawReview]
    """

    def __init__(self):
        self.delay = settings.SCRAPE_DELAY
        self.headers = {
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/125.0.0.0 Safari/537.36"
            ),
            "Accept-Language": "en-US,en;q=0.9",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        }

    @abstractmethod
    async def scrape(self, url: str, max_reviews: int = 50) -> list[RawReview]:
        """Scrape reviews from the given URL. Returns a list of RawReview objects."""
        pass

    async def _polite_delay(self) -> None:
        """Throttle requests to avoid rate limiting."""
        await asyncio.sleep(self.delay)

    def _normalize_rating(self, raw: str | float | int | None) -> Optional[float]:
        """Convert any rating format to a 1–5 float scale."""
        if raw is None:
            return None
        try:
            val = float(str(raw).replace(",", ".").split("/")[0].strip())
            # Some platforms use 1-10 or percentage scale
            if val > 5:
                val = val / 2.0
            return round(min(max(val, 1.0), 5.0), 1)
        except (ValueError, TypeError):
            return None

    def _parse_date(self, raw_date: str | None) -> Optional[date]:
        """Best-effort date parsing from scraped strings."""
        if not raw_date:
            return None
        from dateutil import parser as dateparser
        try:
            return dateparser.parse(raw_date, fuzzy=True).date()
        except Exception:
            return None
