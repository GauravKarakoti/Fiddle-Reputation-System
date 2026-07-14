"""
TripAdvisor review scraper using Playwright + BeautifulSoup.
TripAdvisor paginates reviews and uses server-rendered HTML for most content,
making it more amenable to scraping with page navigation.

Note: TripAdvisor has aggressive bot detection (Incapsula/CloudFlare).
For production use, consider ScraperAPI or a residential proxy service.
"""
import asyncio
import logging
import re
import hashlib
from typing import Optional

from playwright.async_api import async_playwright, Page
from bs4 import BeautifulSoup

from app.scrapers.base_scraper import BaseScraper, RawReview

logger = logging.getLogger(__name__)


class TripAdvisorScraper(BaseScraper):
    """Scrapes customer reviews from TripAdvisor restaurant pages."""

    async def scrape(self, url: str, max_reviews: int = 50) -> list[RawReview]:
        """
        Scrape TripAdvisor reviews from a restaurant page with pagination.

        Args:
            url: TripAdvisor restaurant URL
            max_reviews: Maximum reviews to collect

        Returns:
            List of RawReview objects
        """
        reviews = []
        page_url = url

        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=True,
                args=[
                    "--no-sandbox",
                    "--disable-blink-features=AutomationControlled",
                    "--disable-web-security",
                ]
            )
            context = await browser.new_context(
                user_agent=self.headers["User-Agent"],
                locale="en-US",
                extra_http_headers={
                    "Accept": "text/html,application/xhtml+xml",
                    "Accept-Language": "en-US,en;q=0.9",
                },
            )
            page: Page = await context.new_page()
            await page.add_init_script(
                "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"
            )

            try:
                while len(reviews) < max_reviews and page_url:
                    logger.info(f"[TripAdvisor] Scraping: {page_url}")
                    await page.goto(page_url, wait_until="networkidle", timeout=30000)
                    await asyncio.sleep(3)

                    # Expand "Read more" links
                    try:
                        more_links = await page.locator(
                            'span[class*="Ignyf _S"], button:has-text("Read more")'
                        ).all()
                        for link in more_links[:10]:
                            try:
                                await link.click(timeout=1000)
                                await asyncio.sleep(0.3)
                            except Exception:
                                pass
                    except Exception:
                        pass

                    # Get page HTML for BS4 parsing
                    content = await page.content()
                    page_reviews = self._parse_html(content)

                    if not page_reviews:
                        logger.warning("[TripAdvisor] No reviews found on page, stopping")
                        break

                    reviews.extend(page_reviews)
                    logger.info(f"[TripAdvisor] Page total: {len(reviews)} reviews")

                    # Check for next page
                    if len(reviews) >= max_reviews:
                        break

                    next_btn = page.locator('a[aria-label="Next page"]').first
                    if await next_btn.count() and await next_btn.is_enabled():
                        page_url = await next_btn.get_attribute("href")
                        if page_url and not page_url.startswith("http"):
                            page_url = "https://www.tripadvisor.com" + page_url
                        await self._polite_delay()
                    else:
                        break

            except Exception as e:
                logger.error(f"[TripAdvisor] Scraping failed: {e}")
            finally:
                await context.close()
                await browser.close()

        logger.info(f"[TripAdvisor] Collected {len(reviews[:max_reviews])} reviews")
        return reviews[:max_reviews]

    def _parse_html(self, html: str) -> list[RawReview]:
        """Parse TripAdvisor review cards from page HTML using BeautifulSoup."""
        soup = BeautifulSoup(html, "lxml")
        reviews = []

        # TripAdvisor review containers
        cards = (
            soup.find_all("div", attrs={"data-automation": "reviewCard"})
            or soup.find_all("div", class_=re.compile(r"review-container|reviewSelector"))
        )

        for card in cards:
            try:
                # Rating via aria-label on svg or data-rating
                rating = None
                rating_el = (
                    card.find("svg", attrs={"aria-label": True})
                    or card.find(attrs={"data-rating": True})
                )
                if rating_el:
                    label = rating_el.get("aria-label", "") or str(rating_el.get("data-rating", ""))
                    match = re.search(r"(\d+(?:\.\d+)?)", label)
                    if match:
                        rating = self._normalize_rating(float(match.group(1)))

                # Review text
                text_el = (
                    card.find("span", attrs={"data-automation": "reviewText"})
                    or card.find("p", class_=re.compile(r"partial_entry|review-text"))
                    or card.find("q")
                )
                review_text = text_el.get_text(strip=True) if text_el else None

                # Reviewer name
                name_el = (
                    card.find("a", attrs={"data-automation": "profileLink"})
                    or card.find(class_=re.compile(r"username|memberOverlay"))
                )
                reviewer_name = name_el.get_text(strip=True) if name_el else None

                # Date
                date_el = (
                    card.find("span", attrs={"data-automation": "reviewDate"})
                    or card.find("span", class_=re.compile(r"ratingDate|date_visited"))
                )
                date_str = date_el.get_text(strip=True) if date_el else None
                review_date = self._parse_date(date_str)

                if not review_text and not rating:
                    continue

                content = f"{reviewer_name}{review_text}{date_str}"
                ext_id = "ta_" + hashlib.md5(content.encode()).hexdigest()[:12]

                reviews.append(RawReview(
                    source="tripadvisor",
                    external_id=ext_id,
                    reviewer_name=reviewer_name,
                    rating=rating,
                    review_text=review_text,
                    review_date=review_date,
                    raw_metadata={"raw_date_str": date_str},
                ))
            except Exception as e:
                logger.debug(f"[TripAdvisor] Card parse error: {e}")

        return reviews
