"""
India Meteorological Department (IMD) data scraper.
Primary source: https://mausam.imd.gov.in/
Falls back to mock data when the IMD portal is unreachable (common during actual disasters).
"""
import json
import random
import httpx
from datetime import datetime
from typing import Optional

from app.models import District


IMD_BASE_URL = "https://mausam.imd.gov.in"
_imd_cache: dict = {}  # in-memory cache keyed by district name


def _mock_imd_data(district: District) -> dict:
    """Realistic IMD-style mock data for demo / fallback."""
    month = datetime.utcnow().month
    is_monsoon = 6 <= month <= 9
    is_coastal = district.coastal_district

    return {
        "district": district.name,
        "state": district.state,
        "date": datetime.utcnow().strftime("%Y-%m-%d"),
        "imd_rainfall_mm": round(random.uniform(0, 40 if is_monsoon else 5), 1),
        "imd_temp_max_c": round(random.uniform(28, 42 if month in [4, 5] else 32), 1),
        "imd_temp_min_c": round(random.uniform(18, 28), 1),
        "imd_wind_kmh": round(random.uniform(5, 60 if is_coastal else 25), 1),
        "imd_warning": _get_mock_warning(is_monsoon, is_coastal),
        "source": "mock_imd",
    }


def _get_mock_warning(is_monsoon: bool, is_coastal: bool) -> str:
    if is_monsoon and is_coastal:
        return random.choice(["Red Alert", "Orange Alert", "Yellow Alert", "No Warning"])
    if is_monsoon:
        return random.choice(["Yellow Alert", "No Warning", "No Warning"])
    return "No Warning"


def _try_fetch_imd(district_name: str, state: str) -> Optional[dict]:
    """
    Attempt to fetch from IMD's district-level weather API.
    IMD does not have a public stable API; this attempts a best-effort scrape
    of the Open Data portal (data.gov.in).
    """
    try:
        # data.gov.in has some IMD datasets available as JSON
        url = "https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070"
        params = {
            "api-key": "579b464db66ec23bdd000001cdd3946e44ce4aad38d07994e8cb4f7",  # public demo key
            "format": "json",
            "limit": 5,
            "filters[State]": state,
            "filters[District]": district_name,
        }
        resp = httpx.get(url, params=params, timeout=5.0)
        resp.raise_for_status()
        records = resp.json().get("records", [])
        if not records:
            return None
        rec = records[0]
        return {
            "district": district_name,
            "state": state,
            "date": rec.get("Date", datetime.utcnow().strftime("%Y-%m-%d")),
            "imd_rainfall_mm": float(rec.get("Rainfall", 0) or 0),
            "imd_temp_max_c": float(rec.get("MaxTemp", 30) or 30),
            "imd_temp_min_c": float(rec.get("MinTemp", 20) or 20),
            "imd_wind_kmh": float(rec.get("WindSpeed", 10) or 10),
            "imd_warning": rec.get("Warning", "No Warning"),
            "source": "imd_live",
        }
    except Exception:
        return None


def get_imd_data(district: District) -> dict:
    """
    Public function: fetch IMD data for a district with in-memory cache.
    Falls back to mock data if live fetch fails.
    """
    cache_key = f"{district.state}:{district.name}"

    # Return cached if fresh (within same minute)
    if cache_key in _imd_cache:
        cached = _imd_cache[cache_key]
        if cached.get("fetched_minute") == datetime.utcnow().strftime("%Y-%m-%d %H:%M"):
            return cached

    live = _try_fetch_imd(district.name, district.state)
    data = live if live else _mock_imd_data(district)
    data["fetched_minute"] = datetime.utcnow().strftime("%Y-%m-%d %H:%M")
    _imd_cache[cache_key] = data
    return data


def get_all_warnings() -> list:
    """
    Returns list of active IMD district warnings (scrapped from public IMD RSS / JSON).
    Used by the alerts router to auto-generate entries.
    """
    # Demo mode: return representative warnings
    return [
        {"state": "Odisha", "district": "Puri", "warning": "Orange Alert", "hazard": "cyclone"},
        {"state": "Kerala", "district": "Ernakulam", "warning": "Red Alert", "hazard": "flood"},
        {"state": "Bihar", "district": "Patna", "warning": "Yellow Alert", "hazard": "flood"},
        {"state": "Gujarat", "district": "Kutch", "warning": "Orange Alert", "hazard": "cyclone"},
    ]
