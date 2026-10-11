
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from app import clock
from app.contracts import (
    DoseConfirmRequest,
    DoseConfirmResponse,
    MedState,
)
from app.db import get_session
from app.engine.fading import confirm_dose as update_fading
from app.engine.fading import independence
from app.models import DoseDB, MedicationDB

router = APIRouter(prefix="/api")


@router.post(
    "/doses/{dose_id}/confirm",
    response_model=DoseConfirmResponse,
)
def confirm_dose(
    dose_id: int,
    body: DoseConfirmRequest,
    session: Session = Depends(get_session),
):
    dose = session.get(DoseDB, dose_id)

    if dose is None:
        raise HTTPException(
            status_code=404,
            detail="Dose not found",
        )

    medication = session.get(
        MedicationDB, dose.medication_id
    )

    if medication is None:
        raise HTTPException(
            status_code=404,
            detail="Medication not found",
        )

    # Do not count the same confirmation twice
    if dose.status != "taken":
        dose.status = "taken"
        dose.prompted = body.prompted
        dose.confirmed_at = clock.now()

        session.add(dose)
        session.commit()

        update_fading(
            session,
            medication,
            prompted=body.prompted,
        )

    score = independence(session, medication.id)

    return DoseConfirmResponse(
        dose_id=dose.id,
        status=dose.status,
        med=MedState(
            id=medication.id,
            level=medication.level,
            streak=medication.streak,
            independence=score,
        ),
    )
