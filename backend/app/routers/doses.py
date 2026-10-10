from fastapi import APIRouter

from app import mocks
from app.contracts import DoseConfirmRequest, DoseConfirmResponse

router = APIRouter(prefix="/api")


@router.post("/doses/{dose_id}/confirm", response_model=DoseConfirmResponse)
def confirm_dose(dose_id: int, body: DoseConfirmRequest):
    return DoseConfirmResponse.model_validate(mocks.load("dose_confirm"))
