from fastapi import APIRouter

from app import care_store, mocks
from app.contracts import InterestsBody, LanguageBody, Today

router = APIRouter(prefix="/api")


@router.put("/patient/language", response_model=LanguageBody)
def put_language(body: LanguageBody):
    care_store.update_patient(language=body.language)  # Rushil: the profile is the one place language lives
    return body


@router.put("/patient/interests", response_model=InterestsBody)
def put_interests(body: InterestsBody):
    care_store.update_patient(interests=body.interests)
    return body


@router.get("/patient/today", response_model=Today)
def today():
    return Today.model_validate(mocks.load("today"))
