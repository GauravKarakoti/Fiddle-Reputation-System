"""
Zomato review scraper using Playwright for dynamic content.
Zomato renders reviews client-side via React, so we use a headless browser.

Note: Zomato has API rate limits and bot detection. This scraper uses
realistic delays and user-agent spoofing for best compatibility.
"""
import asyncio
import logging
import re
from typing import Optional

from playwright.async_api import async_playwright, Page

from app.scrapers.base_scraper import BaseScraper, RawReview

logger = logging.getLogger(__name__)


class ZomatoScraper(BaseScraper):
    """Scrapes customer reviews from Zomato restaurant pages using Playwright."""

    ZOMATO_BASE = "https://www.zomato.com"

    async def scrape(self, url: str, max_reviews: int = 50) -> list[RawReview]:
        """
        Navigate to a Zomato restaurant URL and extract reviews.

        Args:
            url: Zomato restaurant URL (e.g., https://www.zomato.com/ncr/restaurant-name/reviews)
            max_reviews: Maximum reviews to collect

        Returns:
            List of RawReview objects
        """
        reviews = []

        # Ensure URL points to reviews section
        if "/reviews" not in url:
            url = url.rstrip("/") + "/reviews"

        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=True,
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
                logger.info(f"[Zomato] Navigating to: {url}")
                await page.goto(url, wait_until="networkidle", timeout=30000)
                await asyncio.sleep(3)

                # Scroll and load more reviews
                prev_count = 0
                scroll_rounds = 0
                max_rounds = max_reviews // 5 + 10

                while scroll_rounds < max_rounds:
                    await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                    await asyncio.sleep(2)

                    # Click "Load more" / "Show more reviews" button
                    try:
                        load_more = page.locator(
                            'a:has-text("Load more reviews"), '
                            'button:has-text("Load more"), '
                            'a:has-text("More reviews")'
                        ).first
                        if await load_more.is_visible(timeout=2000):
                            await load_more.click()
                            await asyncio.sleep(2)
                    except Exception:
                        pass

                    current_cards = await page.locator(
                        'div[class*="sc-"][class*="review"]'
                    ).count()

                    if current_cards >= max_reviews or current_cards == prev_count:
                        break

                    prev_count = current_cards
                    scroll_rounds += 1

                # Extract review cards using multiple selector strategies
                review_cards = await page.locator(
                    'div[class*="ReviewCard"], '
                    'div[data-testid="review-card"], '
                    'section[class*="ReviewCard"]'
                ).all()

                # Fallback: try generic review containers
                if not review_cards:
                    review_cards = await page.locator(
                        'div:has(> p[class*="review-text"])'
                    ).all()

                logger.info(f"[Zomato] Found {len(review_cards)} review containers")

                for card in review_cards[:max_reviews]:
                    try:
                        review = await self._parse_review_card(card)
                        if review:
                            reviews.append(review)
                    except Exception as e:
                        logger.warning(f"[Zomato] Card parse error: {e}")

            except Exception as e:
                logger.error(f"[Zomato] Scraping failed: {e}")
            finally:
                await context.close()
                await browser.close()

        logger.info(f"[Zomato] Collected {len(reviews)} reviews")
        return reviews

    async def _parse_review_card(self, card) -> Optional[RawReview]:
        """Parse a single Zomato review card."""
        try:
            # Rating — Zomato uses colored badge with number
            rating_el = card.locator('[class*="ui-type-body-regular-b"]').first
            rating_text = await rating_el.inner_text() if await rating_el.count() else None
            rating = None
            if rating_text:
                match = re.search(r"(\d+(?:\.\d+)?)", rating_text)
                if match:
                    val = float(match.group(1))
                    # Zomato uses 1-5 scale
                    rating = self._normalize_rating(val)

            # Review text
            text_el = card.locator('p[class*="reviewText"], span[class*="reviewText"]').first
            if not await text_el.count():
                text_el = card.locator("p").first
            review_text = await text_el.inner_text() if await text_el.count() else None

            # Reviewer name
            name_el = card.locator('p[class*="sc-1hez2tp"], a[class*="username"]').first
            reviewer_name = await name_el.inner_text() if await name_el.count() else None

            # Date
            date_el = card.locator('span[class*="time-stamp"], time').first
            date_str = await date_el.inner_text() if await date_el.count() else None
            review_date = self._parse_date(date_str)

            if not review_text and not rating:
                return None

            # Generate a rough external_id from content hash
            import hashlib
            content = f"{reviewer_name}{review_text}{date_str}"
            ext_id = "z_" + hashlib.md5(content.encode()).hexdigest()[:12]

            return RawReview(
                source="zomato",
                external_id=ext_id,
                reviewer_name=reviewer_name,
                rating=rating,
                review_text=review_text,
                review_date=review_date,
                raw_metadata={"raw_date_str": date_str},
            )
        except Exception as e:
            logger.debug(f"[Zomato] Card parse error: {e}")
            return None
