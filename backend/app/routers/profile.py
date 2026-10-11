
from fastapi import APIRouter, Depends
from sqlmodel import Session

from app import mocks
from app.contracts import Profile
from app.db import get_session
from app.models import ProfileDB

router = APIRouter(prefix="/api")


def to_profile(row: ProfileDB) -> Profile:
    return Profile.model_validate({
        "patient": {
            "full_name": row.patient_full_name,
            "preferred_name": row.patient_preferred_name,
            "phone": row.patient_phone,
            "language": row.patient_language,
            "interests": row.patient_interests,
        },
        "caregiver": {
            "name": row.caregiver_name,
            "relationship": row.caregiver_relationship,
            "phone": row.caregiver_phone,
        },
        "sharing_consent": row.sharing_consent,
        "setup_complete": row.setup_complete,
    })


@router.get("/profile", response_model=Profile)
def get_profile(session: Session = Depends(get_session)):
    row = session.get(ProfileDB, 1)

    if row is None:
        return Profile.model_validate(mocks.load("profile"))

    return to_profile(row)


@router.put("/profile", response_model=Profile)
def put_profile(
    body: Profile,
    session: Session = Depends(get_session),
):
    row = session.get(ProfileDB, 1)

    if row is None:
        row = ProfileDB(id=1)

    row.patient_full_name = body.patient.full_name
    row.patient_preferred_name = body.patient.preferred_name
    row.patient_phone = body.patient.phone
    row.patient_language = body.patient.language
    row.patient_interests = body.patient.interests

    row.caregiver_name = body.caregiver.name
    row.caregiver_relationship = body.caregiver.relationship
    row.caregiver_phone = body.caregiver.phone

    row.sharing_consent = body.sharing_consent
    row.setup_complete = body.setup_complete

    session.add(row)
    session.commit()
    session.refresh(row)

    return to_profile(row)
