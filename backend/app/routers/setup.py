
"""Medication setup, label extraction, and languages."""

import re
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, File, UploadFile
from fastapi.concurrency import run_in_threadpool
from sqlmodel import Session, select

from app import ai, care_store
from app.contracts import (
    ConfirmRequest,
    ConfirmResponse,
    ExtractResponse,
    LanguagesResponse,
)
from app.db import get_session, sync_meds_to_care_store
from app.models import MedicationDB, PatientDB, ProfileDB

router = APIRouter(prefix="/api")


@router.post("/setup/extract", response_model=ExtractResponse)
async def extract(images: list[UploadFile] = File(...)):
    photos = [await image.read() for image in images[:6]]

    return ExtractResponse(
        medications=await run_in_threadpool(
            ai.extract_schedule, photos
        )
    )


@router.get("/languages", response_model=LanguagesResponse)
def languages():
    return LanguagesResponse(
        languages=ai.list_languages()
    )


@router.post("/setup/confirm", response_model=ConfirmResponse)
def confirm(
    body: ConfirmRequest,
    session: Session = Depends(get_session),
):
    profile = session.get(ProfileDB, 1)

    if profile is None:  # seed_if_empty normally creates it; never block the caregiver here
        profile = ProfileDB(id=1)

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

    if body.language is not None:
        care_store.update_patient(language=body.language)
    sync_meds_to_care_store(session)  # check-ins and "Know more" now know the new medicines

    return ConfirmResponse(
        ok=True,
        count=len(body.medications),
    )
