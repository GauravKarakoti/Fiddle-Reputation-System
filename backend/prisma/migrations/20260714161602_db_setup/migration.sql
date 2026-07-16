-- CreateEnum
CREATE TYPE "ReviewSource" AS ENUM ('google', 'zomato', 'tripadvisor');

-- CreateEnum
CREATE TYPE "SentimentLabel" AS ENUM ('positive', 'neutral', 'negative');

-- CreateTable
CREATE TABLE "restaurants" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "branch_code" VARCHAR(50) NOT NULL,
    "city" VARCHAR(100) NOT NULL,
    "address" TEXT,
    "google_place_id" VARCHAR(200),
    "zomato_url" TEXT,
    "tripadvisor_url" TEXT,
    "phone" VARCHAR(20),
    "manager_name" VARCHAR(200),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "restaurants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "source" "ReviewSource" NOT NULL,
    "external_id" VARCHAR(200),
    "reviewer_name" VARCHAR(200),
    "rating" DOUBLE PRECISION,
    "review_text" TEXT,
    "review_date" DATE,
    "sentiment" "SentimentLabel",
    "sentiment_score" DOUBLE PRECISION,
    "complaint_categories" TEXT[],
    "raw_metadata" JSONB,
    "scraped_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),
    "is_flagged" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_cache" (
    "id" TEXT NOT NULL,
    "restaurant_id" TEXT NOT NULL,
    "period" VARCHAR(20) NOT NULL,
    "avg_rating" DOUBLE PRECISION,
    "review_count" INTEGER NOT NULL DEFAULT 0,
    "sentiment_counts" JSONB,
    "category_counts" JSONB,
    "rating_trend" JSONB,
    "llm_insights" TEXT,
    "llm_generated_at" TIMESTAMP(3),
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_cache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "restaurants_branch_code_key" ON "restaurants"("branch_code");

-- CreateIndex
CREATE INDEX "reviews_external_id_idx" ON "reviews"("external_id");

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_cache" ADD CONSTRAINT "analytics_cache_restaurant_id_fkey" FOREIGN KEY ("restaurant_id") REFERENCES "restaurants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
