"""
Tests for Risk prediction endpoints and ML model logic.
Run: pytest tests/test_risk.py -v
"""
import pytest
import numpy as np
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


class MockDistrict:
    id = 1
    name = "Kutch"
    state = "Gujarat"
    lat = 23.7
    lng = 69.8
    population = 2000000
    elevation_m = 50.0
    historical_flood_freq = 0.6
    coastal_district = True
    vulnerability_weight = 1.2


class MockWeather:
    rainfall_mm = 55.0
    temperature_c = 31.0
    humidity_pct = 78.0
    wind_speed_kmh = 42.0
    river_level_m = 3.2


# ---------------------------------------------------------------------------
# Rule-based fallback tests
# ---------------------------------------------------------------------------

def test_rule_based_flood_risk_high():
    from app.ml.risk_model import _rule_based_flood_risk
    d, w = MockDistrict(), MockWeather()
    risk = _rule_based_flood_risk(d, w)
    assert 0.0 <= risk <= 1.0
    assert risk > 0.3  # coastal + high rain should give elevated risk


def test_rule_based_flood_risk_low():
    from app.ml.risk_model import _rule_based_flood_risk

    class LowRisk:
        rainfall_mm = 1.0
        historical_flood_freq = 0.05
        coastal_district = False
        elevation_m = 500

    risk = _rule_based_flood_risk(LowRisk(), LowRisk())
    assert risk < 0.4


def test_rule_based_heatwave_risk():
    from app.ml.risk_model import _rule_based_heatwave_risk

    class HotWeather:
        temperature_c = 45.0
        humidity_pct = 20.0

    risk = _rule_based_heatwave_risk(MockDistrict(), HotWeather())
    assert risk > 0.5


def test_rule_based_cyclone_coastal():
    from app.ml.risk_model import _rule_based_cyclone_risk

    class HighWind:
        wind_speed_kmh = 110.0

    risk = _rule_based_cyclone_risk(MockDistrict(), HighWind())
    assert risk > 0.3  # coastal + high wind


def test_rule_based_cyclone_inland():
    from app.ml.risk_model import _rule_based_cyclone_risk

    class Inland:
        coastal_district = False
        historical_flood_freq = 0.1

    class HWind:
        wind_speed_kmh = 120.0

    risk = _rule_based_cyclone_risk(Inland(), HWind())
    assert risk == 0.0  # inland → no cyclone


# ---------------------------------------------------------------------------
# Feature engineering tests
# ---------------------------------------------------------------------------

def test_build_feature_vector_shape():
    from app.ml.feature_engineering import build_feature_vector
    vec = build_feature_vector(MockDistrict(), MockWeather(), db=None, month=7)
    assert vec.shape == (1, 13)
    assert vec.dtype == np.float32


def test_cyclical_encoding():
    from app.ml.feature_engineering import _cyclical_month
    import math
    sin_val, cos_val = _cyclical_month(6)
    expected_sin = math.sin(2 * math.pi * 6 / 12)
    assert abs(sin_val - expected_sin) < 1e-5


# ---------------------------------------------------------------------------
# Endpoint tests
# ---------------------------------------------------------------------------

def test_risk_heatmap_returns_list():
    resp = client.get("/risk/heatmap")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)


def test_risk_predict_post():
    resp = client.post("/risk/predict")
    assert resp.status_code in (200, 401, 403)  # may require auth


def test_risk_district_missing():
    resp = client.get("/risk/district/99999")
    assert resp.status_code == 404


def test_risk_forecast_missing():
    resp = client.get("/risk/forecast/99999")
    assert resp.status_code == 404
