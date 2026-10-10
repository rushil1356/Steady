"""Steady's AI layer (Gemini). Owner: Rushil.

Samarth's routes call ONLY these functions. Signatures are part of the contract: keep them stable.
With USE_MOCKS=1 every function returns contracts/examples data and calls no API.
None of them raise on API failure; each returns a safe fallback instead.
"""

from .analyze import analyze_checkin, closing_line, rules_analysis
from .extract import extract_schedule
from .label import simplify_label
from .languages import is_supported, list_languages
from .opener import write_opener
from .reminders import reminder_text

__all__ = [
    "extract_schedule",
    "reminder_text",
    "write_opener",
    "analyze_checkin",
    "rules_analysis",
    "closing_line",
    "simplify_label",
    "list_languages",
    "is_supported",
]
