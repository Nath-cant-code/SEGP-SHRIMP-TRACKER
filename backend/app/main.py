from contextlib import asynccontextmanager
import os
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db.database import Base, engine
import app.db.models  # noqa: F401 — registers models with SQLAlchemy
from app.routes.models import router as models_router
from app.routes.analyze import router as analyze_router
from app.routes.results import router as results_router

load_dotenv()

# ------------------------------------------------------------------
# Directories that must exist before requests arrive
# ------------------------------------------------------------------
UPLOAD_DIR = Path("uploads")
EXPORT_DIR = Path("exports")
OUTPUT_DIR = Path("outputs")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create tables and required folders on startup
    Base.metadata.create_all(bind=engine)
    UPLOAD_DIR.mkdir(exist_ok=True)
    EXPORT_DIR.mkdir(exist_ok=True)
    OUTPUT_DIR.mkdir(exist_ok=True)
    yield


app = FastAPI(title="SEGP Shrimp Tracker Backend", lifespan=lifespan)

# ------------------------------------------------------------------
# CORS — allow both localhost variants so Mac M1 / Windows both work
# ------------------------------------------------------------------
frontend_origin = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")

# Always include both localhost and 127.0.0.1 variants so the dev
# experience is smooth regardless of OS/browser quirks.
allowed_origins = [
    frontend_origin,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",   # Vite sometimes increments the port
    "http://127.0.0.1:5174",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(models_router)
app.include_router(analyze_router)
app.include_router(results_router)


@app.get("/health")
def health():
    return {"status": "ok"}