"""
Swiggy Dineout review scraper using Playwright for dynamic content.
Swiggy Dineout renders reviews client-side via React, so we use a headless browser,
similar to the Zomato scraper.

Note: Swiggy has bot detection and rate limits. This scraper uses realistic
delays and user-agent spoofing for best compatibility.
"""
import asyncio
import hashlib
import logging
import re
from typing import Optional

from playwright.async_api import async_playwright, Page

from app.scrapers.base_scraper import BaseScraper, RawReview

logger = logging.getLogger(__name__)


class SwiggyScraper(BaseScraper):
    """Scrapes customer reviews from Swiggy Dineout restaurant pages using Playwright."""

    async def scrape(self, url: str, max_reviews: int = 50) -> list[RawReview]:
        """
        Navigate to a Swiggy Dineout restaurant URL and extract reviews.

        Args:
            url: Swiggy Dineout restaurant URL
            max_reviews: Maximum reviews to collect

        Returns:
            List of RawReview objects
        """
        reviews = []

        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=False,
                channel="chrome",
                args=["--no-sandbox", "--disable-blink-features=AutomationControlled"]
            )
            context = await browser.new_context(
                user_agent=self.headers["User-Agent"],
                locale="en-IN",
                extra_http_headers={
                    "Accept-Language": "en-IN,en;q=0.9",
                },
            )
            page: Page = await context.new_page()

            # Mask webdriver detection
            await page.add_init_script(
                "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"
            )

            try:
                logger.info(f"[Swiggy] Navigating to: {url}")
                for attempt in range(2):
                    try:
                        await page.goto(url, wait_until="domcontentloaded", timeout=45000)
                        break
                    except Exception as e:
                        if attempt == 1:
                            raise
                        logger.warning(f"Retry after goto failure: {e}")
                        await asyncio.sleep(3)

                # Scroll and load more reviews
                prev_count = 0
                scroll_rounds = 0
                max_rounds = max_reviews // 5 + 10

                while scroll_rounds < max_rounds:
                    await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                    await asyncio.sleep(2)

                    # Click "Show more reviews" / "Load more" button
                    try:
                        load_more = page.locator(
                            'div:has-text("Show more reviews"), '
                            'button:has-text("Load more"), '
                            'div:has-text("View more reviews")'
                        ).first
                        if await load_more.is_visible(timeout=2000):
                            await load_more.click()
                            await asyncio.sleep(2)
                    except Exception:
                        pass

                    current_cards = await page.locator(
                        'div[class*="review"], div[data-testid*="review"]'
                    ).count()

                    if current_cards >= max_reviews or current_cards == prev_count:
                        break

                    prev_count = current_cards
                    scroll_rounds += 1

                # Extract review cards using multiple selector strategies
                review_cards = await page.locator(
                    'div[class*="ReviewCard"], '
                    'div[data-testid="review-card"], '
                    'div[class*="review-item"]'
                ).all()

                # Fallback: generic review containers
                if not review_cards:
                    review_cards = await page.locator(
                        'div:has(> p[class*="review-text"])'
                    ).all()

                logger.info(f"[Swiggy] Found {len(review_cards)} review containers")

                for card in review_cards[:max_reviews]:
                    try:
                        review = await self._parse_review_card(card)
                        if review:
                            reviews.append(review)
                    except Exception as e:
                        logger.warning(f"[Swiggy] Card parse error: {e}")

            except Exception as e:
                logger.error(f"[Swiggy] Scraping failed: {e}")
            finally:
                await context.close()
                await browser.close()

        logger.info(f"[Swiggy] Collected {len(reviews)} reviews")
        return reviews

    async def _parse_review_card(self, card) -> Optional[RawReview]:
        """Parse a single Swiggy Dineout review card."""
        try:
            # Rating — Swiggy uses a numeric badge (e.g. "4.5")
            rating_el = card.locator('[class*="rating"]').first
            rating_text = await rating_el.inner_text() if await rating_el.count() else None
            rating = None
            if rating_text:
                match = re.search(r"(\d+(?:\.\d+)?)", rating_text)
                if match:
                    rating = self._normalize_rating(float(match.group(1)))

            # Review text
            text_el = card.locator('p[class*="reviewText"], span[class*="reviewText"]').first
            if not await text_el.count():
                text_el = card.locator("p").first
            review_text = await text_el.inner_text() if await text_el.count() else None

            # Reviewer name
            name_el = card.locator('p[class*="userName"], a[class*="username"]').first
            reviewer_name = await name_el.inner_text() if await name_el.count() else None

            # Date
            date_el = card.locator('span[class*="time-stamp"], time').first
            date_str = await date_el.inner_text() if await date_el.count() else None
            review_date = self._parse_date(date_str)

            if not review_text and not rating:
                return None

            content = f"{reviewer_name}{review_text}{date_str}"
            ext_id = "sw_" + hashlib.md5(content.encode()).hexdigest()[:12]

            return RawReview(
                source="swiggy",
                external_id=ext_id,
                reviewer_name=reviewer_name,
                rating=rating,
                review_text=review_text,
                review_date=review_date,
                raw_metadata={"raw_date_str": date_str},
            )
        except Exception as e:
            logger.debug(f"[Swiggy] Card parse error: {e}")
            return None