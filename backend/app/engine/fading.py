
from sqlmodel import Session, select

from app.models import MedicationDB, PatientDB, DoseDB
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
        else:
            medication.level = max(
                medication.level - 1, 1
            )

    session.add(medication)
    session.commit()
    session.refresh(medication)

    return medication
