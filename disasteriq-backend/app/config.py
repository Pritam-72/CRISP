from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # App
    APP_ENV: str = "demo"
    DEBUG: bool = True

    # Database
    DATABASE_URL: str = "postgresql://disasteriq:disasteriq_pass@localhost:5432/disasteriq_db"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # JWT
    JWT_SECRET: str = "demo_secret_change_in_production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 1440

    # External APIs (leave blank to use mock data)
    OPENWEATHER_API_KEY: str = ""
    CLAUDE_API_KEY: str = ""

    # Twilio (leave blank to simulate)
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_FROM_NUMBER: str = ""

    @property
    def is_demo(self) -> bool:
        return self.APP_ENV == "demo"

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
