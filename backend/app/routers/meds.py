from fastapi import APIRouter

from app import mocks
from app.contracts import MedInfo

router = APIRouter(prefix="/api")


@router.get("/meds/{med_id}/info", response_model=MedInfo)
def med_info(med_id: str):
    return MedInfo.model_validate(mocks.load("med_info"))
