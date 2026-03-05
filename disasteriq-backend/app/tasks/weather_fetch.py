from app.tasks.celery_app import celery_app
from app.database import SessionLocal
from app.models import District
from app.services.openweather import fetch_weather_for_district


@celery_app.task(name="app.tasks.weather_fetch.fetch_all_weather")
def fetch_all_weather():
    """Fetch weather for all districts every 15 minutes."""
    db = SessionLocal()
    try:
        districts = db.query(District).all()
        for district in districts:
            try:
                fetch_weather_for_district(district, db)
            except Exception as e:
                print(f"⚠️  Weather fetch failed for {district.name}: {e}")
        print(f"✅ Weather updated for {len(districts)} districts")
    finally:
        db.close()
