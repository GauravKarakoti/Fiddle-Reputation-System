"""
Google Reviews scraper using Playwright for dynamic content.
Google Reviews are loaded via JavaScript, so a headless browser is required.
"""
import asyncio
import logging
import re
import os
from datetime import date
from typing import Optional

from playwright.async_api import async_playwright, Page, BrowserContext
from playwright_stealth import Stealth  # <-- Updated import for v2.0+

from app.scrapers.base_scraper import BaseScraper, RawReview

logger = logging.getLogger(__name__)


class GoogleScraper(BaseScraper):
    """Scrapes customer reviews from Google Maps using Playwright."""

    async def scrape(self, url: str, max_reviews: int = 50) -> list[RawReview]:
        """Navigate to a Google Maps place URL and extract reviews."""
        reviews = []

        async with async_playwright() as p:
            # Create a dedicated directory to store browser cookies/state
            user_data_dir = os.path.join(os.getcwd(), "playwright_chrome_profile")
            
            # Launch a persistent context instead of a fresh one every time
            context = await p.chromium.launch_persistent_context(
                user_data_dir,
                headless=False,
                channel="chrome",
                args=[
                    "--no-sandbox", 
                    "--disable-dev-shm-usage",
                    "--disable-blink-features=AutomationControlled"
                ],
                locale="en-US",
                viewport={"width": 1280, "height": 800},
            )
            
            # A persistent context automatically spawns a first page
            page: Page = context.pages[0] if context.pages else await context.new_page()

            # Apply stealth to the specific page
            stealth = Stealth()
            await stealth.apply_stealth_async(page)
            
            try:
                logger.info(f"[Google] Navigating to: {url}")
                for attempt in range(2):
                    try:
                        if "&hl=en" not in url:
                            url += "&hl=en"
                        await page.goto(url, wait_until="domcontentloaded", timeout=45000)
                        break
                    except Exception as e:
                        if attempt == 1:
                            raise
                        logger.warning(f"Retry after goto failure: {e}")
                        await asyncio.sleep(2)

                try:
                    await page.wait_for_selector('h1', timeout=15000)
                except Exception:
                    logger.debug("[Google] Main header didn't load in time, but continuing.")

                # Attempt to dismiss common Google popups first
                try:
                    popup_button = page.locator('button:has-text("Accept all"), button:has-text("No thanks"), button:has-text("Reject all")').first
                    if await popup_button.is_visible(timeout=3000):
                        await popup_button.click()
                        await asyncio.sleep(1)
                except Exception:
                    logger.debug("[Google] No blocking popups found, continuing.")

                # Click the Reviews tab using a broad locator WITH fail-fast logic
                try:
                    reviews_tab = page.locator(
                        'button:has-text("Reviews"), '
                        'button[aria-label*="Reviews"], '
                        'div[role="tab"]:has-text("Reviews")'
                    ).first
                    
                    if await reviews_tab.is_visible(timeout=8000):
                        await reviews_tab.click()
                        await asyncio.sleep(2)
                    else:
                        logger.info("[Google] No 'Reviews' tab found (Degraded UI or 0 reviews). Exiting cleanly.")
                        return reviews
                        
                except Exception as e:
                    logger.error(f"[Google] Failed to interact with Reviews tab: {e}")
                    return reviews

                # ----- PROCEED TO SCROLLING ONLY IF TAB WAS CLICKED -----
                
                # Wait for the first review card to appear in the DOM
                try:
                    await page.wait_for_selector('div[data-review-id]', timeout=15000)
                except Exception:
                    logger.warning("[Google] Reviews tab clicked, but no review cards loaded. Exiting.")
                    return reviews

                scroll_attempts = 0
                max_scrolls = max_reviews // 5 + 5

                while scroll_attempts < max_scrolls:
                    # Dynamically target the last review card and scroll it into view
                    review_cards_locator = page.locator('div[data-review-id]')
                    current_count = await review_cards_locator.count()
                    
                    if current_count > 0:
                        last_card = review_cards_locator.nth(current_count - 1)
                        await last_card.scroll_into_view_if_needed()
                    
                    await asyncio.sleep(1.5)
                    
                    # Expand "More" buttons
                    more_buttons = page.locator('button[aria-label="See more"]')
                    button_count = await more_buttons.count()
                    for i in range(button_count):
                        try:
                            await more_buttons.nth(i).click(timeout=1000)
                        except Exception:
                            pass
                    scroll_attempts += 1

                # Extract review cards
                review_cards = await page.locator('div[data-review-id]').all()
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