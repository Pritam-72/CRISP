"""
OR-Tools VRP Optimizer — solves Vehicle Routing Problem for relief allocation.
Uses haversine distance with road_factor multiplier (OSRM fallback for hackathon).
"""
import json
import math
from typing import List, Optional, Dict
from datetime import datetime

from sqlalchemy.orm import Session
from app.models import District, Resource, RiskScore, Allocation

ROAD_FACTOR = 1.4       # India road network multiplier over straight-line
AVG_SPEED_KMH = 50      # average truck speed in India
MAX_ROUTE_HOURS = 8


def haversine_km(lat1, lng1, lat2, lng2) -> float:
    """Straight-line distance in km between two lat/lng points."""
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lng2 - lng1)
    a = math.sin(d_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def travel_time_mins(dist_km: float) -> int:
    road_km = dist_km * ROAD_FACTOR
    return int((road_km / AVG_SPEED_KMH) * 60)


def _get_demo_scenario_districts(scenario: str, db: Session) -> List[District]:
    """Return pre-selected high-risk districts for named demo scenarios."""
    SCENARIO_STATES = {
        "odisha_cyclone": "Odisha",
        "gujarat_flood": "Gujarat",
        "kerala_flood": "Kerala",
        "bihar_flood": "Bihar",
    }
    state = SCENARIO_STATES.get(scenario)
    if state:
        return db.query(District).filter(District.state == state).all()
    return db.query(District).limit(15).all()


def run_vrp_optimization(
    db: Session,
    scenario: Optional[str] = None,
    custom_resources: Optional[List[dict]] = None,
) -> dict:
    """
    Greedy VRP solver:
    1. Find high-risk districts (composite_risk > 0.4)
    2. Find available resources
    3. Greedily assign nearest available resource depot to each district,
       weighted by (composite_risk × vulnerability_weight)
    """

    # ── Find at-risk districts ───────────────────────────────────────────────
    if scenario:
        candidate_districts = _get_demo_scenario_districts(scenario, db)
    else:
        candidate_districts = db.query(District).all()

    # Get latest risk scores
    at_risk = []
    for d in candidate_districts:
        latest = (
            db.query(RiskScore)
            .filter(RiskScore.district_id == d.id)
            .order_by(RiskScore.time.desc())
            .first()
        )
        risk_val = latest.composite_risk if latest else 0.0
        # confidence gate: only dispatch if confidence > 0.6 AND risk > 0.35
        confidence = latest.confidence if latest else 0.5
        if risk_val > 0.35 and confidence > 0.6:
            at_risk.append((d, risk_val * (d.vulnerability_weight or 1.0)))

    # Sort by weighted risk descending
    at_risk.sort(key=lambda x: x[1], reverse=True)
    at_risk = at_risk[:20]  # cap at 20 districts per solve

    # ── Resource depots ──────────────────────────────────────────────────────
    if custom_resources:
        resources_raw = custom_resources
    else:
        # Default demo resources
        resources_raw = []
        db_resources = db.query(Resource).filter(Resource.status == "available").all()
        for r in db_resources:
            resources_raw.append({
                "id": r.id, "type": r.type, "quantity": r.quantity,
                "location_district": r.location_district, "capacity": r.capacity,
            })

    # Build depot map
    depot_districts: Dict[int, District] = {}
    for r in resources_raw:
        did = r.get("location_district")
        if did and did not in depot_districts:
            d = db.query(District).filter(District.id == did).first()
            if d:
                depot_districts[did] = d

    # ── Greedy assignment ────────────────────────────────────────────────────
    allocations_out = []
    routes_geojson = {"type": "FeatureCollection", "features": []}
    total_score = 0.0
    remaining_resources = {r.get("id"): dict(r) for r in resources_raw}

    for (target_district, weight) in at_risk:
        # Find nearest available depot with resources
        best_depot = None
        best_time = float("inf")

        for depot_id, depot in depot_districts.items():
            available = [
                r for r in remaining_resources.values()
                if r.get("location_district") == depot_id and r.get("quantity", 0) > 0
            ]
            if not available:
                continue

            dist_km = haversine_km(depot.lat, depot.lng, target_district.lat, target_district.lng)
            time_mins = travel_time_mins(dist_km)

            if time_mins < best_time and time_mins <= MAX_ROUTE_HOURS * 60:
                best_time = time_mins
                best_depot = (depot_id, depot, available[0])

        if best_depot is None:
            continue

        depot_id, depot, resource = best_depot
        qty = min(resource.get("quantity", 0), 5)  # allocate up to 5 units per district

        # Deduct
        remaining_resources[resource["id"]]["quantity"] -= qty

        # Score
        dist_km = haversine_km(depot.lat, depot.lng, target_district.lat, target_district.lng)
        opt_score = round(weight / (1 + dist_km / 100), 4)
        total_score += opt_score

        # Store allocation to DB
        alloc = Allocation(
            district_id=target_district.id,
            resource_type=resource.get("type", "truck"),
            quantity_allocated=qty,
            estimated_arrival_mins=best_time,
            optimization_score=opt_score,
            from_district_id=depot_id,
            route_polyline=json.dumps({
                "type": "LineString",
                "coordinates": [
                    [depot.lng, depot.lat],
                    [target_district.lng, target_district.lat],
                ],
            }),
        )
        db.add(alloc)

        # GeoJSON route feature
        routes_geojson["features"].append({
            "type": "Feature",
            "properties": {
                "from": depot.name,
                "to": target_district.name,
                "resource_type": resource.get("type"),
                "quantity": qty,
                "arrival_mins": best_time,
                "risk_score": round(weight, 3),
            },
            "geometry": {
                "type": "LineString",
                "coordinates": [
                    [depot.lng, depot.lat],
                    [target_district.lng, target_district.lat],
                ],
            },
        })

        allocations_out.append({
            "from_district": depot.name,
            "to_district": target_district.name,
            "resource_type": resource.get("type"),
            "quantity": qty,
            "arrival_mins": best_time,
            "distance_km": round(dist_km * ROAD_FACTOR, 1),
            "composite_risk": round(weight / (depot.vulnerability_weight or 1.0), 3),
        })

    db.commit()

    return {
        "status": "optimized",
        "scenario": scenario or "custom",
        "districts_served": len(allocations_out),
        "total_score": round(total_score, 3),
        "allocations": allocations_out,
        "routes_geojson": routes_geojson,
        "timestamp": datetime.utcnow().isoformat(),
    }
