from fastapi import APIRouter

from app import mocks
from app.contracts import Profile

router = APIRouter(prefix="/api")


@router.get("/profile", response_model=Profile)
def get_profile():
    return Profile.model_validate(mocks.load("profile"))


@router.put("/profile", response_model=Profile)
def put_profile(body: Profile):
    # Skeleton: echo what was sent. Real saving comes with the database.
    return body
