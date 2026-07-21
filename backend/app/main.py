"""
FastAPI application entry point for the First Fiddle Reputation Platform using Prisma.
Registers all routers, configures CORS, and manages DB client connections.
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import get_settings
from app.database import db
from app.routers import restaurants, reviews, analytics, insights

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)
settings = get_settings()


# ── Lifespan (startup / shutdown) ─────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Connect Prisma client on startup, disconnect on shutdown."""
    logger.info("Starting First Fiddle Reputation Platform...")
    await db.connect()
    logger.info("Database client connected")
    yield
    logger.info("Shutting down...")
    await db.disconnect()
    logger.info("Database client disconnected")


# ── App factory ───────────────────────────────────────────────────────────────
app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=(
        "AI-powered review aggregation, NLP analysis, and LLM recommendations "
        "for First Fiddle Restaurant franchises."
    ),
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(restaurants.router)
app.include_router(reviews.router)
app.include_router(analytics.router)
app.include_router(insights.router)


# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/health", tags=["System"])
async def health_check():
    return {"status": "ok", "version": settings.APP_VERSION}
    