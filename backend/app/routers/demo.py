
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from app import ai, care_store, clock, voice
from app.contracts import (
    DemoClockRequest,
    DemoClockResponse,
    DueDose,
    OkResponse,
)
from app.db import get_session, sync_meds_to_care_store
from app.engine.doses import ensure_today
from app.models import DoseDB, MedicationDB, ProfileDB

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

    # Demo only: jumping the clock forward shouldn't make the patient look like they missed this morning's pills.
    # Doses already past their window when you jump are treated as taken on their own (unprompted).
    for dose in doses:
        if dose.status == "missed":
            dose.status, dose.prompted, dose.confirmed_at = "taken", False, dose.scheduled_at
            session.add(dose)
    session.commit()
    patient = care_store.profile().patient
    patient_name = patient.preferred_name
    language = patient.language

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
def two_weeks_later(session: Session = Depends(get_session)):
    """The faded state: habits formed, so most medicines are silent (level 3). High-risk ones always remind."""
    for med in session.exec(select(MedicationDB)).all():
        med.level, med.streak = (1, 0) if med.always_remind else (3, 14)
        session.add(med)
    session.commit()
    return OkResponse(ok=True)


@router.post("/demo/reset", response_model=OkResponse)
def reset_clock(session: Session = Depends(get_session)):
    """Back to the start: real clock, today's doses cleared, reminders back to level 1, no check-ins or alerts."""
    clock.reset()
    for dose in session.exec(select(DoseDB)).all():
        session.delete(dose)
    for med in session.exec(select(MedicationDB)).all():
        med.level, med.streak = 1, 0
        session.add(med)
    session.commit()
    care_store.reset()
    sync_meds_to_care_store(session)
    return OkResponse(ok=True)


@router.post("/demo/start-fresh", response_model=OkResponse)
def start_fresh(session: Session = Depends(get_session)):
    """Wipe everything (profile, medicines, doses, check-ins, alerts) to show setup from scratch on stage."""
    clock.reset()
    for row in [*session.exec(select(DoseDB)).all(), *session.exec(select(MedicationDB)).all()]:
        session.delete(row)
    profile = session.get(ProfileDB, 1)
    if profile is not None:
        session.delete(profile)
    session.commit()
    care_store.reset(full=True)
    session.add(ProfileDB(id=1))
    session.commit()
    return OkResponse(ok=True)


@router.post("/demo/load-sample", response_model=OkResponse)
def load_sample():
    """Demo only: fill the caregiver dashboard with the example history (14 days of check-ins, adherence charts)."""
    care_store.load_sample_history()
    return OkResponse(ok=True)
