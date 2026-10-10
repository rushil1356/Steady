from fastapi import APIRouter

from app import mocks
from app.contracts import DemoClockRequest, DemoClockResponse, OkResponse

router = APIRouter(prefix="/api")


@router.post("/demo/clock", response_model=DemoClockResponse)
def set_clock(body: DemoClockRequest):
    return DemoClockResponse.model_validate(mocks.load("demo_clock"))


@router.post("/demo/two-weeks-later", response_model=OkResponse)
def two_weeks_later():
    return OkResponse.model_validate(mocks.load("ok"))


@router.post("/demo/reset", response_model=OkResponse)
def reset():
    return OkResponse.model_validate(mocks.load("ok"))
