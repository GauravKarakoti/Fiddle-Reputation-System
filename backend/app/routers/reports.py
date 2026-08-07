"""FastAPI router: downloadable PDF reports for outlets."""
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from prisma import Prisma

from app.database import get_db
from app.services.report_service import generate_report_pdf

router = APIRouter(prefix="/api/reports", tags=["Reports"])


@router.get("/{restaurant_id}/pdf", summary="Download a PDF report for an outlet")
async def download_report_pdf(
    restaurant_id: uuid.UUID,
    period: str = Query("weekly", regex="^(daily|weekly|monthly)$"),
    db: Prisma = Depends(get_db),
):
    """
    Generate and return a PDF report summarizing an outlet's reviews over
    the chosen period:
      - 'daily'   = last 24 hours
      - 'weekly'  = last 7 days
      - 'monthly' = last 30 days
    """
    try:
        pdf_bytes = await generate_report_pdf(str(restaurant_id), period, db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate report: {e}")

    filename = f"first-fiddle-report-{period}-{datetime.utcnow().strftime('%Y%m%d')}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )