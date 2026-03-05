from app.tasks.celery_app import celery_app
from app.database import SessionLocal
from app.ml.risk_model import predict_all_districts


@celery_app.task(name="app.tasks.risk_compute.compute_all_risk")
def compute_all_risk():
    """Compute risk scores for all districts, triggered after weather update."""
    db = SessionLocal()
    try:
        count = predict_all_districts(db)
        print(f"✅ Risk computed for {count} districts")
    finally:
        db.close()
