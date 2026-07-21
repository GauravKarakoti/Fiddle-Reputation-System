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
                headless=False,
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

                    # Wait for review cards to actually hydrate before reading content —
                    # domcontentloaded only guarantees the initial HTML arrived, not
                    # that React has rendered the review list yet.
                    try:
                        await page.wait_for_selector(
                            'div[data-automation="reviewCard"]', timeout=20000
                        )
                    except Exception:
                        logger.warning(
                            "[TripAdvisor] Review cards never appeared after navigation "
                            "(page may be under heavy load, blocked, or showing a "
                            "consent/interstitial screen) — dumping debug artifacts"
                        )
                        import os
                        os.makedirs("debug", exist_ok=True)
                        ts = int(asyncio.get_event_loop().time())
                        try:
                            await page.screenshot(
                                path=f"debug/tripadvisor_{ts}.png", full_page=True
                            )
                            debug_html = await page.content()
                            with open(f"debug/tripadvisor_{ts}.html", "w", encoding="utf-8") as f:
                                f.write(debug_html)
                            logger.warning(
                                f"[TripAdvisor] Saved debug/tripadvisor_{ts}.png and .html"
                            )
                        except Exception as dump_err:
                            logger.warning(f"[TripAdvisor] Debug dump failed: {dump_err}")

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
                # Overall rating — the FIRST bubbleRatingImage svg in document order
                # is the overall star rating. Four more of these appear later in the
                # card for the Value/Service/Food/Atmosphere sub-scores, so anchoring
                # on the first occurrence is what keeps us on the right one.
                # The value itself is in a <title> child ("1 of 5 bubbles"), not an
                # aria-label on the svg.
                rating = None
                rating_svg = card.find("svg", attrs={"data-automation": "bubbleRatingImage"})
                if rating_svg:
                    title_el = rating_svg.find("title")
                    if title_el:
                        match = re.search(r"(\d+(?:\.\d+)?)", title_el.get_text())
                        if match:
                            rating = self._normalize_rating(float(match.group(1)))

                # Review title (optional) — prepended to the body text for context.
                title_text = None
                title_h3 = card.find(attrs={"data-test-target": "review-title"})
                if title_h3:
                    title_link = title_h3.find("a")
                    title_text = title_link.get_text(strip=True) if title_link else title_h3.get_text(strip=True)

                # Review body — lives in the data-test-target="review-body" container.
                # Strip the "Read more" toggle button out before extracting text
                # (the full text is present in the DOM even when CSS line-clamps it).
                body_el = card.find(attrs={"data-test-target": "review-body"})
                body_text = None
                if body_el:
                    for btn in body_el.find_all("button"):
                        btn.decompose()
                    body_text = body_el.get_text(" ", strip=True)

                review_text = (
                    f"{title_text}. {body_text}" if title_text and body_text
                    else body_text or title_text
                )

                # Reviewer name — TripAdvisor member profile URLs always start with
                # "/Profile/"; this is the most stable anchor across UI revisions.
                name_el = card.find("a", href=re.compile(r"^/Profile/"))
                reviewer_name = name_el.get_text(strip=True) if name_el else None

                # Date — the actual submission date is rendered as two separate text
                # nodes: "Written " followed by "2 July 2026", appearing after the
                # sub-rating grid. (Not the earlier "Jul 2026 • Family" line, which
                # is the visit date/trip type, not the post date.)
                date_str = None
                written_label = card.find(string=re.compile(r"^\s*Written\s*$", re.I))
                if written_label and written_label.parent:
                    full_text = written_label.parent.get_text(" ", strip=True)
                    date_str = re.sub(r"^Written\s*", "", full_text, flags=re.I).strip()
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