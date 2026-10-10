from fastapi import APIRouter

from app import mocks
from app.contracts import Dashboard

router = APIRouter(prefix="/api")


@router.get("/caregiver/dashboard", response_model=Dashboard)
def dashboard():
    return Dashboard.model_validate(mocks.load("dashboard"))
