"""
Complaint Category Classifier.

Two-stage hybrid approach:
  1. Fast keyword matching (always runs) — high precision for explicit mentions
  2. Zero-shot classification with BART (runs when keyword match is ambiguous)
     Model: facebook/bart-large-mnli

Categories:
  - Food Quality      : taste, freshness, portion size, temperature
  - Service Delay     : slow, waiting, late, time
  - Staff Behavior    : rude, friendly, unhelpful, staff attitude
  - Pricing           : expensive, overpriced, value, cheap
  - Cleanliness       : dirty, hygiene, washroom, pest
  - Ambience          : noise, decor, seating, atmosphere, music
  - Other             : everything else
"""
import logging
import re
from dataclasses import dataclass
from functools import lru_cache
from typing import Optional

logger = logging.getLogger(__name__)

# ── Keyword taxonomy ────────────────────────────────────────────────────────

KEYWORD_TAXONOMY: dict[str, list[str]] = {
    "Food Quality": [
        "taste", "flavor", "flavour", "delicious", "bland", "stale", "cold food",
        "raw", "undercooked", "overcooked", "burnt", "fresh", "portion", "small portion",
        "big portion", "quantity", "quality", "food quality", "disgusting food",
        "bad food", "good food", "terrible food", "presentation", "spicy", "salt",
        "sweet", "sour", "bitter", "aroma", "smell bad", "smell good"
    ],
    "Service Delay": [
        "slow", "wait", "waiting", "waited", "long time", "delay", "delayed",
        "late", "took forever", "took too long", "hours", "quick", "fast service",
        "quick service", "slow service", "half an hour", "45 minutes", "forever",
        "order took", "delivery time", "table wait"
    ],
    "Staff Behavior": [
        "staff", "waiter", "waitress", "server", "rude", "impolite", "unfriendly",
        "hostile", "arrogant", "attitude", "helpful", "friendly staff", "polite",
        "courteous", "unprofessional", "professional", "attentive", "inattentive",
        "ignored", "dismissive", "manager", "chef", "team", "crew"
    ],
    "Pricing": [
        "expensive", "overpriced", "price", "pricey", "costly", "cheap", "affordable",
        "value for money", "value", "money", "worth", "not worth", "bill", "charges",
        "hidden charges", "gst", "tax", "discount", "offer", "deal", "pocket friendly"
    ],
    "Cleanliness": [
        "clean", "dirty", "hygiene", "hygienic", "unhygienic", "washroom", "toilet",
        "bathroom", "pest", "cockroach", "insect", "fly", "rat", "mouse", "dust",
        "filthy", "mess", "spill", "napkin", "sanitize", "sanitized"
    ],
    "Ambience": [
        "ambience", "ambiance", "atmosphere", "decor", "decoration", "interior",
        "music", "loud", "noisy", "quiet", "seating", "seats", "lighting", "lights",
        "cozy", "comfortable", "crowded", "spacious", "parking", "location", "view",
        "outdoor", "indoor", "vibe", "mood"
    ],
}


@dataclass
class CategoryResult:
    categories: list[str]          # Matched categories (may be multiple)
    confidence: float               # Overall confidence (0.0–1.0)
    method: str                     # 'keyword' | 'zero_shot' | 'hybrid'


class ComplaintCategorizer:
    """
    Classifies review text into one or more complaint/topic categories.
    Uses a fast keyword matcher first, then zero-shot BART for ambiguous cases.
    """

    def __init__(self, use_zero_shot: bool = True, zero_shot_threshold: float = 0.35):
        self.use_zero_shot = use_zero_shot
        self.zero_shot_threshold = zero_shot_threshold
        self._zero_shot_pipeline = None

        if use_zero_shot:
            self._load_zero_shot_model()

    def _load_zero_shot_model(self) -> None:
        """Load the BART zero-shot classification model."""
        try:
            from transformers import pipeline
            logger.info("[Categorizer] Loading zero-shot model: facebook/bart-large-mnli")
            self._zero_shot_pipeline = pipeline(
                "zero-shot-classification",
                model="facebook/bart-large-mnli",
                device=-1,
            )
            logger.info("[Categorizer] Zero-shot model loaded")
        except Exception as e:
            logger.warning(f"[Categorizer] Zero-shot model failed to load: {e}")
            self._zero_shot_pipeline = None

    def _keyword_match(self, text: str) -> list[str]:
        """
        Fast keyword-based category detection.
        Returns list of matched category names.
        """
        if not text:
            return []

        text_lower = text.lower()
        matched = []

        for category, keywords in KEYWORD_TAXONOMY.items():
            for keyword in keywords:
                pattern = r"\b" + re.escape(keyword) + r"\b"
                if re.search(pattern, text_lower):
                    matched.append(category)
                    break  # One match per category is enough

        return matched

    def _zero_shot_classify(self, text: str) -> list[str]:
        """
        Zero-shot classification using BART-MNLI.
        Used when keyword matching is uncertain or returns nothing.
        """
        if not self._zero_shot_pipeline:
            return []

        candidate_labels = list(KEYWORD_TAXONOMY.keys())
        # Rephrase labels to natural language hypotheses
        hypothesis_template = "This review is about {}."

        try:
            # Truncate long reviews for performance
            truncated = text[:400]
            result = self._zero_shot_pipeline(
                truncated,
                candidate_labels=candidate_labels,
                hypothesis_template=hypothesis_template,
                multi_label=True,
            )
            # Filter to labels above threshold
            categories = [
                label
                for label, score in zip(result["labels"], result["scores"])
                if score >= self.zero_shot_threshold
            ]
            return categories if categories else ["Other"]
        except Exception as e:
            logger.warning(f"[Categorizer] Zero-shot error: {e}")
            return []

    def categorize(self, text: str) -> CategoryResult:
        """
        Classify review text into complaint categories.

        Strategy:
          1. Run keyword matcher
          2. If 0 or 1 keywords found and zero-shot is available, use it
          3. If still no categories, return 'Other'

        Args:
            text: Review text

        Returns:
            CategoryResult with list of categories and confidence
        """
        if not text or not text.strip():
            return CategoryResult(["Other"], 0.0, "keyword")

        keyword_cats = self._keyword_match(text)

        if len(keyword_cats) >= 1:
            # High confidence: multiple keyword hits
            confidence = min(0.5 + 0.15 * len(keyword_cats), 1.0)
            method = "keyword"

            # Also run zero-shot to discover implicit categories
            if self.use_zero_shot and self._zero_shot_pipeline and len(keyword_cats) < 2:
                zs_cats = self._zero_shot_classify(text)
                all_cats = list(dict.fromkeys(keyword_cats + zs_cats))
                method = "hybrid"
                return CategoryResult(all_cats, confidence, method)

            return CategoryResult(keyword_cats, confidence, method)

        # No keyword match — rely on zero-shot
        if self.use_zero_shot and self._zero_shot_pipeline:
            zs_cats = self._zero_shot_classify(text)
            if zs_cats:
                return CategoryResult(zs_cats, 0.45, "zero_shot")

        return CategoryResult(["Other"], 0.2, "keyword")

    def categorize_batch(self, texts: list[str]) -> list[CategoryResult]:
        """Process multiple reviews."""
        return [self.categorize(text) for text in texts]


@lru_cache(maxsize=1)
def get_categorizer() -> ComplaintCategorizer:
    """Singleton complaint categorizer."""
    from app.config import get_settings
    settings = get_settings()
    return ComplaintCategorizer(use_zero_shot=not settings.USE_GPU)
