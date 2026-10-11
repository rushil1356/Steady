"""Alerts for the caregiver app. GET /api/alerts/latest is polled every 3 seconds, so it only reads the store.
Owner: Rushil."""

from fastapi import APIRouter

from app import care_store
from app.contracts import ActiveAlert, AlertsLatest, OkResponse

router = APIRouter(prefix="/api")


def to_active(a: dict) -> ActiveAlert:
    return ActiveAlert(id=a["id"], tier=a["tier"], title=a["title"], summary=a["summary"], note=a.get("note"),
                       created_at=a["created_at"], sms_sent=a.get("sms_sent", False), why=a.get("why", []),
                       tone_note=a.get("tone_note"), checkin_id=a.get("checkin_id"))


@router.get("/alerts/latest", response_model=AlertsLatest)
def latest():
    alert = care_store.open_alert()
    checkins = care_store.checkins()
    return AlertsLatest(
        alert=to_active(alert) if alert else None,
        latest_checkin_id=checkins[-1]["id"] if checkins else None,
        updated_at=care_store.now().isoformat(timespec="seconds"),
    )


@router.post("/alerts/{alert_id}/handled", response_model=OkResponse)
def handled(alert_id: int):
    return OkResponse(ok=care_store.update_alert(alert_id, handled=True))
