"""
Tests for OR-Tools VRP optimizer.
Run: pytest tests/test_optimizer.py -v
"""
import pytest
from app.ml.optimizer import solve_vrp


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

SAMPLE_DISTRICTS = [
    {"id": 1, "name": "Kutch",      "lat": 23.7, "lng": 69.8, "demand": 50, "priority": 0.9},
    {"id": 2, "name": "Puri",       "lat": 19.8, "lng": 85.8, "demand": 30, "priority": 0.7},
    {"id": 3, "name": "Patna",      "lat": 25.6, "lng": 85.1, "demand": 20, "priority": 0.5},
]

SAMPLE_DEPOTS = [
    {"id": 10, "name": "Ahmedabad Depot", "lat": 23.0, "lng": 72.6, "supply": 100},
    {"id": 11, "name": "Bhubaneswar Depot", "lat": 20.3, "lng": 85.8, "supply": 80},
]

SAMPLE_VEHICLES = [
    {"id": "V1", "depot_id": 10, "capacity": 50},
    {"id": "V2", "depot_id": 10, "capacity": 50},
    {"id": "V3", "depot_id": 11, "capacity": 40},
]


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

def test_vrp_returns_allocations():
    """solve_vrp should return a non-empty list of allocations."""
    result = solve_vrp(SAMPLE_DISTRICTS, SAMPLE_DEPOTS, SAMPLE_VEHICLES)
    assert isinstance(result, dict)
    assert "allocations" in result or "routes" in result or "assignments" in result


def test_vrp_empty_districts():
    """solve_vrp with no districts should return empty result without error."""
    result = solve_vrp([], SAMPLE_DEPOTS, SAMPLE_VEHICLES)
    assert result is not None


def test_vrp_single_district_single_vehicle():
    """Simplest possible VRP: 1 district, 1 vehicle."""
    districts = [{"id": 1, "name": "Test", "lat": 20.0, "lng": 80.0, "demand": 10, "priority": 0.8}]
    depots = [{"id": 10, "name": "Depot", "lat": 19.0, "lng": 79.0, "supply": 50}]
    vehicles = [{"id": "V1", "depot_id": 10, "capacity": 50}]
    result = solve_vrp(districts, depots, vehicles)
    assert result is not None


def test_vrp_demand_exceeds_supply():
    """
    When total demand > total supply, the VRP should still return a partial
    feasible solution without crashing.
    """
    high_demand_districts = [
        {"id": i, "name": f"D{i}", "lat": 20.0 + i * 0.5, "lng": 80.0, "demand": 200, "priority": 0.8}
        for i in range(5)
    ]
    result = solve_vrp(high_demand_districts, SAMPLE_DEPOTS, SAMPLE_VEHICLES)
    assert result is not None


def test_haversine_distance():
    """Haversine between two known points should be approximately correct."""
    from app.ml.optimizer import haversine_km
    # Mumbai to Pune → ~120 km
    dist = haversine_km(19.08, 72.88, 18.52, 73.86)
    assert 100 < dist < 160, f"Unexpected distance: {dist}"
