"""Patient + caregiver profile, filled in by the caregiver at setup. Owner: Rushil."""

from fastapi import APIRouter, HTTPException

from app import care_store
from app.contracts import Profile

router = APIRouter(prefix="/api")


@router.get("/profile", response_model=Profile)
def get_profile():
    return care_store.profile()


@router.put("/profile", response_model=Profile)
def put_profile(body: Profile):
    # Alerts are silent, so the patient must have agreed to sharing before setup can finish.
    if body.setup_complete and not body.sharing_consent:
        raise HTTPException(400, "Setup can't finish until the patient agrees to share check-in notes.")
    return care_store.save_profile(body)
