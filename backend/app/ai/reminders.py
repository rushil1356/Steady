"""The English line Steady speaks at dose time. Deterministic, so it's free and pre-generatable."""

from __future__ import annotations

from app.contracts import MedBrief


def _pill_phrase(med: MedBrief) -> str:
    """'yellow pill' -> 'the yellow one'; no look -> ''."""
    look = (med.look or "").strip().lower()
    if not look:
        return ""
    color = look.replace("pill", "").replace("tablet", "").replace("capsule", "").strip()
    return f"the {color} one" if color else ""


def reminder_text(med: MedBrief, level: int, patient_name: str = "") -> str:
    """Level 1 = full reminder. Level 2 = short nudge. Levels 3-4 never get a reminder (the caller shouldn't ask).
    patient_name = the preferred name from the profile; with none, the line starts without a name."""
    what = f"{med.purpose.lower()} pill" if med.purpose else med.name
    which = _pill_phrase(med)
    name = (patient_name or "").strip()
    if level <= 1:
        line = f"{name}, it's time for your {what}" if name else f"It's time for your {what}"
        return f"{line}, {which}." if which else f"{line}."
    short = f"{which.replace('the ', '').replace(' one', '')} pill" if which else what
    return f"{name}, your {short}." if name else f"Time for your {short}."
