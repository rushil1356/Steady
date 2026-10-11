"""Caregiver dashboard: real profile, check-ins and alerts on top of the seeded history (charts, past days).
Owner: Rushil for the check-in/alert parts; medications and adherence numbers come from the scheduling engine
(Samarth) when it lands, until then from contracts/examples/dashboard.json."""

from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from app import care_store, clock, mocks
from app.contracts import CheckinRow, Dashboard, DashboardMed, Kpis, MoodPoint, Status
from app.db import get_session
from app.engine.doses import ensure_today
from app.models import MedicationDB
from app.routers.alerts import to_active

router = APIRouter(prefix="/api")

HEADLINES = {"green": "All good today", "yellow": "Worth a check-in", "red": "Needs attention now"}


def _row(c: dict) -> CheckinRow:
    quote_en = c.get("transcript_en") if c.get("transcript_en") and c.get("transcript_en") != c.get("transcript") else None
    return CheckinRow(id=c["id"], at=c["at"], quote=c.get("transcript", ""), quote_en=quote_en, tier=c["tier"],
                      tag=(c.get("why") or [HEADLINES[c["tier"]]])[0], symptoms=c.get("symptoms", []),
                      tone_note=c.get("tone_note"), why=c.get("why", []), heard_audio=c.get("heard_audio", False))


def _clock_label(hhmm: str) -> str:
    h, m = (int(x) for x in hhmm.split(":"))
    return f"{(h % 12) or 12}:{m:02d} {'AM' if h < 12 else 'PM'}"


def _blank(session: Session) -> Dashboard:
    """A new user's dashboard: only what has really happened (today's doses, check-ins, alerts), no example history."""
    doses = ensure_today(session, clock.now())
    meds = session.exec(select(MedicationDB)).all()
    return Dashboard(
        status=Status(tier="green", headline=HEADLINES["green"], updated_at=care_store.now().isoformat(timespec="seconds")),
        kpis=Kpis(today_taken=sum(d.status == "taken" for d in doses), today_total=len(doses), on_time_pct_30d=0,
                  on_time_doses_30d=0, doses_30d=0, unprompted_this_week=0, doses_this_week=0, checkins_answered_14d=0),
        mood_14d=[], usual_range=[], unprompted_by_week=[], calendar_30d=[], checkins=[],
        medications=[DashboardMed(id=m.id, name=m.name, dose=m.dose, purpose=m.purpose, color=m.color,
                                  schedule="Daily · " + ", ".join(_clock_label(t) for t in m.times),
                                  level=m.level, always_remind=m.always_remind, independence=0)
                     for m in meds],
        interests=[],
    )


@router.get("/caregiver/dashboard", response_model=Dashboard)
def dashboard(session: Session = Depends(get_session)):
    seeded = Dashboard.model_validate(mocks.load("dashboard")) if care_store.sample_history() else _blank(session)
    real = care_store.checkins()
    alert = care_store.open_alert()
    tier = alert["tier"] if alert else "green"
    updated = (alert or (real[-1] if real else {})).get("created_at") or (real[-1]["at"] if real else None)

    mood = list(seeded.mood_14d)
    answered = seeded.kpis.checkins_answered_14d if care_store.sample_history() else len(real)
    for c in real:
        if c.get("mood_score") is not None:
            mood.append(MoodPoint(date=c["at"][:10], score=c["mood_score"]))

    return seeded.model_copy(update={
        "status": Status(tier=tier, headline=HEADLINES[tier],
                         updated_at=updated or care_store.now().isoformat(timespec="seconds")),
        "active_alert": to_active(alert) if alert else None,
        "checkins": [_row(c) for c in reversed(real)],   # the store already holds the seeded earlier check-in
        "mood_14d": mood[-14:],
        "kpis": seeded.kpis.model_copy(update={"checkins_answered_14d": answered}),
        "interests": care_store.profile().patient.interests,
    })
