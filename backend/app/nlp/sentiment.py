"""
Sentiment Analysis Pipeline using HuggingFace Transformers.
Model: cardiffnlp/twitter-roberta-base-sentiment-latest
  - Trained on 124M tweets, fine-tuned for sentiment
  - Outputs: Positive / Neutral / Negative + confidence score

Falls back to a simple VADER-style lexicon approach if the model
cannot be loaded (e.g., in resource-constrained environments).
"""
import logging
import re
from dataclasses import dataclass
from typing import Optional
from functools import lru_cache

logger = logging.getLogger(__name__)

LABEL_MAP = {
    "LABEL_0": "negative",
    "LABEL_1": "neutral",
    "LABEL_2": "positive",
    # Some model versions use these labels directly
    "negative": "negative",
    "neutral": "neutral",
    "positive": "positive",
}


@dataclass
class SentimentResult:
    label: str          # 'positive' | 'neutral' | 'negative'
    score: float        # Confidence score 0.0–1.0 for the label
    compound: float     # Normalized compound: +1.0 (positive) to -1.0 (negative)


class SentimentAnalyzer:
    """
    Wraps HuggingFace sentiment pipeline with preprocessing and fallback.
    Designed to be instantiated once and reused across requests.
    """

    def __init__(self, model_name: str = "cardiffnlp/twitter-roberta-base-sentiment-latest"):
        self.model_name = model_name
        self._pipeline = None
        self._load_model()

    def _load_model(self) -> None:
        """Load the HuggingFace pipeline. Falls back gracefully on failure."""
        try:
            from transformers import pipeline, AutoTokenizer, AutoModelForSequenceClassification
            logger.info(f"[Sentiment] Loading model: {self.model_name}")

            self._pipeline = pipeline(
                task="text-classification",
                model=self.model_name,
                tokenizer=self.model_name,
                device=-1,          # CPU; set to 0 for CUDA GPU
                max_length=512,
                truncation=True,
                return_all_scores=False,
            )
            logger.info("[Sentiment] Model loaded successfully")
        except Exception as e:
            logger.error(f"[Sentiment] Failed to load model, using fallback: {e}")
            self._pipeline = None

    def _preprocess(self, text: str) -> str:
        """Clean text before feeding to the model."""
        if not text:
            return ""
        # Lowercase, remove URLs, excessive whitespace, HTML tags
        text = re.sub(r"http\S+|www\S+", " ", text)
        text = re.sub(r"<[^>]+>", " ", text)
        text = re.sub(r"\s+", " ", text).strip()
        # Twitter model expects @mentions and #hashtags as tokens
        text = re.sub(r"@\w+", "@user", text)
        text = re.sub(r"#(\w+)", r"\1", text)
        # Truncate to 500 chars for performance
        return text[:500]

    def _compound_from_label(self, label: str, score: float) -> float:
        """Convert label+confidence to a [-1, +1] compound score."""
        if label == "positive":
            return score
        elif label == "negative":
            return -score
        else:
            return 0.0

    def _fallback_sentiment(self, text: str) -> SentimentResult:
        """
        Simple keyword-based fallback when the transformer model is unavailable.
        Uses curated positive/negative word lists typical for restaurant reviews.
        """
        text_lower = text.lower()

        positive_words = {
            "great", "excellent", "amazing", "wonderful", "fantastic", "delicious",
            "superb", "loved", "love", "best", "awesome", "perfect", "outstanding",
            "brilliant", "tasty", "fresh", "friendly", "clean", "recommend",
            "good", "nice", "pleasant", "happy", "quick", "fast", "helpful"
        }
        negative_words = {
            "terrible", "awful", "horrible", "disgusting", "worst", "bad",
            "poor", "dirty", "rude", "slow", "cold", "stale", "overpriced",
            "disappointed", "disappointing", "never", "avoid", "pathetic",
            "waste", "unhygienic", "cockroach", "hair", "sour", "bland",
            "waited", "waiting", "late", "wrong", "missing", "incorrect"
        }

        words = set(re.findall(r'\b\w+\b', text_lower))
        pos_count = len(words & positive_words)
        neg_count = len(words & negative_words)

        if pos_count > neg_count:
            compound = min(0.3 + (pos_count - neg_count) * 0.1, 1.0)
            return SentimentResult("positive", compound, compound)
        elif neg_count > pos_count:
            compound = -min(0.3 + (neg_count - pos_count) * 0.1, 1.0)
            return SentimentResult("negative", abs(compound), compound)
        else:
            return SentimentResult("neutral", 0.5, 0.0)

    def analyze(self, text: str) -> SentimentResult:
        """
        Analyze sentiment of a single review text.

        Args:
            text: Raw review text

        Returns:
            SentimentResult with label, score, and compound
        """
        if not text or not text.strip():
            return SentimentResult("neutral", 0.5, 0.0)

        cleaned = self._preprocess(text)

        if self._pipeline is None:
            return self._fallback_sentiment(cleaned)

        try:
            result = self._pipeline(cleaned)
            # result is a list of dicts: [{'label': ..., 'score': ...}]
            if isinstance(result, list) and len(result) > 0:
                top = result[0] if isinstance(result[0], dict) else result[0][0]
                raw_label = top.get("label", "neutral")
                score = float(top.get("score", 0.5))
                label = LABEL_MAP.get(raw_label, "neutral")
                compound = self._compound_from_label(label, score)
                return SentimentResult(label=label, score=score, compound=compound)
        except Exception as e:
            logger.warning(f"[Sentiment] Inference error, using fallback: {e}")
            return self._fallback_sentiment(cleaned)

        return SentimentResult("neutral", 0.5, 0.0)

    def analyze_batch(self, texts: list[str], batch_size: int = 16) -> list[SentimentResult]:
        """
        Analyze a batch of texts efficiently.

        Args:
            texts: List of review texts
            batch_size: Number of texts to process per batch

        Returns:
            List of SentimentResult in same order as input
        """
        if not texts:
            return []

        results = []
        for i in range(0, len(texts), batch_size):
            batch = [self._preprocess(t) for t in texts[i:i + batch_size]]
            if self._pipeline is None:
                results.extend([self._fallback_sentiment(t) for t in batch])
                continue
            try:
                raw_results = self._pipeline(batch)
                for item in raw_results:
                    if isinstance(item, list):
                        item = item[0]
                    label = LABEL_MAP.get(item.get("label", "neutral"), "neutral")
                    score = float(item.get("score", 0.5))
                    compound = self._compound_from_label(label, score)
                    results.append(SentimentResult(label=label, score=score, compound=compound))
            except Exception as e:
                logger.warning(f"[Sentiment] Batch error: {e}")
                results.extend([self._fallback_sentiment(t) for t in batch])

        return results


@lru_cache(maxsize=1)
def get_sentiment_analyzer() -> SentimentAnalyzer:
    """Singleton sentiment analyzer (loaded once, reused per process)."""
    from app.config import get_settings
    settings = get_settings()
    return SentimentAnalyzer(model_name=settings.SENTIMENT_MODEL)
