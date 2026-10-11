
from datetime import datetime, timedelta

from sqlmodel import Session, select

from app import clock
from app.models import MedicationDB, DoseDB
from app.engine.fading import missed_dose


def ensure_today(session: Session, now: datetime | None = None):
    if now is None:
        now = clock.now()

    if now.tzinfo is None:
        now = now.astimezone()

    medications = session.exec(
        select(MedicationDB)
    ).all()

    day_start = now.replace(
        hour=0,
        minute=0,
        second=0,
        microsecond=0,
    )

    day_end = day_start + timedelta(days=1)

    # Generate today's scheduled doses
    for med in medications:
        for time_str in med.times:
            hour, minute = map(int, time_str.split(":"))

            scheduled_at = day_start.replace(
                hour=hour,
                minute=minute,
            )

            existing = session.exec(
                select(DoseDB).where(
                    DoseDB.medication_id == med.id,
                    DoseDB.scheduled_at == scheduled_at,
                )
            ).first()

            if existing is None:
                session.add(
                    DoseDB(
                        medication_id=med.id,
                        scheduled_at=scheduled_at,
                        status="upcoming",
                    )
                )

    session.commit()

    # Retrieve today's doses
    doses = session.exec(
        select(DoseDB).where(
            DoseDB.scheduled_at >= day_start,
            DoseDB.scheduled_at < day_end,
        )
    ).all()

    # Update dose statuses
    for dose in doses:
        if dose.status in ("taken", "missed"):
            continue

        if now >= dose.scheduled_at + timedelta(hours=2):
            dose.status = "missed"
            session.add(dose)
            session.flush()

            medication = session.get(
                MedicationDB,
                dose.medication_id,
            )

            if medication is not None:
                missed_dose(session, medication)

        elif now >= dose.scheduled_at:
            dose.status = "due"

        else:
            dose.status = "upcoming"

        session.add(dose)

    session.commit()

    return doses
