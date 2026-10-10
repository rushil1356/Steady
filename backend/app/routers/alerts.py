from fastapi import APIRouter

from app import mocks
from app.contracts import AlertsLatest, OkResponse

router = APIRouter(prefix="/api")


@router.get("/alerts/latest", response_model=AlertsLatest)
def latest():
    return AlertsLatest.model_validate(mocks.load("alerts_latest"))


@router.post("/alerts/{alert_id}/handled", response_model=OkResponse)
def handled(alert_id: int):
    return OkResponse.model_validate(mocks.load("ok"))
