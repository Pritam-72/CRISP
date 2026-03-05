"""
OpenWeatherMap service with Redis caching and mock data fallback.
Mock data is used when APP_ENV=demo or OPENWEATHER_API_KEY is not set.
"""
import json
import random
import httpx
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy.orm import Session
from app.config import settings
from app.models import District, WeatherSnapshot

CACHE_TTL = 900  # 15 minutes


def _get_redis():
    try:
        import redis
        return redis.from_url(settings.REDIS_URL)
    except Exception:
        return None


def _generate_mock_weather(district: District) -> dict:
    """Generates realistic mock weather data based on district location & season."""
    month = datetime.utcnow().month
    # Monsoon season (June–September) — higher rainfall
    base_rain = 20 if 6 <= month <= 9 else 2
    is_coastal = district.coastal_district

    return {
        "rainfall_mm": round(random.uniform(0, base_rain * (2 if is_coastal else 1)), 1),
        "temperature_c": round(random.uniform(28 if month in [4, 5] else 22, 40 if month in [4, 5] else 32), 1),
        "humidity_pct": round(random.uniform(60 if 6 <= month <= 9 else 40, 90), 1),
        "wind_speed_kmh": round(random.uniform(5, 45 if is_coastal else 20), 1),
        "river_level_m": round(random.uniform(0.8, 3.5 if 6 <= month <= 9 else 1.5), 2),
        "source": "mock",
    }


def _fetch_from_openweather(district: District) -> Optional[dict]:
    """Fetch real weather from OpenWeatherMap API."""
    if not settings.OPENWEATHER_API_KEY:
        return None
    try:
        url = "https://api.openweathermap.org/data/2.5/weather"
        params = {
            "lat": district.lat,
            "lon": district.lng,
            "appid": settings.OPENWEATHER_API_KEY,
            "units": "metric",
        }
        resp = httpx.get(url, params=params, timeout=5.0)
        resp.raise_for_status()
        data = resp.json()
        return {
            "rainfall_mm": data.get("rain", {}).get("1h", 0.0),
            "temperature_c": data["main"]["temp"],
            "humidity_pct": data["main"]["humidity"],
            "wind_speed_kmh": round(data["wind"]["speed"] * 3.6, 1),
            "river_level_m": 1.5,  # Not available from OWM free tier
            "source": "openweather",
        }
    except Exception:
        return None


def fetch_weather_for_district(district: District, db: Session) -> dict:
    """Fetch weather with Redis cache. Falls back to mock on failure."""
    r = _get_redis()
    cache_key = f"weather:{district.id}"

    if r:
        cached = r.get(cache_key)
        if cached:
            return json.loads(cached)

    # Try live API first
    data = _fetch_from_openweather(district)
    if data is None:
        data = _generate_mock_weather(district)

    # Persist to DB
    snap = WeatherSnapshot(
        district_id=district.id,
        rainfall_mm=data["rainfall_mm"],
        temperature_c=data["temperature_c"],
        humidity_pct=data["humidity_pct"],
        wind_speed_kmh=data["wind_speed_kmh"],
        river_level_m=data["river_level_m"],
        source=data.get("source", "mock"),
    )
    db.add(snap)
    db.commit()

    # Cache
    if r:
        r.setex(cache_key, CACHE_TTL, json.dumps(data))

    return data


def get_all_districts_weather(db: Session) -> list:
    districts = db.query(District).all()
    result = []
    for d in districts:
        snap = (
            db.query(WeatherSnapshot)
            .filter(WeatherSnapshot.district_id == d.id)
            .order_by(WeatherSnapshot.time.desc())
            .first()
        )
        result.append({
            "district_id": d.id,
            "name": d.name,
            "state": d.state,
            "rainfall_mm": snap.rainfall_mm if snap else 0.0,
            "temperature_c": snap.temperature_c if snap else 28.0,
            "humidity_pct": snap.humidity_pct if snap else 65.0,
            "wind_speed_kmh": snap.wind_speed_kmh if snap else 10.0,
            "river_level_m": snap.river_level_m if snap else 1.5,
            "updated_at": snap.time.isoformat() if snap else None,
        })
    return result


def get_forecast_for_district(district: District) -> dict:
    """5-day forecast (real OWM or mock)."""
    if settings.OPENWEATHER_API_KEY:
        try:
            url = "https://api.openweathermap.org/data/2.5/forecast"
            params = {
                "lat": district.lat,
                "lon": district.lng,
                "appid": settings.OPENWEATHER_API_KEY,
                "units": "metric",
                "cnt": 16,
            }
            resp = httpx.get(url, params=params, timeout=5.0)
            resp.raise_for_status()
            data = resp.json()
            forecast = [
                {
                    "time": item["dt_txt"],
                    "rainfall_mm": item.get("rain", {}).get("3h", 0.0),
                    "temperature_c": item["main"]["temp"],
                    "humidity_pct": item["main"]["humidity"],
                    "wind_speed_kmh": round(item["wind"]["speed"] * 3.6, 1),
                }
                for item in data["list"]
            ]
            return {"district_id": district.id, "forecast": forecast}
        except Exception:
            pass

    # Mock forecast
    import random
    now = datetime.utcnow()
    mock_forecast = []
    for i in range(16):
        t = now + timedelta(hours=3 * i)
        mock_forecast.append({
            "time": t.strftime("%Y-%m-%d %H:%M:%S"),
            "rainfall_mm": round(random.uniform(0, 25), 1),
            "temperature_c": round(random.uniform(24, 36), 1),
            "humidity_pct": round(random.uniform(55, 90), 1),
            "wind_speed_kmh": round(random.uniform(5, 40), 1),
        })
    return {"district_id": district.id, "district_name": district.name, "forecast": mock_forecast}
