
from datetime import datetime #stores dose alert and checkins happen

from sqlalchemy import JSON # lets us store lists 
from sqlmodel import SQLModel, Field   #define database tables with puthon classes

class ProfileDB(SQLModel, table=True):
    id: int = Field(default=1, primary_key=True)

    patient_full_name: str = ""
    patient_preferred_name: str = ""
    patient_phone: str | None = None
    patient_language: str = "en"
    patient_interests: list[str] = Field(
        default_factory=list, sa_type=JSON
    )

    caregiver_name: str = ""
    caregiver_relationship: str | None = None
    caregiver_phone: str = ""

    sharing_consent: bool = False
    setup_complete: bool = False

class PatientDB(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    fading_enabled: bool = True

class MedicationDB(SQLModel, table=True):
    id: str = Field(primary_key=True)
    patient_id: int = Field(foreign_key="patientdb.id")

    name: str
    dose: str | None = None

    times: list[str] = Field(
        default_factory=list,
        sa_type=JSON
    )

    purpose: str | None = None
    look: str | None = None
    color: str | None = None

    high_risk: bool = False
    always_remind: bool = False

    level: int = 1
    streak: int = 0

class DoseDB(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)

    medication_id: str = Field(foreign_key="medicationdb.id")

    scheduled_at: datetime
    status: str = "upcoming"

    prompted: bool = False
    confirmed_at: datetime | None = None

class CheckInDB(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    patient_id: int = Field(foreign_key="patientdb.id")

    created_at: datetime
    transcript: str = ""
    transcript_en: str = ""

    analysis: dict = Field(default_factory=dict, sa_type=JSON)

    tier: str = "green"
    mood_score: int | None = None

    symptoms: list[str] = Field(
        default_factory=list, sa_type=JSON
    )

    why: list[str] = Field(
        default_factory=list, sa_type=JSON
    )

    tone_note: str | None = None
    heard_audio: bool = False

class AlertDB(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)

    patient_id: int = Field(foreign_key="patientdb.id")
    checkin_id: int | None = Field(
        default=None,
        foreign_key="checkindb.id"
    )

    tier: str = "green"
    title: str = ""
    summary: str = ""
    note: str | None = None

    created_at: datetime
    sms_sent: bool = False
    handled: bool = False

class MedInfoDB(SQLModel, table=True):
    med_name: str = Field(primary_key=True)

    payload: dict = Field(
        default_factory=dict,
        sa_type=JSON
    )

    fetched_at: datetime
