from celery import Celery
from celery.schedules import crontab
from app.config import settings

celery_app = Celery(
    "disasteriq",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["app.tasks.weather_fetch", "app.tasks.risk_compute"],
)

celery_app.conf.beat_schedule = {
    "fetch-weather-every-15-min": {
        "task": "app.tasks.weather_fetch.fetch_all_weather",
        "schedule": crontab(minute="*/15"),
    },
    "compute-risk-every-15-min": {
        "task": "app.tasks.risk_compute.compute_all_risk",
        "schedule": crontab(minute="*/15"),
    },
}

celery_app.conf.timezone = "UTC"
