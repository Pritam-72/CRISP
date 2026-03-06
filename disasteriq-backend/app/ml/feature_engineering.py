"""
Feature Engineering Pipeline
Transforms raw DB data into model-ready feature vectors.
"""
import math
from datetime import datetime, timedelta
from typing import List, Optional
import numpy as np
from sqlalchemy.orm import Session

from app.models import District, WeatherSnapshot


FEATURE_NAMES = [
    "rainfall_mm_24h",
    "rainfall_mm_72h",
    "temperature_c",
    "humidity_pct",
    "wind_speed_kmh",
    "river_level_m",
    "river_level_delta_6h",
    "elevation_m",
    "historical_flood_freq",
    "ndvi_score",
    "month_sin",
    "month_cos",
    "coastal_district",
]


def _cyclical_month(month: int):
    """Encode month as sin/cos to capture cyclical seasonality."""
    return (
        math.sin(2 * math.pi * month / 12),
        math.cos(2 * math.pi * month / 12),
    )


def get_rolling_rainfall(district_id: int, db: Session, hours: int = 72) -> float:
    """Sum rainfall_mm over past N hours from weather snapshots."""
    since = datetime.utcnow() - timedelta(hours=hours)
    snaps = (
        db.query(WeatherSnapshot)
        .filter(
            WeatherSnapshot.district_id == district_id,
            WeatherSnapshot.time >= since,
        )
        .all()
    )
    return sum(s.rainfall_mm or 0.0 for s in snaps)


def get_river_level_delta(district_id: int, db: Session, hours: int = 6) -> float:
    """Compute rate-of-change of river level over last N hours."""
    since = datetime.utcnow() - timedelta(hours=hours)
    recent = (
        db.query(WeatherSnapshot)
        .filter(
            WeatherSnapshot.district_id == district_id,
            WeatherSnapshot.time >= since,
        )
        .order_by(WeatherSnapshot.time.asc())
        .all()
    )
    if len(recent) < 2:
        return 0.0
    return (recent[-1].river_level_m or 1.5) - (recent[0].river_level_m or 1.5)


def build_feature_vector(
    district: District,
    weather: Optional[WeatherSnapshot],
    db: Optional[Session] = None,
    month: Optional[int] = None,
) -> np.ndarray:
    """
    Build the full 13-feature vector for a district.
    Uses DB rolling queries when db session is provided.
    Falls back to approximations otherwise (for real-time inference).
    """
    if month is None:
        month = datetime.utcnow().month

    month_sin, month_cos = _cyclical_month(month)

    rain_24h = weather.rainfall_mm if weather else 0.0
    rain_72h = get_rolling_rainfall(district.id, db, 72) if db else (rain_24h * 3)
    river_delta = get_river_level_delta(district.id, db, 6) if db else 0.1

    features = [
        rain_24h,
        rain_72h,
        weather.temperature_c if weather else 28.0,
        weather.humidity_pct if weather else 65.0,
        weather.wind_speed_kmh if weather else 10.0,
        weather.river_level_m if weather else 1.5,
        river_delta,
        district.elevation_m or 50.0,
        district.historical_flood_freq or 0.1,
        0.6,                       # ndvi_score — GEE mock; replace with earth_engine.py value
        month_sin,
        month_cos,
        1.0 if district.coastal_district else 0.0,
    ]
    return np.array(features, dtype=np.float32).reshape(1, -1)


def build_batch_features(districts: List[District], db: Session) -> np.ndarray:
    """
    Build feature matrix for a list of districts (used during training/batch predict).
    Returns shape (N, 13).
    """
    rows = []
    month = datetime.utcnow().month
    for district in districts:
        weather = (
            db.query(WeatherSnapshot)
            .filter(WeatherSnapshot.district_id == district.id)
            .order_by(WeatherSnapshot.time.desc())
            .first()
        )
        vec = build_feature_vector(district, weather, db, month)
        rows.append(vec.flatten())
    return np.array(rows, dtype=np.float32)
