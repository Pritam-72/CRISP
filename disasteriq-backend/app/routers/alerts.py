from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.models import Alert, District
from app.auth import get_current_user, require_role
from app.services.alert_sender import send_alert

router = APIRouter()


class SendAlertRequest(BaseModel):
    district_id: int
    severity: str = "high"
    message: str
    channel: str = "dashboard"  # dashboard / sms / whatsapp


@router.post("/send")
def trigger_alert(
    req: SendAlertRequest,
    db: Session = Depends(get_db),
    _=Depends(require_role("admin", "officer")),
):
    district = db.query(District).filter(District.id == req.district_id).first()
    if not district:
        raise HTTPException(status_code=404, detail="District not found")

    # Confidence gate: only send if confidence gate met (handled in send_alert)
    result = send_alert(district, req.severity, req.message, req.channel)

    alert = Alert(
        district_id=req.district_id,
        severity=req.severity,
        message=req.message,
        sent_via=req.channel,
        acknowledged=False,
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)

    return {"status": "sent", "alert_id": alert.id, "delivery": result}


@router.get("/history")
def get_alert_history(
    district_id: Optional[int] = None,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    q = db.query(Alert).order_by(Alert.sent_at.desc())
    if district_id:
        q = q.filter(Alert.district_id == district_id)
    alerts = q.limit(100).all()

    result = []
    for a in alerts:
        dist = db.query(District).filter(District.id == a.district_id).first()
        result.append({
            "id": a.id,
            "district_id": a.district_id,
            "district_name": dist.name if dist else "Unknown",
            "severity": a.severity,
            "message": a.message,
            "sent_via": a.sent_via,
            "sent_at": a.sent_at.isoformat(),
            "acknowledged": a.acknowledged,
        })
    return result


@router.patch("/{alert_id}/acknowledge")
def acknowledge_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.acknowledged = True
    db.commit()
    return {"status": "acknowledged"}
