"""Pydantic schemas for Review endpoints."""
import uuid
from datetime import datetime, date
from typing import Optional, List, Literal
from pydantic import BaseModel
# pyrefly: ignore [missing-import]
from app.models.reviews import ReviewSource, SentimentLabel


class ReviewBase(BaseModel):
    source: ReviewSource
    external_id: Optional[str] = None
    reviewer_name: Optional[str] = None
    rating: Optional[float] = None
    review_text: Optional[str] = None
    review_date: Optional[date] = None


class ReviewCreate(ReviewBase):
    restaurant_id: uuid.UUID
    raw_metadata: Optional[dict] = None


class ReviewResponse(ReviewBase):
    id: uuid.UUID
    restaurant_id: uuid.UUID
    sentiment: Optional[SentimentLabel] = None
    sentiment_score: Optional[float] = None
    complaint_categories: Optional[List[str]] = None
    scraped_at: datetime
    processed_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class ReviewListResponse(BaseModel):
    items: List[ReviewResponse]
    total: int
    page: int
    page_size: int


class ScrapeJobStatus(BaseModel):
    job_id: str
    restaurant_id: uuid.UUID
    platform: Optional[str] = None
    status: str  # 'pending' | 'running' | 'completed' | 'failed'
    reviews_scraped: int = 0
    message: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class ScrapeRequest(BaseModel):
    # None = scrape every platform configured for the outlet (google is always
    # attempted; zomato/tripadvisor/swiggy are included automatically if the
    # outlet has a URL saved for them).
    platform: Optional[Literal["google", "zomato", "tripadvisor", "swiggy"]] = None
    max_reviews: Optional[int] = 50