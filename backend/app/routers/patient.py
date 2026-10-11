from fastapi import APIRouter

from app import care_store, mocks
from app.contracts import InterestsBody, LanguageBody, Today
from fastapi import Depends
from sqlmodel import Session

from app.db import get_session
from app.models import ProfileDB
router = APIRouter(prefix="/api")



@router.put("/patient/language", response_model=LanguageBody)
def put_language(
    body: LanguageBody,
    session: Session = Depends(get_session),
):
    profile = session.get(ProfileDB, 1)

    if profile is not None:
        profile.patient_language = body.language
        session.add(profile)
        session.commit()

    care_store.update_patient(language=body.language)

    return body



@router.put("/patient/interests", response_model=InterestsBody)
def put_interests(body: InterestsBody):
    care_store.update_patient(interests=body.interests)
    return body


@router.get("/patient/today", response_model=Today)
def today():
    return Today.model_validate(mocks.load("today"))
