
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app import ai, clock, mocks, voice
from app.contracts import (
    DemoClockRequest,
    DemoClockResponse,
    DueDose,
    OkResponse,
)
from app.db import get_session
from app.engine.doses import ensure_today
from app.models import MedicationDB, ProfileDB

router = APIRouter(prefix="/api")


@router.post("/demo/clock", response_model=DemoClockResponse)
def set_clock(
    body: DemoClockRequest,
    session: Session = Depends(get_session),
):
    try:
        current = clock.set_time(body.time)
    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        )

    doses = ensure_today(session, current)
    profile = session.get(ProfileDB, 1)

    patient_name = (
        profile.patient_preferred_name if profile else ""
    )
    language = (
        profile.patient_language if profile else "en"
    )

    due = []

    for dose in doses:
        if dose.status != "due":
            continue

        med = session.get(MedicationDB, dose.medication_id)

        if med is None:
            continue

        if med.level > 2 and not med.always_remind:
            continue

        level = 1 if med.always_remind else med.level

        reminder_text = ai.reminder_text(
            med,
            level,
            patient_name=patient_name,
        )

        spoken = voice.say(reminder_text, language)

        due.append(
            DueDose(
                dose_id=dose.id,
                med_id=med.id,
                name=med.name,
                dose=med.dose,
                purpose=med.purpose,
                look=med.look,
                color=med.color,
                level=level,
                always_remind=med.always_remind,
                reminder=spoken,
            )
        )

    return DemoClockResponse(
        now=current.isoformat(),
        due=due,
    )


@router.post("/demo/two-weeks-later", response_model=OkResponse)
def two_weeks_later():
    return OkResponse.model_validate(mocks.load("ok"))


@router.post("/demo/reset", response_model=OkResponse)
def reset_clock():
    clock.reset()
    return OkResponse(ok=True)
