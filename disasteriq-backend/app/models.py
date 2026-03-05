from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, ForeignKey, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class District(Base):
    __tablename__ = "districts"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    state = Column(String(100), nullable=False)
    population = Column(Integer)
    lat = Column(Float, nullable=False)
    lng = Column(Float, nullable=False)
    elevation_m = Column(Float, default=0.0)
    historical_flood_freq = Column(Float, default=0.1)
    coastal_district = Column(Boolean, default=False)
    vulnerability_weight = Column(Float, default=1.0)  # equity multiplier

    # Relationships
    risk_scores = relationship("RiskScore", back_populates="district", cascade="all, delete")
    weather_snapshots = relationship("WeatherSnapshot", back_populates="district", cascade="all, delete")
    resources = relationship("Resource", back_populates="location_district_rel")
    alerts = relationship("Alert", back_populates="district_rel")
    users = relationship("User", back_populates="district_rel")


class RiskScore(Base):
    __tablename__ = "risk_scores"

    id = Column(Integer, primary_key=True, index=True)
    time = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    district_id = Column(Integer, ForeignKey("districts.id"), nullable=False, index=True)
    flood_risk = Column(Float, default=0.0)       # 0.0 to 1.0
    heatwave_risk = Column(Float, default=0.0)
    cyclone_risk = Column(Float, default=0.0)
    composite_risk = Column(Float, default=0.0)
    people_at_risk = Column(Integer, default=0)
    confidence = Column(Float, default=0.5)
    shap_explanation = Column(Text)               # JSON string of SHAP values

    district = relationship("District", back_populates="risk_scores")


class WeatherSnapshot(Base):
    __tablename__ = "weather_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    time = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    district_id = Column(Integer, ForeignKey("districts.id"), nullable=False, index=True)
    rainfall_mm = Column(Float, default=0.0)
    temperature_c = Column(Float, default=25.0)
    humidity_pct = Column(Float, default=60.0)
    wind_speed_kmh = Column(Float, default=10.0)
    river_level_m = Column(Float, default=1.0)
    source = Column(String(50), default="openweather")  # openweather / mock

    district = relationship("District", back_populates="weather_snapshots")


class Resource(Base):
    __tablename__ = "resources"

    id = Column(Integer, primary_key=True, index=True)
    type = Column(String(50), nullable=False)      # truck / boat / medical / food
    quantity = Column(Integer, default=0)
    location_district = Column(Integer, ForeignKey("districts.id"))
    status = Column(String(20), default="available")  # available / deployed / transit
    capacity = Column(Integer, default=50)         # units per vehicle

    location_district_rel = relationship("District", back_populates="resources")


class Allocation(Base):
    __tablename__ = "allocations"

    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    district_id = Column(Integer, ForeignKey("districts.id"))
    resource_type = Column(String(50))
    quantity_allocated = Column(Integer)
    route_polyline = Column(Text)                  # GeoJSON LineString string
    estimated_arrival_mins = Column(Integer)
    optimization_score = Column(Float)
    from_district_id = Column(Integer, ForeignKey("districts.id"))


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    district_id = Column(Integer, ForeignKey("districts.id"))
    severity = Column(String(20), default="medium")  # low / medium / high / critical
    message = Column(Text)
    sent_via = Column(String(50), default="dashboard")  # sms / whatsapp / dashboard
    sent_at = Column(DateTime(timezone=True), server_default=func.now())
    acknowledged = Column(Boolean, default=False)

    district_rel = relationship("District", back_populates="alerts")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(200), unique=True, nullable=False, index=True)
    hashed_password = Column(Text, nullable=False)
    role = Column(String(20), default="officer")   # admin / officer / ngo
    district_id = Column(Integer, ForeignKey("districts.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    district_rel = relationship("District", back_populates="users")


class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, index=True)
    district_id = Column(Integer, ForeignKey("districts.id"))
    generated_at = Column(DateTime(timezone=True), server_default=func.now())
    content = Column(Text)
    district_name = Column(String(100))
    risk_level = Column(String(20))
