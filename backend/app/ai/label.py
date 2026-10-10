"""'Know more': the official FDA label (openFDA), rewritten in plain words by Gemini. Cached per drug."""

from __future__ import annotations

import urllib.parse

import httpx
from pydantic import BaseModel

from app.contracts import MedInfo
from app.prompts import LABEL_SYSTEM

from . import _gemini
from ._env import JsonCache, load_example, log, use_mocks

OPENFDA = "https://api.fda.gov/drug/label.json"
SECTIONS = [
    "indications_and_usage", "dosage_and_administration", "boxed_warning", "warnings_and_cautions",
    "warnings", "adverse_reactions", "information_for_patients", "patient_medication_information",
]
_cache = JsonCache("med_info")


class _Out(BaseModel):  # Gemini-facing schema
    what_for: str
    how_to_take: str
    side_effects: str
    call_doctor_if: str


def _not_found(name: str) -> MedInfo:
    ask = "Ask your pharmacist or doctor."
    return MedInfo(med_name=name, what_for=f"Steady couldn't find the official label for {name}. {ask}",
                   how_to_take=ask, side_effects=ask, call_doctor_if=ask, source="Label not found", source_url=None)


def _fetch_label(name: str) -> tuple[dict, str] | None:
    for field in ("openfda.generic_name", "openfda.brand_name"):
        query = f'{field}:"{name.lower()}"'
        url = f"{OPENFDA}?search={urllib.parse.quote(query)}&limit=1"
        try:
            resp = httpx.get(url, timeout=10)
        except httpx.HTTPError:
            log.exception("openFDA request failed")
            return None
        if resp.status_code == 200 and resp.json().get("results"):
            return resp.json()["results"][0], url
    return None


def simplify_label(med_name: str) -> MedInfo:
    name = med_name.strip()
    if use_mocks():
        return MedInfo(**{**load_example("med_info"), "med_name": name or "Metoprolol"})

    cached = _cache.get(name.lower())
    if cached:
        return MedInfo(**cached)

    found = _fetch_label(name)
    if not found:
        return _not_found(name)
    label, url = found

    text = "\n\n".join(
        f"## {section}\n{' '.join(label[section])[:3500]}" for section in SECTIONS if label.get(section)
    )
    try:
        out = _gemini.generate_json([f"Medicine: {name}\n\nLabel text:\n{text}"], _Out, LABEL_SYSTEM, temperature=0.1)
    except Exception:  # noqa: BLE001
        log.exception("simplify_label: Gemini failed")
        return _not_found(name)

    info = MedInfo(med_name=name, what_for=out.what_for, how_to_take=out.how_to_take,
                   side_effects=out.side_effects, call_doctor_if=out.call_doctor_if,
                   source="FDA drug label via openFDA", source_url=url)
    _cache.set(name.lower(), info.model_dump())
    return info
