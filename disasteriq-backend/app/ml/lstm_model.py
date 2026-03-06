"""
LSTM Time-Series Risk Model (v2)
Architecture: 2-layer LSTM → Dense(64) → Dropout(0.3) → Dense(3) sigmoid
Input: 72-hour sliding window of weather features (12 timesteps × 6h)
Output: [flood_risk, heatwave_risk, cyclone_risk]

Falls back to rule-based predictions if model file not found.
"""
import os
import math
import random
import numpy as np
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy.orm import Session
from app.models import District, WeatherSnapshot

LSTM_MODEL_PATH = os.path.join(
    os.path.dirname(__file__), "../../ml_training/models/lstm_model.h5"
)

_lstm_model = None


def _load_lstm():
    global _lstm_model
    try:
        from tensorflow import keras  # type: ignore
        _lstm_model = keras.models.load_model(LSTM_MODEL_PATH)
        print("✅ LSTM model loaded")
    except Exception as e:
        print(f"⚠️  LSTM model not found ({e}), using rule-based fallback")
        _lstm_model = None


def _get_window(district_id: int, db: Session, steps: int = 12, step_hours: int = 6):
    """
    Fetch the last `steps` weather snapshots (approx every `step_hours` hours).
    Returns list of dicts ordered oldest → newest.
    """
    since = datetime.utcnow() - timedelta(hours=steps * step_hours)
    snaps = (
        db.query(WeatherSnapshot)
        .filter(
            WeatherSnapshot.district_id == district_id,
            WeatherSnapshot.time >= since,
        )
        .order_by(WeatherSnapshot.time.asc())
        .all()
    )
    return snaps


def _snap_to_vec(snap: Optional[WeatherSnapshot]) -> list:
    """Convert a WeatherSnapshot to a 5-element feature vector."""
    if snap is None:
        return [0.0, 28.0, 65.0, 10.0, 1.5]
    return [
        snap.rainfall_mm or 0.0,
        snap.temperature_c or 28.0,
        snap.humidity_pct or 65.0,
        snap.wind_speed_kmh or 10.0,
        snap.river_level_m or 1.5,
    ]


def _pad_window(snaps, steps: int = 12) -> np.ndarray:
    """Pad or truncate snaps to exactly `steps` rows → shape (steps, 5)."""
    vecs = [_snap_to_vec(s) for s in snaps[-steps:]]
    while len(vecs) < steps:
        vecs.insert(0, [0.0, 28.0, 65.0, 10.0, 1.5])
    return np.array(vecs, dtype=np.float32)


def _rule_based(district: District, window: np.ndarray):
    """Simple threshold rules as LSTM fallback."""
    avg_rain = float(window[:, 0].mean())
    max_temp = float(window[:, 1].max())
    max_wind = float(window[:, 3].max())

    flood_risk = min(avg_rain / 80.0, 1.0) * 0.6 + (district.historical_flood_freq or 0.1) * 0.4
    if district.coastal_district:
        flood_risk = min(flood_risk + 0.1, 1.0)

    heatwave_risk = max(0.0, (max_temp - 35) / 10.0)

    cyclone_risk = 0.0
    if district.coastal_district:
        cyclone_risk = min(max_wind / 120.0, 0.6) + (district.historical_flood_freq or 0.1) * 0.3

    return (
        round(min(flood_risk, 1.0), 3),
        round(min(heatwave_risk, 1.0), 3),
        round(min(cyclone_risk, 1.0), 3),
    )


def predict_lstm(district: District, db: Session):
    """
    Predict risks using LSTM window model.
    Returns (flood_risk, heatwave_risk, cyclone_risk).
    """
    global _lstm_model
    if _lstm_model is None:
        _load_lstm()

    snaps = _get_window(district.id, db)
    window = _pad_window(snaps)  # (12, 5)

    if _lstm_model is not None:
        try:
            X = window.reshape(1, 12, 5)
            preds = _lstm_model.predict(X, verbose=0)[0]  # [flood, heat, cyclone]
            return (
                round(float(preds[0]), 3),
                round(float(preds[1]), 3),
                round(float(preds[2]), 3),
            )
        except Exception as e:
            print(f"LSTM inference error: {e}")

    return _rule_based(district, window)


def generate_72h_forecast(district: District, db: Session) -> list:
    """
    Simulated 72-hour risk forecast using jittered LSTM predictions.
    Returns list of {time, flood_risk, heatwave_risk, cyclone_risk, composite_risk}.
    """
    base_flood, base_heat, base_cyclone = predict_lstm(district, db)
    now = datetime.utcnow()
    forecast = []
    for i in range(12):  # 12 × 6h = 72h
        jitter = random.uniform(-0.05, 0.05)
        flood = round(min(max(base_flood + jitter, 0.0), 1.0), 3)
        heat = round(min(max(base_heat + jitter * 0.5, 0.0), 1.0), 3)
        cyclone = round(min(max(base_cyclone + jitter * 0.3, 0.0), 1.0), 3)
        composite = round(0.5 * flood + 0.3 * cyclone + 0.2 * heat, 3)
        forecast.append({
            "time": (now + timedelta(hours=6 * i)).isoformat(),
            "flood_risk": flood,
            "heatwave_risk": heat,
            "cyclone_risk": cyclone,
            "composite_risk": composite,
        })
    return forecast
