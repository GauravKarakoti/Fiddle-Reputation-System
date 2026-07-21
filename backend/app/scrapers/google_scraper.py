"""
Google Reviews scraper using Playwright for dynamic content.
Google Reviews are loaded via JavaScript, so a headless browser is required.

Usage:
    scraper = GoogleScraper()
    reviews = await scraper.scrape(
        url="https://www.google.com/maps/place/...",
        max_reviews=50
    )

Note: Google does not provide an official reviews API for free.
This scraper navigates to the Maps page and extracts visible reviews.
For production use at scale, consider the Google Places API (paid).
"""
import asyncio
import logging
import re
from datetime import date
from typing import Optional

from playwright.async_api import async_playwright, Page, BrowserContext

from app.scrapers.base_scraper import BaseScraper, RawReview

logger = logging.getLogger(__name__)


class GoogleScraper(BaseScraper):
    """Scrapes customer reviews from Google Maps using Playwright."""

    async def scrape(self, url: str, max_reviews: int = 50) -> list[RawReview]:
        """
        Navigate to a Google Maps place URL and extract reviews.

        Args:
            url: Full Google Maps place URL with reviews tab
            max_reviews: Maximum number of reviews to collect

        Returns:
            List of RawReview objects
        """
        reviews = []

        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=True,
                channel="chrome",
                args=["--no-sandbox", "--disable-dev-shm-usage"]
            )
            context: BrowserContext = await browser.new_context(
                user_agent=self.headers["User-Agent"],
                locale="en-US",
                viewport={"width": 1280, "height": 800},
            )
            page: Page = await context.new_page()

            await page.add_init_script(
                "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"
            )

            try:
                logger.info(f"[Google] Navigating to: {url}")
                for attempt in range(2):
                    try:
                        await page.goto(url, wait_until="domcontentloaded", timeout=45000)
                        break
                    except Exception as e:
                        if attempt == 1:
                            raise
                        logger.warning(f"Retry after goto failure: {e}")
                        await asyncio.sleep(2)

                # Click on the Reviews tab if visible
                try:
                    reviews_tab = page.locator('button[aria-label*="Reviews"]').first
                    await reviews_tab.click(timeout=5000)
                    await asyncio.sleep(2)
                except Exception:
                    logger.debug("[Google] No reviews tab button found, continuing")

                # Scroll to load more reviews
                review_panel = page.locator('div[role="feed"]').first
                scroll_attempts = 0
                max_scrolls = max_reviews // 5 + 5

                while scroll_attempts < max_scrolls:
                    await review_panel.evaluate(
                        "el => el.scrollTo(0, el.scrollHeight)"
                    )
                    await asyncio.sleep(1.5)
                    # Expand "More" buttons
                    more_buttons = page.locator('button[aria-label="See more"]')
                    for btn in await more_buttons.all():
                        try:
                            await btn.click(timeout=1000)
                        except Exception:
                            pass
                    scroll_attempts += 1

                # Extract review cards
                review_cards = await page.locator(
                    'div[data-review-id]'
                ).all()

                logger.info(f"[Google] Found {len(review_cards)} review cards")

                for card in review_cards[:max_reviews]:
                    try:
                        review = await self._parse_review_card(card)
                        if review:
                            reviews.append(review)
                    except Exception as e:
                        logger.warning(f"[Google] Error parsing card: {e}")

            except Exception as e:
                logger.error(f"[Google] Scraping failed: {e}")
            finally:
                await context.close()
                await browser.close()

        logger.info(f"[Google] Collected {len(reviews)} reviews")
        return reviews

    async def _parse_review_card(self, card) -> Optional[RawReview]:
        """Parse a single Google review card element."""
        try:
            review_id = await card.get_attribute("data-review-id")

            # Reviewer name
            name_el = card.locator('div[class*="d4r55"]').first
            reviewer_name = await name_el.inner_text() if await name_el.count() else None

            # Star rating (aria-label contains "X stars")
            star_el = card.locator('span[aria-label*="star"]').first
            rating_str = await star_el.get_attribute("aria-label") if await star_el.count() else None
            rating = None
            if rating_str:
                match = re.search(r"(\d+(?:\.\d+)?)", rating_str)
                if match:
                    rating = float(match.group(1))

            # Review text
            text_el = card.locator('span[class*="wiI7pd"]').first
            review_text = await text_el.inner_text() if await text_el.count() else None

            # Date
            date_el = card.locator('span[class*="rsqaWe"]').first
            date_str = await date_el.inner_text() if await date_el.count() else None
            review_date = self._parse_date(date_str)

            if not review_text and not rating:
                return None

            return RawReview(
                source="google",
                external_id=review_id,
                reviewer_name=reviewer_name,
                rating=self._normalize_rating(rating),
                review_text=review_text,
                review_date=review_date,
                raw_metadata={"raw_date_str": date_str},
            )
        except Exception as e:
            logger.debug(f"[Google] Card parse error: {e}")
            return None
