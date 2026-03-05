from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import json

from app.database import get_db
from app.models import WeatherSnapshot, District
from app.auth import get_current_user
from app.services.openweather import fetch_weather_for_district, get_all_districts_weather

router = APIRouter()


@router.get("/current/{district_id}")
def get_current_weather(
    district_id: int,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    district = db.query(District).filter(District.id == district_id).first()
    if not district:
        raise HTTPException(status_code=404, detail="District not found")

    # Try to fetch live, fall back to latest stored
    snap = fetch_weather_for_district(district, db)
    return {
        "district_id": district_id,
        "district_name": district.name,
        "state": district.state,
        "data": snap,
    }


@router.get("/all")
def get_all_weather(
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    """Returns latest weather snapshot for every district."""
    return get_all_districts_weather(db)


@router.get("/forecast/{district_id}")
def get_forecast(district_id: int, db: Session = Depends(get_db), _=Depends(get_current_user)):
    district = db.query(District).filter(District.id == district_id).first()
    if not district:
        raise HTTPException(status_code=404, detail="District not found")

    from app.services.openweather import get_forecast_for_district
    return get_forecast_for_district(district)
