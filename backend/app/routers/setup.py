
import re
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from fastapi import File, UploadFile
from sqlmodel import Session, select

from app import ai, mocks
from app.contracts import (
    ConfirmRequest,
    ConfirmResponse,
    ExtractResponse,
    LanguagesResponse,
)
from app.db import get_session
from app.models import MedicationDB, PatientDB, ProfileDB

router = APIRouter(prefix="/api")


@router.post("/setup/extract", response_model=ExtractResponse)
async def extract(images: list[UploadFile] = File(...)):
    return ExtractResponse.model_validate(
        mocks.load("extracted_meds")
    )


@router.get("/languages", response_model=LanguagesResponse)
def languages():
    return LanguagesResponse.model_validate(
        mocks.load("languages")
    )


@router.post("/setup/confirm", response_model=ConfirmResponse)
def confirm(
    body: ConfirmRequest,
    session: Session = Depends(get_session),
):
    profile = session.get(ProfileDB, 1)

    if profile is None:
        raise HTTPException(
            status_code=400,
            detail="Create a profile before adding medications",
        )

    if body.language is not None:
        if not ai.is_supported(body.language):
            raise HTTPException(
                status_code=400,
                detail="Unsupported language",
            )
        profile.patient_language = body.language

    patient = session.get(PatientDB, 1)

    if patient is None:
        patient = PatientDB(id=1)
        session.add(patient)
        session.flush()

    existing = session.exec(
        select(MedicationDB).where(
            MedicationDB.patient_id == patient.id
        )
    ).all()

    by_name = {
        med.name.strip().casefold(): med
        for med in existing
    }

    for med in body.medications:
        key = med.name.strip().casefold()

        if not key:
            raise HTTPException(
                status_code=400,
                detail="Medication name cannot be empty",
            )

        row = by_name.get(key)

        if row is None:
            slug = re.sub(
                r"[^a-z0-9]+", "_", key
            ).strip("_")

            row = MedicationDB(
                id=f"med_{slug}_{uuid4().hex[:8]}",
                patient_id=patient.id,
            )

            by_name[key] = row

        row.name = med.name
        row.dose = med.dose
        row.times = med.times
        row.purpose = med.purpose
        row.look = med.look
        row.color = med.color
        row.high_risk = med.high_risk
        row.always_remind = med.always_remind

        session.add(row)

    session.add(profile)
    session.commit()

    return ConfirmResponse(
        ok=True,
        count=len(body.medications),
    )
