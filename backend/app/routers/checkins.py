from fastapi import APIRouter

from app import mocks
from app.contracts import CheckinPrompt, CheckinResult

router = APIRouter(prefix="/api")


@router.get("/checkins/prompt", response_model=CheckinPrompt)
def prompt():
    return CheckinPrompt.model_validate(mocks.load("checkin_prompt"))


@router.post("/checkins", response_model=CheckinResult)
async def create_checkin():
    # Skeleton: ignores the audio / text body. The real pipeline comes later.
    return CheckinResult.model_validate(mocks.load("checkin_result"))
