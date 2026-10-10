"""Prescription label photos -> structured schedule."""

from __future__ import annotations

import re

from pydantic import BaseModel

from app.contracts import ExtractedMed
from app.prompts import EXTRACT_SYSTEM, EXTRACT_USER

from . import _gemini
from ._env import load_example, log, use_mocks

# Drug classes that should never fade: blood thinners, insulin, seizure and heart-rhythm medicines.
HIGH_RISK_WORDS = {
    "warfarin", "coumadin", "jantoven", "apixaban", "eliquis", "rivaroxaban", "xarelto", "dabigatran", "pradaxa",
    "edoxaban", "savaysa", "heparin", "enoxaparin", "lovenox", "clopidogrel", "plavix",
    "insulin", "lantus", "humalog", "novolog", "levemir", "tresiba", "basaglar",
    "levetiracetam", "keppra", "phenytoin", "dilantin", "carbamazepine", "tegretol", "valproate", "valproic",
    "depakote", "lamotrigine", "lamictal", "lacosamide",
    "amiodarone", "digoxin", "flecainide", "sotalol", "dofetilide", "propafenone", "dronedarone",
}

COLOR_HEX = {
    "white": "#FFFFFF", "off-white": "#F4F1E8", "cream": "#F4EBD0", "yellow": "#F2C94C", "orange": "#E9A23B",
    "peach": "#F5C6A5", "pink": "#E8A0BF", "red": "#D64545", "purple": "#9B7BD1", "blue": "#5B8DEF",
    "light blue": "#A9C8F5", "green": "#5DB075", "brown": "#9C6B43", "tan": "#D2B48C", "gray": "#B8BFC2",
    "grey": "#B8BFC2", "black": "#333333",
}


class _Med(BaseModel):  # Gemini-facing schema: no defaults (the SDK rejects them)
    name: str
    dose: str | None
    times: list[str]
    purpose: str | None
    look: str | None
    color: str | None
    high_risk: bool
    needs_review: bool


class _Out(BaseModel):
    medications: list[_Med]


def normalize_time(raw: str) -> str | None:
    """'8:00 PM', '8pm', '20:00', '0800' -> '20:00' style. None if it can't be read."""
    s = (raw or "").strip().lower().replace(".", "")
    m = re.fullmatch(r"(\d{1,2})(?::?(\d{2}))?\s*(am|pm)?", s)
    if not m:
        return None
    hour, minute, ampm = int(m.group(1)), int(m.group(2) or 0), m.group(3)
    if ampm == "pm" and hour < 12:
        hour += 12
    if ampm == "am" and hour == 12:
        hour = 0
    if not (0 <= hour <= 23 and 0 <= minute <= 59):
        return None
    return f"{hour:02d}:{minute:02d}"


def normalize_color(color: str | None, look: str | None) -> str | None:
    if color and re.fullmatch(r"#[0-9a-fA-F]{6}", color.strip()):
        return color.strip().upper()
    text = f"{color or ''} {look or ''}".lower()
    for name in sorted(COLOR_HEX, key=len, reverse=True):
        if name in text:
            return COLOR_HEX[name]
    return None


def is_high_risk(name: str) -> bool:
    words = set(re.findall(r"[a-z]+", name.lower()))
    return bool(words & HIGH_RISK_WORDS)


def extract_schedule(images: list[bytes]) -> list[ExtractedMed]:
    """Read 1-6 label photos. Returns [] if nothing could be read; the setup screen then lets the caregiver add rows."""
    if use_mocks():
        return [ExtractedMed(**m) for m in load_example("extracted_meds")["medications"]]
    if not images:
        return []
    try:
        parts = [_gemini.image_part(img) for img in images[:6]] + [EXTRACT_USER]
        out = _gemini.generate_json(parts, _Out, EXTRACT_SYSTEM, temperature=0.1)
    except Exception:  # noqa: BLE001
        log.exception("extract_schedule failed")
        return []

    meds: list[ExtractedMed] = []
    seen: set[str] = set()
    for m in out.medications:
        name = (m.name or "").strip()
        if not name or name.lower() in seen:
            continue
        seen.add(name.lower())
        times = sorted({t for t in (normalize_time(x) for x in m.times) if t})
        meds.append(ExtractedMed(
            name=name,
            dose=(m.dose or "").strip() or None,
            times=times,
            purpose=(m.purpose or "").strip() or None,
            look=(m.look or "").strip() or None,
            color=normalize_color(m.color, m.look),
            high_risk=m.high_risk or is_high_risk(name),
            needs_review=m.needs_review or not m.dose or not times,
        ))
    return meds
