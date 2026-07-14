"""
FastAPI application entry point for the First Fiddle Reputation Platform using Prisma.
Registers all routers, configures CORS, and manages DB client connections.
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

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
    logger.info("🚀 Starting First Fiddle Reputation Platform...")
    await db.connect()
    logger.info("✅ Database client connected")
    yield
    logger.info("👋 Shutting down...")
    await db.disconnect()
    logger.info("✅ Database client disconnected")


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


# ── Seed demo data (dev only) ─────────────────────────────────────────────────
@app.post("/api/seed", tags=["System"], include_in_schema=settings.DEBUG)
async def seed_demo_data():
    """
    Seed the database with First Fiddle demo outlets and sample reviews using Prisma.
    Only available in DEBUG mode.
    """
    import random
    from datetime import datetime, timedelta

    OUTLETS = [
        {"name": "First Fiddle - Connaught Place", "branch_code": "FF-CP-01", "city": "Delhi",
         "address": "12, Janpath, Connaught Place, New Delhi"},
        {"name": "First Fiddle - Bandra", "branch_code": "FF-BDR-01", "city": "Mumbai",
         "address": "14, Hill Road, Bandra West, Mumbai"},
        {"name": "First Fiddle - Koramangala", "branch_code": "FF-KRM-01", "city": "Bengaluru",
         "address": "80 Feet Road, Koramangala 4th Block, Bengaluru"},
        {"name": "First Fiddle - Jubilee Hills", "branch_code": "FF-JH-01", "city": "Hyderabad",
         "address": "Plot 1136, Road 61, Jubilee Hills, Hyderabad"},
        {"name": "First Fiddle - Anna Nagar", "branch_code": "FF-AN-01", "city": "Chennai",
         "address": "4th Avenue, Anna Nagar, Chennai"},
    ]

    SAMPLE_REVIEWS = [
        ("Amazing food! The biryani was absolutely delicious and fresh.", 5.0, "positive"),
        ("Terrible service, waited 45 minutes for a simple order.", 2.0, "negative"),
        ("Food was okay, nothing special. Ambience is nice though.", 3.0, "neutral"),
        ("The staff was very rude and dismissive. Never coming back.", 1.5, "negative"),
        ("Loved the ambience and decor! Great place for a date.", 4.5, "positive"),
        ("Overpriced for what you get. Food quality has gone down.", 2.5, "negative"),
        ("Quick service and tasty food! Highly recommend.", 4.0, "positive"),
        ("Washroom was dirty and unhygienic. Very disappointed.", 2.0, "negative"),
        ("Best biryani in the city! Fresh ingredients, generous portion.", 5.0, "positive"),
        ("Ordered online, delivery took forever and food was cold.", 2.0, "negative"),
        ("The new menu items are great. Prices are a bit high.", 3.5, "neutral"),
        ("Friendly staff and cozy atmosphere. Will visit again!", 4.5, "positive"),
        ("Found a hair in my food. Extremely unhygienic.", 1.0, "negative"),
        ("Average experience. Food was bland and lacking flavor.", 2.5, "negative"),
        ("Excellent value for money! Great portion sizes.", 4.0, "positive"),
    ]

    CATEGORIES_MAP = {
        "positive": ["Food Quality", "Ambience"],
        "negative": ["Service Delay", "Staff Behavior", "Cleanliness", "Food Quality"],
        "neutral": ["Pricing", "Ambience"],
    }

    SOURCES = ["google", "zomato", "tripadvisor"]

    for outlet_data in OUTLETS:
        existing = await db.restaurant.find_first(
            where={"branch_code": outlet_data["branch_code"]}
        )
        if existing:
            continue

        restaurant = await db.restaurant.create(data=outlet_data)

        # Add 15 sample reviews per outlet
        for i, (text, rating, sentiment) in enumerate(SAMPLE_REVIEWS):
            days_ago = random.randint(1, 180)
            review_date = datetime.utcnow() - timedelta(days=days_ago)
            cats = CATEGORIES_MAP.get(sentiment, ["Other"])
            random.shuffle(cats)

            await db.review.create(
                data={
                    "restaurant_id": restaurant.id,
                    "source": random.choice(SOURCES),
                    "external_id": f"seed_{restaurant.branch_code}_{i}",
                    "reviewer_name": f"User_{random.randint(1000, 9999)}",
                    "rating": rating + random.uniform(-0.3, 0.3),
                    "review_text": text,
                    "review_date": review_date,
                    "sentiment": sentiment,
                    "sentiment_score": random.uniform(0.6, 0.95) * (1 if sentiment == "positive" else -1 if sentiment == "negative" else 0),
                    "complaint_categories": cats[:random.randint(1, 2)],
                }
            )

    return {"message": "✅ Demo data seeded successfully with 5 outlets × 15 reviews each"}
