
from sqlmodel import SQLModel, Session, create_engine

from app.config import settings

# Connect to the SQLite database
engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False},   # manages connection to data base
)


def create_db_and_tables():
    from app import models

    SQLModel.metadata.create_all(engine)


def get_session():  # creates data base session for a request
    with Session(engine) as session:
        yield session


def sync_meds_to_care_store(session: Session) -> None:
    """Check-ins and "Know more" read medicines from care_store; mirror the scheduled medicines there."""
    from sqlmodel import select

    from app import care_store
    from app.contracts import MedBrief
    from app.models import MedicationDB

    meds = session.exec(select(MedicationDB)).all()
    care_store.set_meds([
        MedBrief(id=m.id, name=m.name, dose=m.dose, purpose=m.purpose, look=m.look, high_risk=m.high_risk)
        for m in meds
    ])


def seed_if_empty() -> None:
    """First run: the demo profile and the 4 demo medicines (contracts/examples), so every screen works at once."""
    from sqlmodel import select

    from app import care_store, mocks
    from app.models import MedicationDB, PatientDB, ProfileDB

    with Session(engine) as session:
        if session.get(PatientDB, 1) is None:
            session.add(PatientDB(id=1))
        if session.get(ProfileDB, 1) is None:
            p = care_store.profile()
            session.add(ProfileDB(
                id=1, patient_full_name=p.patient.full_name, patient_preferred_name=p.patient.preferred_name,
                patient_phone=p.patient.phone, patient_language=p.patient.language,
                patient_interests=p.patient.interests, caregiver_name=p.caregiver.name,
                caregiver_relationship=p.caregiver.relationship, caregiver_phone=p.caregiver.phone,
                sharing_consent=p.sharing_consent, setup_complete=p.setup_complete,
            ))
        if not session.exec(select(MedicationDB)).first():
            for m in mocks.load("extracted_meds")["medications"]:
                session.add(MedicationDB(
                    id=f"med_{m['name'].lower().replace(' ', '_')}", patient_id=1, name=m["name"],
                    dose=m.get("dose"), times=m.get("times", []), purpose=m.get("purpose"), look=m.get("look"),
                    color=m.get("color"), high_risk=m.get("high_risk", False),
                    always_remind=m.get("high_risk", False),
                ))
        session.commit()
        sync_meds_to_care_store(session)


def init_db() -> None:
    create_db_and_tables()
    seed_if_empty()
