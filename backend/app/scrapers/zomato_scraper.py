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
        """Navigate to a Zomato restaurant URL and extract paginated reviews via UI clicks."""
        reviews = []

        if "/reviews" not in url:
            url = url.rstrip("/") + "/reviews"

        base_url = url.split("?")[0]
        # Force sort by newest on the initial load
        start_url = f"{base_url}?sort=dd&filter=reviews-dining"

        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=True,
                channel="chrome",
                args=["--no-sandbox", "--disable-blink-features=AutomationControlled"]
            )
            context = await browser.new_context(
                user_agent=self.headers["User-Agent"],
                locale="en-IN",
                extra_http_headers={"Accept-Language": "en-IN,en;q=0.9"},
            )
            page = await context.new_page()

            await page.add_init_script(
                "Object.defineProperty(navigator, 'webdriver', {get: () => undefined})"
            )

            try:
                logger.info(f"[Zomato] Initial navigation to: {start_url}")
                await page.goto(start_url, wait_until="domcontentloaded", timeout=45000)
                await asyncio.sleep(4) # Let React hydrate

                current_page = 1
                
                while len(reviews) < max_reviews:
                    current_anchors = await page.locator('div:has(> p.time-stamp)').count()
                    if current_anchors == 0:
                        logger.info(f"[Zomato] No reviews found on page {current_page}.")
                        break

                    logger.info(f"[Zomato] Extracting {current_anchors} reviews from page {current_page}")

                    # Extract reviews via JS evaluation (Same as before)
                    extracted_data = await page.evaluate('''() => {
                        const results = [];
                        const anchors = Array.from(document.querySelectorAll('div > p.time-stamp')).map(p => p.parentElement);
                        for (const anchor of anchors) {
                            const dateStr = anchor.querySelector('p.time-stamp')?.innerText || "";
                            let rating = null;
                            const match = anchor.innerText.match(/(\\d+(?:\\.\\d+)?)/);
                            if (match) rating = parseFloat(match[1]);
                            
                            let name = "";
                            let prev = anchor.previousElementSibling;
                            while (prev && prev.tagName !== 'SECTION') prev = prev.previousElementSibling;
                            if (prev) {
                                const nameEl = prev.querySelector('p');
                                if (nameEl) name = nameEl.innerText;
                            }

                            let text = "";
                            let pSibling = anchor.nextElementSibling;
                            while (pSibling && pSibling.tagName !== 'SECTION') {
                                if (pSibling.tagName === 'P') { text = pSibling.innerText; break; }
                                pSibling = pSibling.nextElementSibling;
                            }
                            results.push({ name, rating, text, dateStr });
                        }
                        return results;
                    }''')

                    import hashlib
                    new_reviews_this_page = 0
                    
                    for data in extracted_data:
                        if len(reviews) >= max_reviews:
                            break
                        if not data['text'] and not data['rating']:
                            continue

                        content = f"{data['name']}{data['text']}{data['dateStr']}"
                        ext_id = "z_" + hashlib.md5(content.encode()).hexdigest()[:12]

                        reviews.append(RawReview(
                            source="zomato",
                            external_id=ext_id,
                            reviewer_name=data['name'],
                            rating=self._normalize_rating(data['rating']),
                            review_text=data['text'],
                            review_date=self._parse_date(data['dateStr']),
                            raw_metadata={"raw_date_str": data['dateStr']},
                        ))
                        new_reviews_this_page += 1

                    if len(reviews) >= max_reviews or new_reviews_this_page == 0:
                        break

                    next_page_num = current_page + 1
                    next_page_link = page.locator(f'a[href*="page={next_page_num}"]')
                    
                    if await next_page_link.count() > 0:
                        logger.info(f"[Zomato] Clicking pagination for page {next_page_num}")
                        
                        # Use .evaluate to force the click via JavaScript
                        await next_page_link.first.evaluate("el => el.click()")
                        await asyncio.sleep(4) # Wait for React to fetch and render the new data
                        current_page += 1
                    else:
                        logger.info(f"[Zomato] No pagination link found for page {next_page_num}. Ending.")
                        break

            except Exception as e:
                logger.error(f"[Zomato] Scraping failed: {e}")
            finally:
                await context.close()
                await browser.close()

        logger.info(f"[Zomato] Collected {len(reviews)} total reviews")
        return reviews

    async def _parse_review_card(self, card) -> Optional[RawReview]:
        """Parse a single Zomato review card using heuristic DOM traversal."""
        try:
            # 1. Reviewer Name: Usually the inner text of the user profile link
            name_el = card.locator('a[href*="/users/"]').last
            reviewer_name = await name_el.inner_text() if await name_el.count() else None

            # 2. Rating: Search all text inside the card for a standalone 1.0 - 5.0 number
            rating = None
            text_blocks = await card.locator('div').all_inner_texts()
            for text in text_blocks:
                match = re.search(r"^([1-5](?:\.\d)?)$", text.strip())
                if match:
                    rating = float(match.group(1))
                    break

            # 3. Date: Look for standard time strings
            date_str = None
            time_el = card.locator('time, span:has-text("ago"), span:has-text("yesterday"), span:has-text("202")').first
            if await time_el.count():
                date_str = await time_el.inner_text()
            review_date = self._parse_date(date_str)

            # 4. Review Text: Extract all paragraphs and assume the longest one is the review
            review_text = None
            paragraphs = await card.locator('p').all_inner_texts()
            if paragraphs:
                review_text = max(paragraphs, key=len)

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