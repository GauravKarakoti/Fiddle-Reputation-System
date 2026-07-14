"""FastAPI router: LLM-powered insights endpoints using Prisma."""
import uuid

from fastapi import APIRouter, Depends, Query
from prisma import Prisma

from app.database import get_db
from app.services.llm_service import generate_insights

router = APIRouter(prefix="/api/insights", tags=["AI Insights"])


@router.post("/{restaurant_id}", summary="Generate AI recommendations for an outlet")
async def create_insights(
    restaurant_id: uuid.UUID,
    force_refresh: bool = Query(False, description="Bypass cache and regenerate"),
    db: Prisma = Depends(get_db),
):
    """
    Analyze aggregated review data for the outlet and generate
    operational recommendations using the Gemini LLM.

    Results are cached for 24 hours. Use force_refresh=true to regenerate.
    Returns markdown-formatted recommendations.
    """
    insights = await generate_insights(
        restaurant_id=restaurant_id,
        db=db,
        force_refresh=force_refresh,
    )
    return {"restaurant_id": str(restaurant_id), "insights": insights}


@router.get("/{restaurant_id}", summary="Get cached AI insights for an outlet")
async def get_insights(
    restaurant_id: uuid.UUID,
    db: Prisma = Depends(get_db),
):
    """
    Return cached LLM insights without triggering a new generation.
    Returns null insights if not yet generated.
    """
    from app.services.llm_service import _get_cached_insights
    cached = await _get_cached_insights(restaurant_id, db)
    return {
        "restaurant_id": str(restaurant_id),
        "insights": cached,
        "cached": cached is not None,
    }
