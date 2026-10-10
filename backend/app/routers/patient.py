from fastapi import APIRouter

from app import mocks
from app.contracts import InterestsBody, LanguageBody, Today

router = APIRouter(prefix="/api")


@router.put("/patient/language", response_model=LanguageBody)
def put_language(body: LanguageBody):
    return body


@router.put("/patient/interests", response_model=InterestsBody)
def put_interests(body: InterestsBody):
    return body


@router.get("/patient/today", response_model=Today)
def today():
    return Today.model_validate(mocks.load("today"))
