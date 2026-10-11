
from datetime import datetime, timedelta, timezone

import pytest
from sqlmodel import Session, SQLModel, create_engine, select

from app import clock
from app.engine.fading import confirm_dose, missed_dose
from app.models import (
    AlertDB,
    DoseDB,
    MedicationDB,
    PatientDB,
)


@pytest.fixture
def session(tmp_path, monkeypatch):
    engine = create_engine(
        f"sqlite:///{(tmp_path / 'fading.db').as_posix()}"
    )

    SQLModel.metadata.create_all(engine)

    fake_now = datetime(
        2026, 10, 10, 20, 0, tzinfo=timezone.utc
    )
    monkeypatch.setattr(clock, "now", lambda: fake_now)

    with Session(engine) as db:
        db.add(PatientDB(id=1, fading_enabled=True))
        db.add(
            MedicationDB(
                id="test_med",
                patient_id=1,
                name="Test Medication",
                times=["08:00"],
                level=1,
                streak=0,
            )
        )
        db.commit()
        yield db

    engine.dispose()


def get_med(session):
    return session.get(MedicationDB, "test_med")


def add_missed(session, days_ago):
    session.add(
        DoseDB(
            medication_id="test_med",
            scheduled_at=clock.now()
            - timedelta(days=days_ago),
            status="missed",
        )
    )
    session.commit()


def test_five_unprompted_doses(session):
    med = get_med(session)

    for _ in range(5):
        confirm_dose(session, med, prompted=False)

    assert med.level == 2
    assert med.streak == 0


def test_prompted_resets_streak(session):
    med = get_med(session)

    confirm_dose(session, med, prompted=False)
    confirm_dose(session, med, prompted=False)
    confirm_dose(session, med, prompted=True)

    assert med.level == 1
    assert med.streak == 0


def test_level_never_above_four(session):
    med = get_med(session)
    med.level = 4
    session.add(med)
    session.commit()

    for _ in range(5):
        confirm_dose(session, med, prompted=False)

    assert med.level == 4


def test_always_remind(session):
    med = get_med(session)
    med.always_remind = True
    med.level = 3
    session.add(med)
    session.commit()

    confirm_dose(session, med, prompted=False)

    assert med.level == 1
    assert med.streak == 0


def test_fading_disabled(session):
    med = get_med(session)
    patient = session.get(PatientDB, 1)

    patient.fading_enabled = False
    med.level = 3

    session.add(patient)
    session.add(med)
    session.commit()

    confirm_dose(session, med, prompted=False)

    assert med.level == 1


def test_one_missed_dose(session):
    med = get_med(session)
    med.level = 3
    med.streak = 4
    session.add(med)
    session.commit()

    add_missed(session, 1)
    missed_dose(session, med)

    assert med.level == 2
    assert med.streak == 0


def test_two_misses_create_yellow_alert(session):
    med = get_med(session)
    med.level = 3
    session.add(med)
    session.commit()

    add_missed(session, 1)
    add_missed(session, 2)

    missed_dose(session, med)

    assert med.level == 1

    alerts = session.exec(
        select(AlertDB)
    ).all()

    assert len(alerts) == 1
    assert alerts[0].tier == "yellow"
    assert alerts[0].title == "2 misses this week"


def test_old_miss_does_not_count(session):
    med = get_med(session)
    med.level = 3
    session.add(med)
    session.commit()

    add_missed(session, 1)
    add_missed(session, 9)

    missed_dose(session, med)

    assert med.level == 2

    alerts = session.exec(
        select(AlertDB)
    ).all()

    assert len(alerts) == 0


def test_no_duplicate_open_alert(session):
    med = get_med(session)

    add_missed(session, 1)
    add_missed(session, 2)

    missed_dose(session, med)
    missed_dose(session, med)

    alerts = session.exec(
        select(AlertDB)
    ).all()

    assert len(alerts) == 1
