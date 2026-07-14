"""FastAPI router: CRUD endpoints for Restaurant/Outlet management using Prisma."""
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from prisma import Prisma

from app.database import get_db
from app.schemas.restaurant import (
    RestaurantCreate,
    RestaurantUpdate,
    RestaurantResponse,
    RestaurantListResponse,
)

router = APIRouter(prefix="/api/restaurants", tags=["Restaurants"])


@router.get("", response_model=RestaurantListResponse)
async def list_restaurants(
    city: Optional[str] = Query(None, description="Filter by city"),
    is_active: bool = Query(True),
    db: Prisma = Depends(get_db),
):
    """List all restaurant outlets with optional filters."""
    where = {"is_active": is_active}
    if city:
        where["city"] = {"contains": city, "mode": "insensitive"}

    restaurants = await db.restaurant.find_many(
        where=where,
        include={"reviews": True}
    )

    items = []
    for r in restaurants:
        reviews = r.reviews or []
        ratings = [rev.rating for rev in reviews if rev.rating is not None]
        avg_rating = round(sum(ratings) / len(ratings), 2) if ratings else None
        
        r_dict = r.dict()
        r_dict["total_reviews"] = len(reviews)
        r_dict["avg_rating"] = avg_rating
        items.append(RestaurantResponse(**r_dict))

    return RestaurantListResponse(items=items, total=len(items))


@router.get("/{restaurant_id}", response_model=RestaurantResponse)
async def get_restaurant(restaurant_id: uuid.UUID, db: Prisma = Depends(get_db)):
    """Get a single restaurant outlet by ID."""
    r = await db.restaurant.find_first(
        where={"id": str(restaurant_id)},
        include={"reviews": True}
    )
    if not r:
        raise HTTPException(status_code=404, detail="Restaurant not found")

    reviews = r.reviews or []
    ratings = [rev.rating for rev in reviews if rev.rating is not None]
    avg_rating = round(sum(ratings) / len(ratings), 2) if ratings else None

    r_dict = r.dict()
    r_dict["total_reviews"] = len(reviews)
    r_dict["avg_rating"] = avg_rating
    return RestaurantResponse(**r_dict)


@router.post("", response_model=RestaurantResponse, status_code=201)
async def create_restaurant(
    payload: RestaurantCreate, db: Prisma = Depends(get_db)
):
    """Register a new restaurant outlet."""
    # Check branch_code uniqueness
    existing = await db.restaurant.find_first(
        where={"branch_code": payload.branch_code}
    )
    if existing:
        raise HTTPException(
            status_code=409, detail=f"Branch code '{payload.branch_code}' already exists"
        )

    r = await db.restaurant.create(data=payload.model_dump())
    return RestaurantResponse(**r.dict())


@router.patch("/{restaurant_id}", response_model=RestaurantResponse)
async def update_restaurant(
    restaurant_id: uuid.UUID,
    payload: RestaurantUpdate,
    db: Prisma = Depends(get_db),
):
    """Update restaurant outlet details."""
    existing = await db.restaurant.find_first(
        where={"id": str(restaurant_id)}
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Restaurant not found")

    r = await db.restaurant.update(
        where={"id": str(restaurant_id)},
        data=payload.model_dump(exclude_unset=True)
    )
    return RestaurantResponse(**r.dict())


@router.delete("/{restaurant_id}", status_code=204)
async def delete_restaurant(
    restaurant_id: uuid.UUID, db: Prisma = Depends(get_db)
):
    """Soft-delete a restaurant outlet."""
    existing = await db.restaurant.find_first(
        where={"id": str(restaurant_id)}
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    
    await db.restaurant.update(
        where={"id": str(restaurant_id)},
        data={"is_active": False}
    )
