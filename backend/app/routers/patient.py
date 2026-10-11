"""Patient app data: language, interests, and today's doses from the scheduling engine."""

from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from app import ai, care_store, clock
from app.contracts import InterestsBody, LanguageBody, NextDose, PatientRef, Thought, Today, TodayDose
from app.db import get_session
from app.engine.doses import ensure_today
from app.models import MedicationDB, ProfileDB

router = APIRouter(prefix="/api")


def _sync_profile_row(session: Session, **fields) -> None:
    row = session.get(ProfileDB, 1)
    if row is None:
        return
    for key, value in fields.items():
        setattr(row, key, value)
    session.add(row)
    session.commit()


@router.put("/patient/language", response_model=LanguageBody)
def put_language(body: LanguageBody, session: Session = Depends(get_session)):
    care_store.update_patient(language=body.language)
    _sync_profile_row(session, patient_language=body.language)
    return body


@router.put("/patient/interests", response_model=InterestsBody)
def put_interests(body: InterestsBody, session: Session = Depends(get_session)):
    care_store.update_patient(interests=body.interests)
    _sync_profile_row(session, patient_interests=body.interests)
    return body


@router.get("/patient/today", response_model=Today)
def today(session: Session = Depends(get_session)):
    now = clock.now()
    doses = ensure_today(session, now)
    meds = {m.id: m for m in session.exec(select(MedicationDB)).all()}
    patient = care_store.profile().patient
    if not doses or not meds:  # nothing scheduled yet: an empty day, not example data
        return Today(patient=PatientRef(name=patient.preferred_name, language=patient.language),
                     now=now.isoformat(timespec="seconds"), taken_count=0, total_count=0, doses=[])

    rows = []
    for d in sorted(doses, key=lambda d: d.scheduled_at):  # noqa: B023
        m = meds.get(d.medication_id)
        if m is None:
            continue
        rows.append(TodayDose(
            dose_id=d.id, med_id=m.id, name=m.name, dose=m.dose, time=d.scheduled_at.astimezone().strftime("%H:%M"),
            look=m.look, color=m.color, status=d.status, level=m.level, always_remind=m.always_remind,
        ))

    pending = [r for r in rows if r.status in ("due", "upcoming")]
    next_dose = None
    if pending:
        group = [r for r in pending if r.time == pending[0].time]
        label = " and ".join(r.look or r.name for r in group)
        next_dose = NextDose(time=pending[0].time, dose_ids=[r.dose_id for r in group], label=label[:1].upper() + label[1:])

    line = ai.write_opener(patient.interests, care_store.part_of_day(now))
    thought = Thought(text=line, because=(patient.interests or ["uplifting thoughts"])[0]) if line else None
    streak = max((m.streak for m in meds.values()), default=0)

    return Today(
        patient=PatientRef(name=patient.preferred_name, language=patient.language),
        now=now.isoformat(timespec="seconds"),
        taken_count=sum(r.status == "taken" for r in rows),
        total_count=len(rows),
        doses=rows,
        next=next_dose,
        thought=thought,
        streak_days=streak or None,
    )
