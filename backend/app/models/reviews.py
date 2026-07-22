from enum import Enum


class ReviewSource(str, Enum):
    google = "google"
    zomato = "zomato"
    tripadvisor = "tripadvisor"



class SentimentLabel(str, Enum):
    positive = "positive"
    neutral = "neutral"
    negative = "negative"