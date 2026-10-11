"""Caregiver dashboard: real profile, check-ins and alerts on top of the seeded history (charts, past days).
Owner: Rushil for the check-in/alert parts; medications and adherence numbers come from the scheduling engine
(Samarth) when it lands, until then from contracts/examples/dashboard.json."""

from fastapi import APIRouter

from app import care_store, mocks
from app.contracts import CheckinRow, Dashboard, MoodPoint, Status
from app.routers.alerts import to_active

router = APIRouter(prefix="/api")

HEADLINES = {"green": "All good today", "yellow": "Worth a check-in", "red": "Needs attention now"}


def _row(c: dict) -> CheckinRow:
    quote_en = c.get("transcript_en") if c.get("transcript_en") and c.get("transcript_en") != c.get("transcript") else None
    return CheckinRow(id=c["id"], at=c["at"], quote=c.get("transcript", ""), quote_en=quote_en, tier=c["tier"],
                      tag=(c.get("why") or [HEADLINES[c["tier"]]])[0], symptoms=c.get("symptoms", []),
                      tone_note=c.get("tone_note"), why=c.get("why", []), heard_audio=c.get("heard_audio", False))


@router.get("/caregiver/dashboard", response_model=Dashboard)
def dashboard():
    seeded = Dashboard.model_validate(mocks.load("dashboard"))
    real = care_store.checkins()
    alert = care_store.open_alert()
    tier = alert["tier"] if alert else "green"
    updated = (alert or (real[-1] if real else {})).get("created_at") or (real[-1]["at"] if real else None)

    mood = list(seeded.mood_14d)
    for c in real:
        if c.get("mood_score") is not None:
            mood.append(MoodPoint(date=c["at"][:10], score=c["mood_score"]))

    return seeded.model_copy(update={
        "status": Status(tier=tier, headline=HEADLINES[tier],
                         updated_at=updated or care_store.now().isoformat(timespec="seconds")),
        "active_alert": to_active(alert) if alert else None,
        "checkins": [_row(c) for c in reversed(real)] + seeded.checkins,
        "mood_14d": mood[-14:],
        "interests": care_store.profile().patient.interests,
    })
