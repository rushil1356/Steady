"""One personal line to open a check-in, from the patient's interests."""

from __future__ import annotations

import datetime as dt
import random

from app.prompts import OPENER_SEARCH_HINT, OPENER_SYSTEM

from . import _gemini
from ._env import env, load_example, log, use_mocks

# Written for Steady; used when Gemini is off or fails, and for variety.
FALLBACK_LINES = {
    "uplifting thoughts": [
        "Small habits, kept every day, quietly become strength.",
        "Every evening you look after yourself is a gift to everyone who loves you.",
        "A calm evening is a good evening. You've earned this one.",
    ],
    "clean jokes": [
        "Here's one for you: why don't eggs tell jokes? They'd crack each other up.",
        "Why did the tomato blush? It saw the salad dressing.",
        "What do you call a sleeping bull? A bulldozer.",
    ],
    "proverbs": [
        "As the old saying goes, drop by drop, the pot gets filled. Little by little works.",
        "They say a patient heart cooks the sweetest food.",
    ],
    "cricket": [
        "One run at a time wins the match. Same with good habits.",
        "A steady innings beats a quick six. Just like you.",
    ],
}

_cache: dict[str, str | None] = {}


def _fallback(interests: list[str]) -> str | None:
    pool = [line for i in interests for key, lines in FALLBACK_LINES.items() if key in i.strip().lower()
            for line in lines]
    if not pool:
        pool = FALLBACK_LINES["uplifting thoughts"]
    return random.choice(pool)


def write_opener(interests: list[str], part_of_day: str = "evening") -> str | None:
    """A line of at most ~25 words, or None (about 1 in 5 times) so it never feels repetitive.
    Cached per day and part of day, so the home screen and the check-in say the same thing.
    OPENER_SEARCH=1 lets Gemini use Google Search for one light, real, current fact (e.g. last night's cricket)."""
    if use_mocks():
        return load_example("checkin_prompt")["opener"]["text_en"]

    key = f"{dt.date.today().isoformat()}|{part_of_day}|{','.join(sorted(i.lower() for i in interests))}"
    if key in _cache:
        return _cache[key]

    if random.random() < 0.2:
        line = None
    else:
        try:
            search = env("OPENER_SEARCH", "0").lower() in {"1", "true", "yes", "on"}
            prompt = f"They enjoy: {', '.join(interests) or 'uplifting thoughts'}. Write today's line."
            system = OPENER_SYSTEM.format(part_of_day=part_of_day) + (OPENER_SEARCH_HINT if search else "")
            line = _gemini.generate_text([prompt], system, temperature=0.9, search=search)
            line = line.strip().strip('"').strip()
            if not line or len(line) > 220 or "\n" in line:
                line = _fallback(interests)
        except Exception:  # noqa: BLE001
            log.exception("write_opener: Gemini failed, using a written line")
            line = _fallback(interests)

    _cache[key] = line
    return line
