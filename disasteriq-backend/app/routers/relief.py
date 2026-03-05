from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database import get_db
from app.models import Resource, Allocation, District
from app.auth import get_current_user, require_role
from app.ml.optimizer import run_vrp_optimization

router = APIRouter()


class ResourceUpdate(BaseModel):
    type: str
    quantity: int
    location_district: int
    status: str = "available"
    capacity: int = 50


class OptimizeRequest(BaseModel):
    scenario: Optional[str] = None  # e.g. "odisha_cyclone" for demo
    custom_resources: Optional[List[dict]] = None


@router.get("/resources")
def get_resources(db: Session = Depends(get_db), _=Depends(get_current_user)):
    resources = db.query(Resource).all()
    return [
        {
            "id": r.id,
            "type": r.type,
            "quantity": r.quantity,
            "location_district": r.location_district,
            "status": r.status,
            "capacity": r.capacity,
        }
        for r in resources
    ]


@router.post("/resources")
def update_resources(
    items: List[ResourceUpdate],
    db: Session = Depends(get_db),
    _=Depends(require_role("admin", "officer")),
):
    created = []
    for item in items:
        r = Resource(**item.model_dump())
        db.add(r)
        created.append(r)
    db.commit()
    return {"status": "ok", "created": len(created)}


@router.post("/optimize")
def optimize_relief(
    req: OptimizeRequest,
    db: Session = Depends(get_db),
    _=Depends(require_role("admin", "officer")),
):
    """Run OR-Tools VRP optimization and return allocation plan + route GeoJSON."""
    result = run_vrp_optimization(db, scenario=req.scenario, custom_resources=req.custom_resources)
    return result


@router.get("/allocations")
def get_allocations(db: Session = Depends(get_db), _=Depends(get_current_user)):
    allocs = db.query(Allocation).order_by(Allocation.created_at.desc()).limit(100).all()
    result = []
    for a in allocs:
        to_dist = db.query(District).filter(District.id == a.district_id).first()
        from_dist = db.query(District).filter(District.id == a.from_district_id).first()
        result.append({
            "id": a.id,
            "created_at": a.created_at.isoformat(),
            "to_district": to_dist.name if to_dist else "Unknown",
            "from_district": from_dist.name if from_dist else "Depot",
            "resource_type": a.resource_type,
            "quantity_allocated": a.quantity_allocated,
            "estimated_arrival_mins": a.estimated_arrival_mins,
            "optimization_score": a.optimization_score,
            "route_polyline": a.route_polyline,
        })
    return result
