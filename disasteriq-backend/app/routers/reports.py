from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Report, District, RiskScore
from app.auth import get_current_user
from app.services.report_generator import generate_report

router = APIRouter()


@router.post("/generate/{district_id}")
def create_report(
    district_id: int,
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    district = db.query(District).filter(District.id == district_id).first()
    if not district:
        raise HTTPException(status_code=404, detail="District not found")

    latest_risk = (
        db.query(RiskScore)
        .filter(RiskScore.district_id == district_id)
        .order_by(RiskScore.time.desc())
        .first()
    )

    content = generate_report(district, latest_risk)

    risk_level = "low"
    if latest_risk:
        r = latest_risk.composite_risk
        risk_level = "critical" if r > 0.8 else "high" if r > 0.6 else "medium" if r > 0.3 else "low"

    report = Report(
        district_id=district_id,
        content=content,
        district_name=district.name,
        risk_level=risk_level,
    )
    db.add(report)
    db.commit()
    db.refresh(report)

    return {
        "report_id": report.id,
        "district": district.name,
        "risk_level": risk_level,
        "content": content,
        "generated_at": report.generated_at.isoformat(),
    }


@router.get("/history")
def report_history(db: Session = Depends(get_db), _=Depends(get_current_user)):
    reports = db.query(Report).order_by(Report.generated_at.desc()).limit(50).all()
    return [
        {
            "id": r.id,
            "district_name": r.district_name,
            "risk_level": r.risk_level,
            "generated_at": r.generated_at.isoformat(),
            "content_preview": r.content[:300] + "..." if r.content and len(r.content) > 300 else r.content,
        }
        for r in reports
    ]
