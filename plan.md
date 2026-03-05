# DISASTERIQ — AI Disaster Intelligence & Live Relief Allocation Platform
### Technical Roadmap & Build Plan

---

> **One-line pitch:** Real-time AI that predicts disaster risk zones across India and auto-optimizes relief deployment — before lives are lost.

---

## Website Description

**DisasterIQ** is a zero-latency disaster intelligence platform engineered for India's complex relief ecosystem. It fuses live meteorological feeds, satellite imagery, and multi-variable ML models into a single operational surface — giving district officers, NGOs, and NDMA coordinators the predictive clarity to act hours ahead of impact. No dashboards built on yesterday's data. No guesswork in relief routing. Just signal.

*Stack: Next.js · FastAPI · XGBoost/LSTM · Mapbox GL · PostgreSQL · OR-Tools · OpenWeather · Google Earth Engine*

---

## The Problem (Why This Exists)

India faces 2–3 major disasters per month. The failure isn't prediction — it's **response lag**:

- Relief trucks routed inefficiently across flooded roads
- District officers get data hours late, through WhatsApp forwards
- No centralized risk scoring = reactive instead of proactive deployment
- NGO resources duplicated in one zone, zero in another

**DisasterIQ closes this gap with a predict-then-optimize loop.**

---

## Critical Improvements Over the Original Plan

| Original Plan | What Needs to Change | Why |
|---|---|---|
| XGBoost on static features | Add rolling 6-hour weather windows as features | Captures rapid onset floods |
| Simple LP optimization | Use multi-objective optimization (time + cost + equity) | Real relief ops prioritize equity, not just speed |
| Simulated truck tracking | Use OSRM (open-source routing) for real road-network routing | Mapbox routing is expensive at scale |
| OpenAI for reports | Fine-tune a smaller model or use Claude API with structured prompts | More controllable, cheaper, faster |
| PostgreSQL only | Add TimescaleDB extension for time-series weather storage | Native time-series queries are 10–100x faster |
| WhatsApp via Twilio | Add SMS fallback (India's rural net is patchy) | Field officers often have 2G only |
| No auth detail | Implement RBAC with 3 roles: Admin / District Officer / NGO | Needed for real deployment |
| No offline mode | Add PWA support + local data caching | Critical for disaster zones with poor connectivity |
| Mapbox heatmap only | Add choropleth district-level map + animated flood spread sim | Better for non-technical govt users |

---

## Tech Stack (Finalized)

### Frontend
- **Framework:** Next.js 14 (App Router)
- **Styling:** Tailwind CSS + shadcn/ui
- **Maps:** Mapbox GL JS (heatmap, choropleth, route layer)
- **Charts:** Recharts (risk trends, resource utilization)
- **State:** Zustand
- **Real-time:** WebSockets via FastAPI

### Backend
- **API:** FastAPI (Python 3.11)
- **Task Queue:** Celery + Redis
- **Auth:** JWT + role-based middleware
- **ORM:** SQLAlchemy + Alembic migrations
- **Caching:** Redis (15-min weather cache)

### Database
- **Primary:** PostgreSQL + TimescaleDB extension
- **Schema:** Districts, RiskScores (time-series), Resources, Alerts, Users

### ML / Optimization
- **Risk Model:** XGBoost (v1) → LSTM (v2)
- **Optimization:** Google OR-Tools (Vehicle Routing Problem)
- **Training Data:** IMD historical + NDMA disaster records + OpenWeather
- **Retraining:** Weekly automated pipeline via Celery beat

### External APIs
- OpenWeatherMap (real-time + 5-day forecast)
- India Meteorological Department (HTTPS scrape or API)
- Google Earth Engine (daily satellite layer)
- NASA FIRMS (fire/heat anomaly)
- OSRM (road-network routing, self-hosted)
- Claude/OpenAI API (report generation)
- Twilio (SMS alerts)

---

## Database Schema

```sql
-- Districts master table
CREATE TABLE districts (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100),
  state VARCHAR(100),
  population INTEGER,
  lat DECIMAL(9,6),
  lng DECIMAL(9,6),
  elevation_m FLOAT,
  historical_flood_freq FLOAT  -- disasters per year avg
);

-- Time-series risk scores (TimescaleDB hypertable)
CREATE TABLE risk_scores (
  time TIMESTAMPTZ NOT NULL,
  district_id INTEGER REFERENCES districts(id),
  flood_risk FLOAT,         -- 0.0 to 1.0
  heatwave_risk FLOAT,
  cyclone_risk FLOAT,
  composite_risk FLOAT,
  people_at_risk INTEGER,
  confidence FLOAT
);
SELECT create_hypertable('risk_scores', 'time');

-- Weather snapshots
CREATE TABLE weather_snapshots (
  time TIMESTAMPTZ NOT NULL,
  district_id INTEGER REFERENCES districts(id),
  rainfall_mm FLOAT,
  temperature_c FLOAT,
  humidity_pct FLOAT,
  wind_speed_kmh FLOAT,
  river_level_m FLOAT
);

-- Relief resources
CREATE TABLE resources (
  id SERIAL PRIMARY KEY,
  type VARCHAR(50),          -- truck / boat / medical / food
  quantity INTEGER,
  location_district INTEGER REFERENCES districts(id),
  status VARCHAR(20)         -- available / deployed / transit
);

-- Allocation plans
CREATE TABLE allocations (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  district_id INTEGER REFERENCES districts(id),
  resource_type VARCHAR(50),
  quantity_allocated INTEGER,
  route_polyline TEXT,
  estimated_arrival_mins INTEGER,
  optimization_score FLOAT
);

-- Alerts log
CREATE TABLE alerts (
  id SERIAL PRIMARY KEY,
  district_id INTEGER REFERENCES districts(id),
  severity VARCHAR(20),      -- low / medium / high / critical
  message TEXT,
  sent_via VARCHAR(50),      -- sms / whatsapp / dashboard
  sent_at TIMESTAMPTZ,
  acknowledged BOOLEAN DEFAULT FALSE
);

-- Users (RBAC)
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(200) UNIQUE,
  hashed_password TEXT,
  role VARCHAR(20),          -- admin / officer / ngo
  district_id INTEGER REFERENCES districts(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## FastAPI Project Structure

```
disasteriq-backend/
├── app/
│   ├── main.py                  # FastAPI app init, CORS, routers
│   ├── config.py                # env vars, API keys
│   ├── database.py              # SQLAlchemy engine + session
│   │
│   ├── routers/
│   │   ├── weather.py           # GET /weather-data, GET /forecast
│   │   ├── risk.py              # POST /predict-risk, GET /district-risk/{id}
│   │   ├── relief.py            # POST /optimize-relief, GET /allocations
│   │   ├── alerts.py            # POST /send-alert, GET /alerts
│   │   └── auth.py              # POST /login, POST /register
│   │
│   ├── ml/
│   │   ├── risk_model.py        # XGBoost load + predict
│   │   ├── lstm_model.py        # LSTM time-series predict
│   │   ├── optimizer.py         # OR-Tools VRP solver
│   │   └── feature_engineering.py
│   │
│   ├── services/
│   │   ├── openweather.py       # API fetch + parse
│   │   ├── earth_engine.py      # GEE satellite fetch
│   │   ├── imd_scraper.py       # IMD data extraction
│   │   ├── report_generator.py  # Claude/GPT report call
│   │   └── alert_sender.py      # Twilio SMS/WhatsApp
│   │
│   ├── tasks/
│   │   ├── celery_app.py        # Celery init
│   │   ├── weather_fetch.py     # Every 15 min
│   │   ├── risk_compute.py      # Every 15 min post-weather
│   │   └── model_retrain.py     # Weekly
│   │
│   └── models/                  # SQLAlchemy ORM models
│       ├── district.py
│       ├── risk_score.py
│       ├── resource.py
│       └── user.py
│
├── ml_training/
│   ├── train_xgboost.py
│   ├── train_lstm.py
│   ├── data_prep.py
│   └── evaluate.py
│
├── alembic/                     # DB migrations
├── tests/
├── docker-compose.yml
├── Dockerfile
└── requirements.txt
```

---

## Next.js Frontend Structure

```
disasteriq-frontend/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                 # Landing / login redirect
│   ├── dashboard/
│   │   ├── page.tsx             # Main map dashboard
│   │   ├── risk/page.tsx        # District risk deep-dive
│   │   ├── relief/page.tsx      # Allocation simulator
│   │   ├── alerts/page.tsx      # Alert history + send
│   │   └── reports/page.tsx     # AI-generated reports
│   └── auth/
│       └── login/page.tsx
│
├── components/
│   ├── map/
│   │   ├── DisasterMap.tsx      # Mapbox GL main component
│   │   ├── HeatmapLayer.tsx
│   │   ├── DistrictLayer.tsx
│   │   └── RouteLayer.tsx
│   ├── panels/
│   │   ├── RiskInsightPanel.tsx
│   │   ├── AllocationPanel.tsx
│   │   └── AlertsPanel.tsx
│   ├── charts/
│   │   ├── RiskTrendChart.tsx
│   │   └── ResourceUtilChart.tsx
│   └── ui/                      # shadcn components
│
├── lib/
│   ├── api.ts                   # Axios client + interceptors
│   ├── websocket.ts             # Real-time connection
│   └── store.ts                 # Zustand global state
│
└── public/
    └── india-districts.geojson  # District boundary data
```

---

## ML Model Details

### A. XGBoost Risk Predictor (Hackathon v1)

**Features:**
```python
features = [
    'rainfall_mm_24h',
    'rainfall_mm_72h',        # rolling sum
    'temperature_c',
    'humidity_pct',
    'wind_speed_kmh',
    'river_level_m',
    'river_level_delta_6h',   # rate of change (key feature)
    'elevation_m',
    'historical_flood_freq',
    'ndvi_score',             # from GEE satellite
    'month_sin',              # cyclical encoding
    'month_cos',
    'coastal_district',       # binary flag
]

# Output: flood_risk, heatwave_risk, cyclone_risk (3 separate models)
```

**Training Data Sources:**
- NDMA disaster event database (2001–2024)
- IMD historical rainfall records
- CWC (Central Water Commission) river level archives
- Bhoonidhi portal (elevation, land use)

### B. LSTM Time-Series Model (v2 — post-hackathon)

**Input:** 72-hour sliding window of weather features  
**Architecture:** 2-layer LSTM → Dense(64) → Dropout(0.3) → Dense(3) sigmoid output  
**Advantage:** Captures rapid rainfall escalation patterns missed by XGBoost

### C. Relief Optimization (OR-Tools VRP)

```python
# Problem setup
# - N districts with demand (people at risk)
# - M resource depots with supply
# - Objective: minimize total weighted travel time
#   while maximizing coverage equity

# Constraints:
# - Vehicle capacity (trucks: 50 kits, boats: 20)
# - Max route duration: 8 hours
# - Road accessibility (flood-blocked roads removed)
# - Priority weighting: composite_risk × population

# Output: assignment matrix [depot → district] + route polylines
```

---

## Phased Execution Roadmap

### Phase 0 — Setup (Hours 0–3)
- [ ] Init FastAPI project + Docker Compose (Postgres + Redis)
- [ ] Init Next.js project + Tailwind + shadcn
- [ ] Set up environment variables + API keys
- [ ] Create DB schema + run Alembic migrations
- [ ] Seed 50 Indian districts with static data

### Phase 1 — Data Pipeline (Hours 3–8)
- [ ] Integrate OpenWeatherMap API → store weather snapshots
- [ ] Set up Celery beat for 15-min fetch task
- [ ] Implement Redis caching layer
- [ ] Add IMD data scraper (or use mock data as fallback)
- [ ] Integrate Google Earth Engine (NDVI + flood extent)

### Phase 2 — ML Core (Hours 8–16)
- [ ] Feature engineering pipeline from DB → model input
- [ ] Train XGBoost on synthetic + historical dataset
- [ ] Build `/predict-risk` endpoint (batch predict all districts)
- [ ] Store risk scores to TimescaleDB
- [ ] Add confidence intervals to output

### Phase 3 — Optimization Engine (Hours 16–22)
- [ ] Define resource inventory (hardcoded for demo, dynamic later)
- [ ] Implement OR-Tools VRP solver
- [ ] Build `/optimize-relief` endpoint
- [ ] Integrate OSRM for actual road-network routing
- [ ] Return route GeoJSON for map rendering

### Phase 4 — Frontend (Hours 12–30, parallel)
- [ ] Mapbox GL setup + India district GeoJSON base layer
- [ ] Heatmap layer driven by risk score API
- [ ] District click → Risk Insight Panel
- [ ] Allocation Simulator panel (input resources → get plan)
- [ ] Real-time WebSocket for live risk score updates
- [ ] Digital Twin slider (simulate rainfall → watch heatmap shift)

### Phase 5 — AI Features (Hours 28–36)
- [ ] Auto-generated disaster reports via Claude API
- [ ] WhatsApp/SMS alert simulation via Twilio
- [ ] AI chatbot sidebar (RAG over district data)
- [ ] 72-hour predictive risk forecast display

### Phase 6 — Polish & Demo Prep (Hours 36–48)
- [ ] Loading states, error boundaries, skeleton UI
- [ ] Demo storyline: Odisha cyclone scenario walkthrough
- [ ] Role-based demo accounts (Admin / Officer / NGO)
- [ ] Performance audit (Lighthouse > 85)
- [ ] Pitch deck alignment — screenshots + flow match

---

## What's Missing from the Original Plan (Add These)

### 1. Equity Metric in Optimization
The original plan optimizes for speed/cost. Real disaster response must also optimize for **equity** — remote low-population districts get ignored otherwise. Add a `vulnerability_weight` multiplier per district (elderly population ratio, road access score).

### 2. Data Fallback Strategy
When APIs are down (very common during actual disasters), the system needs:
- Last-known-good cache in Redis
- Offline mode with stale data warning in UI
- Mock data mode for demo environments

### 3. Audit Log
Every allocation decision must be logged with rationale for post-disaster review. Judges and real govt partners will ask "how do you explain the AI's decision?" — build an explainability output from XGBoost SHAP values.

### 4. District GeoJSON
The plan doesn't mention where to get India district boundaries. Use: `datameet/maps` GitHub repo (India district GeoJSON, free, accurate).

### 5. Model Validation
Include a confusion matrix or PR-AUC score in the demo. Shows judges the model is real, not fake. Use 2023 Kerala floods as test set.

### 6. Progressive Web App (PWA)
Add `next-pwa` so field officers can install on mobile and use with degraded connectivity. Critical for real-world viability pitch.

### 7. Cost Estimate Slide
Add a "₹X crore saved per disaster" calculation to the pitch. Judges respond to impact quantification.

---

## ⚡ Additional Improvements (Analysis Layer)

### 8. Missing: Confidence-Weighted Alert Suppression
Currently alerts fire on any threshold breach. Add a **confidence gate** — only send public alerts when `confidence score > 0.75` AND `composite_risk > 0.65`. Reduces alert fatigue which kills trust in the system fast.

### 9. Missing: Multi-Disaster Concurrent Handling
The schema handles one disaster type per district at a time. India regularly sees simultaneous events (cyclone + flood in adjacent districts). Add a `event_type[]` array column to `risk_scores` and update the VRP solver to handle multi-hazard demand vectors.

### 10. Missing: Historical Scenario Replay
Add a "replay past disaster" mode using stored TimescaleDB data. This gives:
- Judges a provable demo (real data from 2023 Bihar floods)
- A training tool for officers ("what would DisasterIQ have predicted?")
- A model validation surface without needing live data

### 11. Missing: Rate Limiting & API Abuse Prevention
No mention of rate limiting on the FastAPI routes. With Twilio SMS integration, an unsecured `/alerts/send` endpoint is a financial risk. Add `slowapi` (FastAPI rate limiter) + role-guard middleware from day one.

### 12. Missing: geospatial Index on `districts` Table
For map-layer queries (find all districts within bounding box), a plain lat/lng lookup will be slow at scale. Add `PostGIS` extension + spatial index:
```sql
ALTER TABLE districts ADD COLUMN geom GEOMETRY(Point, 4326);
CREATE INDEX idx_districts_geom ON districts USING GIST(geom);
```

### 13. Weak Point: OSRM Self-Hosting Complexity
OSRM requires preprocessing India's OSM road network (~8GB). For hackathon, fall back to **straight-line haversine distance** with a `road_factor` multiplier (typically 1.3–1.5x for India roads). Switch to OSRM post-demo. Document this as a known simplification.

### 14. Missing: `.env.example` and Secrets Hygiene
No mention of a `.env.example` file. With 7+ API keys (OpenWeather, GEE, Twilio, Mapbox, Claude, DB, Redis), secret sprawl is a real risk. Create `.env.example` with all keys documented but blank, and add `dotenv-vault` or note to use Railway's secret manager.

---

## API Endpoint Reference

```
AUTH
POST   /auth/login                    → JWT token
POST   /auth/register                 → create user (admin only)

WEATHER
GET    /weather/current/{district_id} → latest weather snapshot
GET    /weather/forecast/{district_id}→ 5-day forecast
GET    /weather/all                   → all districts latest

RISK
POST   /risk/predict                  → run prediction (all districts)
GET    /risk/district/{district_id}   → latest risk score + history
GET    /risk/heatmap                  → all districts risk for map layer
GET    /risk/forecast/{district_id}   → 72-hour predicted risk

RELIEF
POST   /relief/optimize               → run VRP optimization
GET    /relief/allocations            → current active allocations
POST   /relief/resources              → update resource inventory
GET    /relief/resources              → get resource inventory

ALERTS
POST   /alerts/send                   → trigger alert (SMS/WhatsApp)
GET    /alerts/history                → alert log
PATCH  /alerts/{id}/acknowledge       → mark acknowledged

REPORTS
POST   /reports/generate/{district_id}→ AI-generated situation report
GET    /reports/history               → past reports

WS
WS     /ws/risk-updates               → real-time risk score stream
```

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Google Earth Engine quota limits | Cache daily satellite layer; use NASA FIRMS as backup |
| OpenWeather free tier rate limits | 1 API call per district per 15 min = ~3K calls/day; within free tier |
| OR-Tools solve time > 10s for large inputs | Cap at 50 districts per solve; add async job with polling |
| ML model not trained in time | Pre-train on synthetic data; use rule-based fallback (rainfall > threshold → high risk) |
| Mapbox token exposure | Use server-side token rotation + domain restriction |
| Demo internet failure | Pre-record 3-min video of full flow as backup |
| Twilio SMS endpoint abuse | Add `slowapi` rate limiter + role guard on `/alerts/send` |
| OSRM self-hosting too slow | Use haversine + road_factor multiplier for hackathon demo |

---

## Scalability Architecture (For Pitch)

```
Current (Hackathon):          Production Scale:
─────────────────             ─────────────────────────
Single FastAPI server   →     FastAPI on Kubernetes (GKE)
SQLite/Local PG         →     Cloud SQL + TimescaleDB Cloud
Local Celery            →     Cloud Tasks / Pub-Sub
Static ML models        →     Vertex AI Model Registry
Manual API calls        →     Apache Kafka event stream
```

**Key pitch line:** *"The same prediction engine running on a laptop today can scale to all 766 districts of India with a Kubernetes deployment and zero code changes."*

---

## Demo Scenario Script

**Scenario: Cyclone Biparjoy — Gujarat Coast (Use real 2023 data)**

1. Show dashboard — Gujarat coastal districts lighting up amber/red
2. Click Kutch district → Risk panel shows 84% flood risk, 2.1M at risk
3. AI report auto-generates: "Immediate evacuation advisory recommended..."
4. Open Allocation Simulator → Input: 30 trucks, 15 boats, 50 medical kits
5. Run optimization → Show route map with truck assignments
6. Trigger alert → Show SMS simulation to district officer
7. Pull Digital Twin slider — increase rainfall by 20% — watch Bhuj turn critical
8. Close: "This is what 6-hour advance warning looks like at scale."

---

## Environment Variables Required

```env
# Backend
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
OPENWEATHER_API_KEY=
GEE_SERVICE_ACCOUNT_JSON=
NASA_FIRMS_API_KEY=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=
CLAUDE_API_KEY=
JWT_SECRET=
JWT_ALGORITHM=HS256

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_MAPBOX_TOKEN=
NEXT_PUBLIC_WS_URL=ws://localhost:8000
```

---

*Built for India. Designed to deploy. Engineered to save lives.*
