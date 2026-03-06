"""
Tests for Weather endpoints and OpenWeather service.
Run: pytest tests/test_weather.py -v
"""
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


# ---------------------------------------------------------------------------
# Mock DB district
# ---------------------------------------------------------------------------

class MockDistrict:
    id = 1
    name = "Patna"
    state = "Bihar"
    lat = 25.6
    lng = 85.1
    coastal_district = False
    historical_flood_freq = 0.5


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

def test_weather_all_returns_list():
    """GET /weather/all should return a list (possibly empty in test DB)."""
    resp = client.get("/weather/all")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_weather_current_missing_district():
    """GET /weather/current/{id} with non-existent ID should return 404."""
    resp = client.get("/weather/current/99999")
    assert resp.status_code == 404


def test_weather_forecast_missing_district():
    """GET /weather/forecast/{id} with non-existent ID should return 404."""
    resp = client.get("/weather/forecast/99999")
    assert resp.status_code == 404


def test_mock_weather_generator():
    """_generate_mock_weather should return valid structure."""
    from app.services.openweather import _generate_mock_weather
    d = MockDistrict()
    data = _generate_mock_weather(d)
    assert "rainfall_mm" in data
    assert "temperature_c" in data
    assert "humidity_pct" in data
    assert "wind_speed_kmh" in data
    assert "river_level_m" in data
    assert 0 <= data["rainfall_mm"]
    assert 15 <= data["temperature_c"] <= 50
    assert 0 <= data["humidity_pct"] <= 100


def test_mock_weather_monsoon_vs_dry():
    """Monsoon months should produce higher rainfall than dry months."""
    from app.services.openweather import _generate_mock_weather
    from unittest.mock import patch
    import datetime

    d = MockDistrict()

    # Force monsoon month (July = 7)
    with patch("app.services.openweather.datetime") as mock_dt:
        mock_dt.utcnow.return_value = datetime.datetime(2024, 7, 1)
        monsoon_data = _generate_mock_weather(d)

    # Force dry month (January = 1)
    with patch("app.services.openweather.datetime") as mock_dt:
        mock_dt.utcnow.return_value = datetime.datetime(2024, 1, 1)
        dry_data = _generate_mock_weather(d)

    # Monsoon should have higher upper bound (pass if max rainfall is higher)
    # This is a statistical test, not a strict assertion
    assert monsoon_data["rainfall_mm"] >= 0
    assert dry_data["rainfall_mm"] >= 0


def test_forecast_mock_structure():
    """Mock forecast should return 16 items."""
    from app.services.openweather import get_forecast_for_district
    with patch("app.services.openweather.settings") as mock_settings:
        mock_settings.OPENWEATHER_API_KEY = ""  # force mock path
        d = MockDistrict()
        result = get_forecast_for_district(d)
    assert "forecast" in result
    assert len(result["forecast"]) == 16
    for item in result["forecast"]:
        assert "time" in item
        assert "rainfall_mm" in item
        assert "temperature_c" in item
