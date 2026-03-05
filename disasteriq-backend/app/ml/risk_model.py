"""
XGBoost Risk Model — loads pre-trained models and runs inference.
Falls back to rule-based scoring if model file not found (hackathon mode).
"""
import json
import os
import pickle
import math
from datetime import datetime, timedelta
from typing import List, Dict
import numpy as np

from sqlalchemy.orm import Session
from app.models import District, WeatherSnapshot, RiskScore

MODEL_DIR = os.path.join(os.path.dirname(__file__), "../../ml_training/models")

_flood_model = None
_heatwave_model = None
_cyclone_model = None


def _load_models():
    global _flood_model, _heatwave_model, _cyclone_model
    try:
        with open(os.path.join(MODEL_DIR, "flood_model.pkl"), "rb") as f:
            _flood_model = pickle.load(f)
        with open(os.path.join(MODEL_DIR, "heatwave_model.pkl"), "rb") as f:
            _heatwave_model = pickle.load(f)
        with open(os.path.join(MODEL_DIR, "cyclone_model.pkl"), "rb") as f:
            _cyclone_model = pickle.load(f)
        print("✅ ML models loaded from disk")
    except Exception as e:
        print(f"⚠️  ML models not found ({e}), using rule-based fallback")
        _flood_model = None


def _build_features(district: District, weather: WeatherSnapshot, month: int) -> np.ndarray:
    """Build feature vector matching training schema."""
    month_sin = math.sin(2 * math.pi * month / 12)
    month_cos = math.cos(2 * math.pi * month / 12)

    features = [
        weather.rainfall_mm if weather else 0.0,      # rainfall_mm_24h
        (weather.rainfall_mm or 0) * 3,                # rainfall_mm_72h (approx)
        weather.temperature_c if weather else 28.0,
        weather.humidity_pct if weather else 65.0,
        weather.wind_speed_kmh if weather else 10.0,
        weather.river_level_m if weather else 1.5,
        0.1,                                           # river_level_delta_6h (approx)
        district.elevation_m or 50.0,
        district.historical_flood_freq or 0.1,
        0.6,                                           # ndvi_score (mock)
        month_sin,
        month_cos,
        1.0 if district.coastal_district else 0.0,
    ]
    return np.array(features).reshape(1, -1)


def _rule_based_flood_risk(district: District, weather: WeatherSnapshot) -> float:
    """Fallback when ML model isn't trained yet."""
    risk = 0.0
    rainfall = weather.rainfall_mm if weather else 0
    risk += min(rainfall / 100, 0.5)
    risk += (district.historical_flood_freq or 0.1) * 0.4
    if district.coastal_district:
        risk += 0.1
    risk += max(0, (1.5 - (district.elevation_m or 50) / 100)) * 0.1
    return min(risk, 1.0)


def _rule_based_heatwave_risk(district: District, weather: WeatherSnapshot) -> float:
    temp = weather.temperature_c if weather else 28
    humidity = weather.humidity_pct if weather else 65
    risk = max(0, (temp - 35) / 10) * 0.7 + max(0, (humidity - 60) / 40) * 0.3
    return min(risk, 1.0)


def _rule_based_cyclone_risk(district: District, weather: WeatherSnapshot) -> float:
    if not district.coastal_district:
        return 0.0
    wind = weather.wind_speed_kmh if weather else 10
    risk = min(wind / 120, 0.6) + (district.historical_flood_freq or 0.1) * 0.3
    return min(risk, 1.0)


def predict_all_districts(db: Session) -> int:
    """Run risk prediction for all districts and store to DB."""
    if _flood_model is None:
        _load_models()

    districts = db.query(District).all()
    month = datetime.utcnow().month
    count = 0

    for district in districts:
        weather = (
            db.query(WeatherSnapshot)
            .filter(WeatherSnapshot.district_id == district.id)
            .order_by(WeatherSnapshot.time.desc())
            .first()
        )

        if _flood_model is not None:
            X = _build_features(district, weather, month)
            flood_risk = float(_flood_model.predict_proba(X)[0][1])
            heatwave_risk = float(_heatwave_model.predict_proba(X)[0][1])
            cyclone_risk = float(_cyclone_model.predict_proba(X)[0][1])

            # SHAP explanation for flood model
            try:
                import shap
                explainer = shap.TreeExplainer(_flood_model)
                shap_values = explainer.shap_values(X)
                feature_names = [
                    "rainfall_24h", "rainfall_72h", "temperature", "humidity",
                    "wind_speed", "river_level", "river_delta", "elevation",
                    "flood_freq", "ndvi", "month_sin", "month_cos", "coastal"
                ]
                shap_dict = dict(zip(feature_names, shap_values[0].tolist()))
                shap_json = json.dumps(shap_dict)
            except Exception:
                shap_json = "{}"
        else:
            flood_risk = _rule_based_flood_risk(district, weather)
            heatwave_risk = _rule_based_heatwave_risk(district, weather)
            cyclone_risk = _rule_based_cyclone_risk(district, weather)
            shap_json = json.dumps({
                "rainfall": round(flood_risk * 0.4, 3),
                "history": round(flood_risk * 0.3, 3),
                "elevation": round(flood_risk * 0.2, 3),
                "coastal": round(flood_risk * 0.1, 3),
            })

        composite = round(
            0.5 * flood_risk + 0.3 * cyclone_risk + 0.2 * heatwave_risk, 3
        )
        people_at_risk = int((district.population or 100000) * composite * 0.3)
        confidence = 0.82 if _flood_model else 0.65

        score = RiskScore(
            district_id=district.id,
            flood_risk=round(flood_risk, 3),
            heatwave_risk=round(heatwave_risk, 3),
            cyclone_risk=round(cyclone_risk, 3),
            composite_risk=composite,
            people_at_risk=people_at_risk,
            confidence=confidence,
            shap_explanation=shap_json,
        )
        db.add(score)
        count += 1

    db.commit()
    return count


def get_risk_history(district_id: int, db: Session, hours: int = 72) -> List[dict]:
    since = datetime.utcnow() - timedelta(hours=hours)
    scores = (
        db.query(RiskScore)
        .filter(RiskScore.district_id == district_id, RiskScore.time >= since)
        .order_by(RiskScore.time.asc())
        .all()
    )
    return [
        {
            "time": s.time.isoformat(),
            "flood_risk": s.flood_risk,
            "heatwave_risk": s.heatwave_risk,
            "cyclone_risk": s.cyclone_risk,
            "composite_risk": s.composite_risk,
        }
        for s in scores
    ]


def predict_forecast(district_id: int, db: Session) -> dict:
    """72-hour projected risk using weather forecast data."""
    from app.services.openweather import get_forecast_for_district
    district = db.query(District).filter(District.id == district_id).first()
    if not district:
        return {"error": "District not found"}

    forecast_data = get_forecast_for_district(district)
    projections = []
    for entry in forecast_data.get("forecast", [])[:12]:  # 12 x 6h = 72h
        # Build a mock WeatherSnapshot for feature extraction
        class _W:
            rainfall_mm = entry.get("rainfall_mm", 0)
            temperature_c = entry.get("temperature_c", 28)
            humidity_pct = entry.get("humidity_pct", 65)
            wind_speed_kmh = entry.get("wind_speed_kmh", 10)
            river_level_m = 1.5

        weather = _W()
        flood_risk = _rule_based_flood_risk(district, weather)
        cyclone_risk = _rule_based_cyclone_risk(district, weather)
        heatwave_risk = _rule_based_heatwave_risk(district, weather)
        composite = round(0.5 * flood_risk + 0.3 * cyclone_risk + 0.2 * heatwave_risk, 3)

        projections.append({
            "time": entry.get("time"),
            "flood_risk": round(flood_risk, 3),
            "heatwave_risk": round(heatwave_risk, 3),
            "cyclone_risk": round(cyclone_risk, 3),
            "composite_risk": composite,
        })

    return {
        "district_id": district_id,
        "district_name": district.name,
        "forecast_72h": projections,
    }
