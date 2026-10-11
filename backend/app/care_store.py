"""The care record: profile, check-ins and alerts, kept in one JSON file. Owner: Rushil.

Small on purpose (a demo, not a hospital): one patient, one caregiver, everything in backend/data/steady.json
(gitignored), written atomically, guarded by a lock so two requests can't interleave.

Samarth's scheduling engine shares two things through here:
    care_store.set_meds([MedBrief, ...])   call after the caregiver confirms the schedule
    care_store.meds()                      the current medicine list (used for check-ins and "Know more")
and care_store.reset() for the demo reset button.
"""

from __future__ import annotations

import copy
import json
import os
import threading
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

from app.contracts import MedBrief, PastCheckin, Profile

DATA_FILE = Path(os.getenv("STEADY_DATA_FILE") or Path(__file__).resolve().parents[1] / "data" / "steady.json")

_lock = threading.RLock()
_cache: dict[str, Any] | None = None


EMPTY_PROFILE = {
    "patient": {"full_name": "", "preferred_name": "", "phone": None, "language": "en", "interests": []},
    "caregiver": {"name": "", "relationship": None, "phone": ""},
    "sharing_consent": False,
    "setup_complete": False,
}


def _seeded_history() -> list[dict[str, Any]]:
    """Demo history: one check-in two days ago mentioning dizziness, so a "dizzy again" check-in tonight is
    recognised as a repeat (yellow). Shown in the caregiver feed like any other check-in."""
    earlier = (datetime.now() - timedelta(days=2)).replace(hour=20, minute=4, second=0, microsecond=0)
    return [{
        "id": 900, "at": earlier.isoformat(timespec="seconds"),
        "transcript": "I took my medicine. I felt a little dizzy after lunch.",
        "transcript_en": "I took my medicine. I felt a little dizzy after lunch.", "lang": "en", "tier": "green",
        "symptoms": ["dizzy"], "red_flags": [], "mood_score": 6.8, "tone_note": None,
        "why": ["Mentioned feeling a little dizzy after lunch", "Took the evening medicines"], "heard_audio": False,
        "summary": "Took the evening medicines and mentioned feeling a little dizzy after lunch.",
    }]


def _default(sample: bool = False) -> dict[str, Any]:
    """Start state: no profile yet (the caregiver sets it up), no medicines (the caregiver scans them), and an
    empty history. The demo history (an earlier dizzy check-in plus the dashboard's example charts) is only
    present when sample=True, which the demo controls switch on."""
    return {"profile": copy.deepcopy(EMPTY_PROFILE), "meds": [], "checkins": _seeded_history() if sample else [],
            "alerts": [], "next_id": 1000, "sample_history": sample}


def _load() -> dict[str, Any]:
    global _cache
    if _cache is None:
        try:
            _cache = json.loads(DATA_FILE.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            _cache = _default()
        if "sample_history" not in _cache:  # data file from an older version: it has the sample check-in iff sampled
            _cache["sample_history"] = any(c.get("id") == 900 for c in _cache.get("checkins", []))
    return _cache


def _save() -> None:
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    tmp = DATA_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(_cache, ensure_ascii=False, indent=1), encoding="utf-8")
    tmp.replace(DATA_FILE)


def now() -> datetime:
    """The app's 'now'. Uses Samarth's demo clock if app.clock.now exists, else the real time."""
    try:
        from app.clock import now as demo_now  # type: ignore[import-not-found]

        return demo_now()
    except Exception:  # noqa: BLE001 - no demo clock yet
        return datetime.now()


def part_of_day(at: datetime | None = None) -> str:
    return "morning" if (at or now()).hour < 15 else "evening"


def _next_id() -> int:
    data = _load()
    data["next_id"] += 1
    return data["next_id"]


# ---------- profile ----------

def profile() -> Profile:
    with _lock:
        return Profile.model_validate(_load()["profile"])


def save_profile(p: Profile) -> Profile:
    with _lock:
        _load()["profile"] = p.model_dump()
        _save()
        return p


def update_patient(**fields: Any) -> Profile:
    """For PUT /api/patient/language and /interests: update_patient(language="hi")."""
    with _lock:
        _load()["profile"]["patient"].update({k: v for k, v in fields.items() if v is not None})
        _save()
        return profile()


# ---------- medicines (written by the scheduling engine) ----------

def meds() -> list[MedBrief]:
    with _lock:
        return [MedBrief.model_validate(m) for m in _load()["meds"]]


def set_meds(items: list[MedBrief]) -> None:
    with _lock:
        _load()["meds"] = [m.model_dump() for m in items]
        _save()


def med(med_id: str) -> MedBrief | None:
    return next((m for m in meds() if m.id == med_id), None)


# ---------- check-ins and alerts ----------

def add_checkin(record: dict[str, Any]) -> dict[str, Any]:
    with _lock:
        record = {"id": _next_id(), "at": now().isoformat(timespec="seconds"), **record}
        _load()["checkins"].append(record)
        _save()
        return copy.deepcopy(record)


def checkins() -> list[dict[str, Any]]:
    with _lock:
        return copy.deepcopy(_load()["checkins"])


def history(days_back: int = 7) -> list[PastCheckin]:
    """Earlier check-ins, for spotting repeated symptoms."""
    return [PastCheckin(at=c["at"], transcript=c.get("transcript_en") or c.get("transcript", ""),
                        symptoms=c.get("symptoms", []), tier=c.get("tier", "green"))
            for c in checkins()[-days_back * 2:]]


def add_alert(record: dict[str, Any]) -> dict[str, Any]:
    with _lock:
        record = {"id": _next_id(), "created_at": now().isoformat(timespec="seconds"), "handled": False, **record}
        _load()["alerts"].append(record)
        _save()
        return copy.deepcopy(record)


def update_alert(alert_id: int, **fields: Any) -> bool:
    with _lock:
        for a in _load()["alerts"]:
            if a["id"] == alert_id:
                a.update(fields)
                _save()
                return True
        return False


def open_alert() -> dict[str, Any] | None:
    """The newest unhandled alert, red before yellow."""
    with _lock:
        open_ = [a for a in _load()["alerts"] if not a.get("handled")]
        if not open_:
            return None
        rank = {"red": 2, "yellow": 1, "green": 0}
        return copy.deepcopy(max(open_, key=lambda a: (rank.get(a["tier"], 0), a["id"])))


def reset(full: bool = False) -> None:
    """Demo reset: clears check-ins and alerts (back to the seeded history).
    full=True also clears the profile and medicines ("Start fresh": set everything up again from scratch)."""
    global _cache
    with _lock:
        old = _load()
        _cache = _default(sample=bool(old.get("sample_history")) and not full)
        if not full:
            _cache["profile"], _cache["meds"] = old["profile"], old["meds"]
        _save()


def sample_history() -> bool:
    with _lock:
        return bool(_load().get("sample_history"))


def load_sample_history() -> None:
    """Demo only: add the example history (dizzy check-in two days ago, example charts) to the dashboard."""
    global _cache
    with _lock:
        old = _load()
        _cache = _default(sample=True)
        _cache["profile"], _cache["meds"] = old["profile"], old["meds"]
        _save()
