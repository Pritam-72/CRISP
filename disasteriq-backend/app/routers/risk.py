from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import json

from app.database import get_db
from app.models import RiskScore, District
from app.auth import get_current_user
from app.ml.risk_model import predict_all_districts, get_risk_history

router = APIRouter()


@router.post("/predict")
def run_prediction(db: Session = Depends(get_db), _=Depends(get_current_user)):
    """Trigger risk prediction for all districts. Stores results to DB."""
    count = predict_all_districts(db)
    return {"status": "ok", "districts_updated": count}


@router.get("/heatmap")
def get_heatmap(db: Session = Depends(get_db), _=Depends(get_current_user)):
    """Returns latest composite risk score for all districts — used for map heatmap."""
    districts = db.query(District).all()
    result = []
    for d in districts:
        latest = (
            db.query(RiskScore)
            .filter(RiskScore.district_id == d.id)
            .order_by(RiskScore.time.desc())
            .first()
        )
        result.append({
            "district_id": d.id,
            "name": d.name,
            "state": d.state,
            "lat": d.lat,
            "lng": d.lng,
            "population": d.population,
            "composite_risk": latest.composite_risk if latest else 0.0,
            "flood_risk": latest.flood_risk if latest else 0.0,
            "heatwave_risk": latest.heatwave_risk if latest else 0.0,
            "cyclone_risk": latest.cyclone_risk if latest else 0.0,
            "people_at_risk": latest.people_at_risk if latest else 0,
            "confidence": latest.confidence if latest else 0.5,
            "updated_at": latest.time.isoformat() if latest else None,
        })
    return result


@router.get("/district/{district_id}")
def get_district_risk(district_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    district = db.query(District).filter(District.id == district_id).first()
    if not district:
        raise HTTPException(status_code=404, detail="District not found")

    latest = (
        db.query(RiskScore)
        .filter(RiskScore.district_id == district_id)
        .order_by(RiskScore.time.desc())
        .first()
    )
    history = get_risk_history(district_id, db, hours=72)

    shap_data = {}
    if latest and latest.shap_explanation:
        try:
            shap_data = json.loads(latest.shap_explanation)
        except Exception:
            pass

    return {
        "district": {
            "id": district.id,
            "name": district.name,
            "state": district.state,
            "population": district.population,
            "lat": district.lat,
            "lng": district.lng,
            "coastal_district": district.coastal_district,
        },
        "current_risk": {
            "flood_risk": latest.flood_risk if latest else 0.0,
            "heatwave_risk": latest.heatwave_risk if latest else 0.0,
            "cyclone_risk": latest.cyclone_risk if latest else 0.0,
            "composite_risk": latest.composite_risk if latest else 0.0,
            "people_at_risk": latest.people_at_risk if latest else 0,
            "confidence": latest.confidence if latest else 0.5,
            "updated_at": latest.time.isoformat() if latest else None,
        },
        "shap_explanation": shap_data,
        "history_72h": history,
    }


@router.get("/forecast/{district_id}")
def get_risk_forecast(district_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    """72-hour forward risk projection based on weather forecast."""
    from app.ml.risk_model import predict_forecast
    return predict_forecast(district_id, db)
