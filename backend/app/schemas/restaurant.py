"""Pydantic schemas for Restaurant endpoints."""
import uuid
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, HttpUrl, field_validator


class RestaurantBase(BaseModel):
    name: str
    branch_code: str
    city: str
    address: Optional[str] = None
    # Google is the primary/required review source for every outlet.
    google_place_id: str
    # These are optional — not every outlet is listed on all three.
    zomato_url: Optional[str] = None
    tripadvisor_url: Optional[str] = None
    swiggy_url: Optional[str] = None
    phone: Optional[str] = None
    manager_name: Optional[str] = None


class RestaurantCreate(RestaurantBase):
    pass


class RestaurantUpdate(BaseModel):
    name: Optional[str] = None
    city: Optional[str] = None
    address: Optional[str] = None
    google_place_id: Optional[str] = None
    zomato_url: Optional[str] = None
    tripadvisor_url: Optional[str] = None
    swiggy_url: Optional[str] = None
    phone: Optional[str] = None
    manager_name: Optional[str] = None
    is_active: Optional[bool] = None


class RestaurantResponse(RestaurantBase):
    id: uuid.UUID
    is_active: bool
    created_at: datetime
    updated_at: datetime

    # Computed stats (optional, populated in endpoints)
    total_reviews: Optional[int] = None
    avg_rating: Optional[float] = None

    model_config = {"from_attributes": True}


class RestaurantListResponse(BaseModel):
    items: list[RestaurantResponse]
    total: int