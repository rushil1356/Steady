
from datetime import datetime, timedelta, timezone

from sqlmodel import Session, select
from app import clock

from app.models import MedicationDB, DoseDB


def ensure_today(session: Session, now: datetime | None = None):
    if now is None:
        now = clock.now()

    if now.tzinfo is None:
        now = now.astimezone()

    medications = session.exec(
        select(MedicationDB)
    ).all()

    day_start = now.replace(
        hour=0, minute=0, second=0, microsecond=0
    )

    day_end = day_start + timedelta(days=1)

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

    doses = session.exec(
        select(DoseDB).where(
            DoseDB.scheduled_at >= day_start,
            DoseDB.scheduled_at < day_end,
        )
    ).all()

    for dose in doses:
        if dose.status in ("taken", "missed"):
            continue

        if now >= dose.scheduled_at + timedelta(hours=2):
            dose.status = "missed"

        elif now >= dose.scheduled_at:
            dose.status = "due"

        else:
            dose.status = "upcoming"

        session.add(dose)

    session.commit()

    return doses
