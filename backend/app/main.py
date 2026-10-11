"""Steady backend entry point. Owner: Samarth.

Run from the backend folder:  uvicorn app.main:app --reload --port 8000
API docs:                     http://localhost:8000/docs
"""

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.db import init_db
from app.routers import alerts, caregiver, checkins, demo, doses, meds, patient, profile, setup

app = FastAPI(title="Steady")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", settings.public_base_url],
    allow_methods=["*"],
    allow_headers=["*"],
)

STATIC_DIR = Path(__file__).resolve().parents[1] / "static"
STATIC_DIR.mkdir(exist_ok=True)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

# Every router is registered now, so nobody has to edit this file later.
for module in (profile, setup, patient, meds, doses, checkins, caregiver, alerts, demo):
    app.include_router(module.router)

# Create the SQLite tables and seed the demo schedule on first run.
init_db()
