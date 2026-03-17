<div align="center">

# 🌊 CRISP / DisasterIQ
**Crisis Response Intelligence & Prediction System**

*Real-time AI that predicts disaster risk zones across India and auto-optimizes relief deployment — before lives are lost.*

---

</div>

## 📖 Overview

**CRISP** (also known as **DisasterIQ**) is a zero-latency disaster intelligence platform engineered for complex relief ecosystems. It fuses live meteorological feeds, satellite imagery, and multi-variable Machine Learning models into a single operational surface. The platform provides district officers, NGOs, and national disaster management coordinators the predictive clarity to act hours ahead of impact, maximizing resource utilization and reducing response times.

No dashboards built on yesterday's data. No guesswork in relief routing. Just actionable intelligence.

## ✨ Key Features

- **Real-Time Risk Prediction:** Utilizes XGBoost and LSTM time-series models to predict flood, heatwave, and cyclone risks on a rolling 72-hour window.
- **Relief Optimization Engine:** Employs Google OR-Tools to solve the Vehicle Routing Problem (VRP), minimizing travel time while maximizing coverage equity for relief trucks and boats.
- **Interactive Operational Dashboard:** Fully responsive interactive map using Mapbox GL JS with risk heatmaps, district choropleths, and live route renderings.
- **Automated AI Situational Reports:** Generates human-readable, actionable reports using Large Language Models (e.g., Claude) to assist field officers.
- **Multi-Channel Alert System:** Dispatches SMS/WhatsApp alerts for critical risks, including confidence-weighted suppression to prevent alert fatigue.

## 🏗️ Architecture & Tech Stack

DisasterIQ is structured as a monorepo containing a high-performance Next.js frontend and a scalable FastAPI backend.

### Frontend (`disasteriq-frontend/`)
- **Framework:** Next.js 14 (App Router)
- **Styling:** Tailwind CSS + shadcn/ui
- **Maps:** Mapbox GL JS
- **State Management:** Zustand
- **Real-time:** WebSockets

### Backend (`disasteriq-backend/`)
- **API Framework:** FastAPI (Python 3.11)
- **Database:** PostgreSQL + TimescaleDB (for time-series weather and risk scores)
- **ORM:** SQLAlchemy + Alembic
- **Task Queue & Caching:** Celery + Redis

### ML & Optimization Core
- **Risk Models:** XGBoost (Hackathon v1) & LSTM (Production v2)
- **Optimization:** Google OR-Tools (VRP Solver)
- **Data Integration:** OpenWeather, Google Earth Engine, IMD Historical Data

## 📂 Repository Structure

```
.
├── disasteriq-frontend/     # Next.js web application
├── disasteriq-backend/      # FastAPI server and ML pipeline
├── plan.md                  # Comprehensive Technical Roadmap & Schema 
├── start-frontend.ps1       # PowerShell script to start frontend dev server
└── start-backend.ps1        # PowerShell script to start backend dev server
```

For a detailed breakdown of the complete technical roadmap, database schema, and project phases, please refer to the [**`plan.md`**](plan.md) document.

## 🚀 Getting Started

Follow these steps to set up the local development environment.

### Prerequisites

- Node.js (v18+)
- Python (v3.11+)
- PostgreSQL (with TimescaleDB extension recommended)
- Redis

### 1. Starting the Backend

1. Navigate to the root directory.
2. Ensure you have the required environment variables in `.env` inside `disasteriq-backend/` (Refer to `plan.md` for the list).
3. Run the backend startup script:

```powershell
.\start-backend.ps1
```

*This script will automatically create a virtual environment, install dependencies from `requirements.txt`, and start the FastAPI server on `http://localhost:8000`.*

### 2. Starting the Frontend

1. Open a new terminal instance in the root directory.
2. Set your environment variables in `disasteriq-frontend/.env.local`:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:8000
   NEXT_PUBLIC_MAPBOX_TOKEN=your_mapbox_token_here
   ```
3. Run the frontend startup script:

```powershell
.\start-frontend.ps1
```

*This script will install Node modules if missing and start the Next.js development server on `http://localhost:3000`.*

## 🛣️ Roadmap

- **Phase 1-3:** ML Pipeline, Risk Models, and Route Optimization (VRP).
- **Phase 4-5:** Live Map Dashboard, Analytics Panel, Alert simulations, and AI reporting.
- **Phase 6:** End-to-end integration and polished demo scenarios.

*(See `plan.md` for a comprehensive execution roadmap)*

## 🤝 Contributing

We welcome contributions to DisasterIQ! If you're interested in making disaster response more efficient through software and AI, please review our open issues and submit a pull request.

## 📄 License

This project is licensed under the MIT License.
