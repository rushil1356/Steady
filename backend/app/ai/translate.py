"""English <-> the patient's language, cached forever (backend/.cache/translations.json)."""

from __future__ import annotations

import json

from app.prompts import TO_ENGLISH_SYSTEM, TRANSLATE_SYSTEM

from . import _gemini
from ._env import EXAMPLES_DIR, JsonCache, log, use_mocks
from .languages import is_supported, language_name

_cache = JsonCache("translations")
_known: dict[str, str] | None = None


def _known_pairs() -> dict[str, str]:
    """'lang|English' -> translation pairs already written in contracts/examples, used in mock mode."""
    global _known
    if _known is None:
        pairs: dict[str, str] = {}

        def walk(node):
            if isinstance(node, dict):
                if isinstance(node.get("text_en"), str) and isinstance(node.get("text_local"), str):
                    pairs[f"{node.get('lang', 'en')}|{node['text_en']}"] = node["text_local"]
                for v in node.values():
                    walk(v)
            elif isinstance(node, list):
                for v in node:
                    walk(v)

        for path in EXAMPLES_DIR.glob("*.json"):
            try:
                walk(json.loads(path.read_text(encoding="utf-8")))
            except ValueError:
                pass
        _known = pairs
    return _known


def translate(text_en: str, lang: str) -> str | None:
    """English -> lang. None for English, unknown languages, or failure; callers then show English only."""
    text_en = text_en.strip()
    if not text_en or lang == "en" or not is_supported(lang):
        return None
    key = f"{lang}|{text_en}"
    if use_mocks():
        return _known_pairs().get(key)
    cached = _cache.get(key)
    if cached:
        return cached
    try:
        out = _gemini.generate_text([text_en], TRANSLATE_SYSTEM.format(language=language_name(lang)), temperature=0.2)
        out = out.strip().strip('"')
    except Exception:  # noqa: BLE001
        log.exception("translate(%s) failed", lang)
        return None
    if not out:
        return None
    _cache.set(key, out)
    return out


def to_english(text: str, lang: str) -> str:
    """The patient's words in English, for the safety net and the caregiver. Returns the input if it can't."""
    text = text.strip()
    if not text or lang == "en" or use_mocks():
        return text
    key = f"en<{lang}|{text}"
    cached = _cache.get(key)
    if cached:
        return cached
    try:
        out = _gemini.generate_text([text], TO_ENGLISH_SYSTEM, temperature=0.1).strip().strip('"')
    except Exception:  # noqa: BLE001
        log.exception("to_english failed")
        return text
    if out:
        _cache.set(key, out)
    return out or text
