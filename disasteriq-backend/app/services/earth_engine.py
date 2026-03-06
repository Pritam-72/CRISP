"""
Google Earth Engine (GEE) satellite data service.
Fetches NDVI scores and flood extent for Indian districts.

Falls back to mock values when GEE_SERVICE_ACCOUNT_JSON is not configured.
Install: pip install earthengine-api
"""
import json
import random
from datetime import datetime
from typing import Optional

from app.config import settings


def _get_ee():
    """Initialize and return Earth Engine module, or None on failure."""
    try:
        import ee  # type: ignore
        if settings.GEE_SERVICE_ACCOUNT_JSON:
            credentials = ee.ServiceAccountCredentials(
                "", key_data=settings.GEE_SERVICE_ACCOUNT_JSON
            )
            ee.Initialize(credentials)
        else:
            ee.Initialize()
        return ee
    except Exception as e:
        print(f"⚠️  GEE not available: {e}")
        return None


def get_ndvi(lat: float, lng: float) -> float:
    """
    Fetch latest NDVI (Normalized Difference Vegetation Index) for a point.
    NDVI range: -1.0 (water/bare) to 1.0 (dense vegetation).
    Lower NDVI → less vegetation → higher flood runoff risk.
    """
    ee = _get_ee()
    if ee is None:
        # Mock: randomise around realistic India baseline
        return round(random.uniform(0.3, 0.7), 3)

    try:
        point = ee.Geometry.Point([lng, lat])
        collection = (
            ee.ImageCollection("MODIS/006/MOD13Q1")
            .filterDate(
                (datetime.utcnow().strftime("%Y-%m-01")),
                datetime.utcnow().strftime("%Y-%m-%d"),
            )
            .select("NDVI")
        )
        image = collection.mean()
        result = image.sample(point, 250).first().getInfo()
        ndvi_raw = result["properties"]["NDVI"]
        return round(ndvi_raw * 0.0001, 3)  # MODIS scale factor
    except Exception as e:
        print(f"GEE NDVI error: {e}")
        return round(random.uniform(0.3, 0.7), 3)


def get_flood_extent(lat: float, lng: float, radius_km: float = 50) -> float:
    """
    Estimate proportion of land area flooded within radius.
    Returns 0.0–1.0 (0 = no flooding, 1 = fully inundated).
    Uses JRC Global Surface Water dataset.
    """
    ee = _get_ee()
    if ee is None:
        return round(random.uniform(0.0, 0.2), 3)

    try:
        point = ee.Geometry.Point([lng, lat])
        buffer = point.buffer(radius_km * 1000)
        jrc = ee.Image("JRC/GSW1_4/GlobalSurfaceWater").select("occurrence")
        stats = jrc.reduceRegion(
            reducer=ee.Reducer.mean(),
            geometry=buffer,
            scale=30,
            maxPixels=1e9,
        )
        flood_fraction = stats.getInfo().get("occurrence", 0) / 100.0
        return round(min(flood_fraction, 1.0), 3)
    except Exception as e:
        print(f"GEE flood extent error: {e}")
        return round(random.uniform(0.0, 0.2), 3)


def get_district_satellite_data(lat: float, lng: float) -> dict:
    """
    Convenience wrapper returning all satellite features for a district location.
    Used by feature_engineering.py to replace the static ndvi_score mock.
    """
    return {
        "ndvi_score": get_ndvi(lat, lng),
        "flood_extent": get_flood_extent(lat, lng),
        "fetched_at": datetime.utcnow().isoformat(),
    }
