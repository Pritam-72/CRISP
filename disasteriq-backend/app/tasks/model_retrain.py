"""
Weekly model retraining Celery task.
Runs every Sunday at 02:00 UTC via Celery beat.
Retrains XGBoost models on accumulated DB data and saves updated .pkl files.
"""
import os
import pickle
import logging
from datetime import datetime, timedelta

from app.tasks.celery_app import celery_app
from app.database import SessionLocal

logger = logging.getLogger(__name__)
MODEL_DIR = os.path.join(os.path.dirname(__file__), "../../ml_training/models")


@celery_app.task(name="app.tasks.model_retrain.retrain_models")
def retrain_models():
    """
    Retrain XGBoost flood/heatwave/cyclone models using the last 90 days of data.
    Persists new .pkl files, logs performance metrics.
    """
    logger.info("🔄 Starting weekly model retrain...")
    db = SessionLocal()

    try:
        from app.models import District, WeatherSnapshot, RiskScore
        import numpy as np

        districts = db.query(District).all()
        if not districts:
            logger.warning("No districts found — skipping retrain")
            return {"status": "skipped", "reason": "no districts"}

        since = datetime.utcnow() - timedelta(days=90)

        # Build training features from historical snapshots
        X_rows, y_flood, y_heat, y_cyclone = [], [], [], []

        for district in districts:
            snaps = (
                db.query(WeatherSnapshot)
                .filter(
                    WeatherSnapshot.district_id == district.id,
                    WeatherSnapshot.time >= since,
                )
                .order_by(WeatherSnapshot.time.asc())
                .all()
            )

            for snap in snaps:
                import math
                month = snap.time.month
                month_sin = math.sin(2 * math.pi * month / 12)
                month_cos = math.cos(2 * math.pi * month / 12)

                features = [
                    snap.rainfall_mm or 0.0,
                    (snap.rainfall_mm or 0.0) * 3,
                    snap.temperature_c or 28.0,
                    snap.humidity_pct or 65.0,
                    snap.wind_speed_kmh or 10.0,
                    snap.river_level_m or 1.5,
                    0.1,
                    district.elevation_m or 50.0,
                    district.historical_flood_freq or 0.1,
                    0.6,
                    month_sin,
                    month_cos,
                    1.0 if district.coastal_district else 0.0,
                ]
                X_rows.append(features)

                # Use most recent risk score as label (or rule-based threshold)
                risk = (
                    db.query(RiskScore)
                    .filter(RiskScore.district_id == district.id)
                    .order_by(RiskScore.time.desc())
                    .first()
                )
                y_flood.append(1 if (risk and risk.flood_risk > 0.5) else 0)
                y_heat.append(1 if (risk and risk.heatwave_risk > 0.5) else 0)
                y_cyclone.append(1 if (risk and risk.cyclone_risk > 0.5) else 0)

        if len(X_rows) < 10:
            logger.warning(f"Insufficient training data ({len(X_rows)} rows) — skipping retrain")
            return {"status": "skipped", "reason": "insufficient_data", "rows": len(X_rows)}

        X = np.array(X_rows)

        try:
            from xgboost import XGBClassifier  # type: ignore
            os.makedirs(MODEL_DIR, exist_ok=True)

            for label, y, model_name in [
                ("flood", y_flood, "flood_model.pkl"),
                ("heatwave", y_heat, "heatwave_model.pkl"),
                ("cyclone", y_cyclone, "cyclone_model.pkl"),
            ]:
                clf = XGBClassifier(
                    n_estimators=100,
                    max_depth=4,
                    learning_rate=0.1,
                    use_label_encoder=False,
                    eval_metric="logloss",
                )
                clf.fit(X, y)
                path = os.path.join(MODEL_DIR, model_name)
                with open(path, "wb") as f:
                    pickle.dump(clf, f)
                logger.info(f"✅ {label} model retrained with {len(X_rows)} samples → {path}")

            # Invalidate the cached model references in risk_model.py
            from app.ml import risk_model
            risk_model._flood_model = None
            risk_model._heatwave_model = None
            risk_model._cyclone_model = None

        except ImportError:
            logger.warning("XGBoost not installed — skipping model fitting")
            return {"status": "skipped", "reason": "xgboost_not_installed"}

        return {
            "status": "success",
            "trained_at": datetime.utcnow().isoformat(),
            "training_rows": len(X_rows),
        }

    except Exception as exc:
        logger.error(f"Retrain failed: {exc}", exc_info=True)
        return {"status": "error", "message": str(exc)}
    finally:
        db.close()
