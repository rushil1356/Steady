
from sqlmodel import Session, select

from app.models import MedicationDB, PatientDB, DoseDB, AlertDB
from datetime import timedelta
from app import clock

def confirm_dose(
    session: Session,
    medication: MedicationDB,
    prompted: bool,
):
    patient = session.get(PatientDB, medication.patient_id)

    if medication.always_remind or (
        patient is not None and not patient.fading_enabled
    ):
        medication.level = 1
        medication.streak = 0

    elif prompted:
        medication.streak = 0

    else:
        medication.streak += 1

        if medication.streak >= 5:
            medication.level = min(medication.level + 1, 4)
            medication.streak = 0

    session.add(medication)
    session.commit()
    session.refresh(medication)

    return medication


def independence(session: Session, medication_id: str):
    doses = session.exec(
        select(DoseDB)
        .where(DoseDB.medication_id == medication_id)
        .order_by(DoseDB.scheduled_at.desc())
        .limit(14)
    ).all()

    if not doses:
        return 0

    unprompted = sum(
        1 for dose in doses
        if dose.status == "taken" and not dose.prompted
    )

    return round(unprompted / len(doses) * 100)


def missed_dose(
    session: Session,
    medication: MedicationDB,
):
    patient = session.get(PatientDB, medication.patient_id)

    medication.streak = 0

    if medication.always_remind or (
        patient is not None and not patient.fading_enabled
    ):
        medication.level = 1

    else:
        medication.level = max(medication.level - 1, 1)

    cutoff = clock.now() - timedelta(days=7)

    missed = session.exec(
        select(DoseDB).where(
            DoseDB.medication_id == medication.id,
            DoseDB.status == "missed",
            DoseDB.scheduled_at >= cutoff,
        )
    ).all()

    if len(missed) >= 2:
        medication.level = 1

        existing_alert = session.exec(
            select(AlertDB).where(
                AlertDB.patient_id == medication.patient_id,
                AlertDB.title == "2 misses this week",
                AlertDB.handled == False,
            )
        ).first()

        if existing_alert is None:
            alert = AlertDB(
                patient_id=medication.patient_id,
                tier="yellow",
                title="2 misses this week",
                summary=(
                    f"{medication.name} has been missed "
                    "at least twice in the last 7 days."
                ),
                created_at=clock.now(),
                sms_sent=False,
                handled=False,
            )

            session.add(alert)
            try:  # the caregiver app reads alerts from care_store; mirror it there (silent, like every alert)
                from app import care_store

                care_store.add_alert({
                    "tier": "yellow", "title": "2 misses this week", "summary": alert.summary, "note": None,
                    "sms_sent": False, "why": [f"{medication.name} missed twice in 7 days"], "tone_note": None,
                    "checkin_id": None,
                })
            except Exception:  # noqa: BLE001 - never let the mirror break dose tracking
                pass

    session.add(medication)
    session.commit()
    session.refresh(medication)

    return medication
