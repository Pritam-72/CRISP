import asyncio
import json
from contextlib import asynccontextmanager
from typing import List

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.config import settings
from app.database import engine, Base
from app.routers import auth, weather, risk, relief, alerts, reports

# Rate limiter
limiter = Limiter(key_func=get_remote_address)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create DB tables on startup (use Alembic for production)
    Base.metadata.create_all(bind=engine)
    # Seed demo data if tables are empty
    from app.seed import seed_if_empty
    seed_if_empty()
    yield


app = FastAPI(
    title="DisasterIQ API",
    description="AI Disaster Intelligence & Live Relief Allocation Platform for India",
    version="1.0.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://*.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(weather.router, prefix="/weather", tags=["weather"])
app.include_router(risk.router, prefix="/risk", tags=["risk"])
app.include_router(relief.router, prefix="/relief", tags=["relief"])
app.include_router(alerts.router, prefix="/alerts", tags=["alerts"])
app.include_router(reports.router, prefix="/reports", tags=["reports"])


@app.get("/health")
def health():
    return {"status": "ok", "service": "DisasterIQ API", "version": "1.0.0"}


# ─── WebSocket Manager ────────────────────────────────────────────────────────

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                pass


manager = ConnectionManager()


@app.websocket("/ws/risk-updates")
async def websocket_risk_updates(websocket: WebSocket):
    """Real-time risk score broadcast endpoint."""
    await manager.connect(websocket)
    try:
        while True:
            # Keep connection alive; real updates pushed via broadcast()
            await asyncio.sleep(30)
            await websocket.send_json({"type": "ping"})
    except WebSocketDisconnect:
        manager.disconnect(websocket)


def broadcast_risk_update(data: dict):
    """Called from Celery tasks after risk recomputation."""
    loop = asyncio.new_event_loop()
    loop.run_until_complete(manager.broadcast({"type": "risk_update", **data}))
