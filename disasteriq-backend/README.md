# DisasterIQ Backend

This directory contains the FastAPI backend for the CRISP (DisasterIQ) platform.

## Features
- **Real-Time Data Ingestion:** Fetches data from OpenWeatherMap, IMD, and other external APIs.
- **ML Risk Prediction:** Utilizes XGBoost and LSTM models to forecast disaster risk (flood, heatwave, cyclone) based on time-series geographic and weather data.
- **Relief Optimization:** Uses Google OR-Tools to solve the Vehicle Routing Problem (VRP) to optimize the dispatch of relief resources to district areas.
- **Alerting System:** Integrates with services like Twilio to send automated SMS/WhatsApp alerts for high-risk predictions.

## Tech Stack
- **Framework:** FastAPI
- **Database:** PostgreSQL (with TimescaleDB and PostGIS extensions)
- **ORM:** SQLAlchemy + Alembic
- **Machine Learning:** Scikit-learn, XGBoost, TensorFlow/Keras (LSTM)
- **Task Queue:** Celery + Redis

## Getting Started

1. Set up your virtual environment and install dependencies:
   ```bash
   python -m venv venv
   .\venv\Scripts\activate
   pip install -r requirements.txt
   ```
2. Copy `.env.example` to `.env` and fill in your specific credentials (e.g., Database URLs, API Keys).
3. Start the server (or use the root `start-backend.ps1`):
   ```bash
   uvicorn app.main:app --reload
   ```
