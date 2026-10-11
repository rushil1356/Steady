"""Thin wrapper around the google-genai SDK: one client, JSON and text helpers, media parts."""

from __future__ import annotations

import re
import time
from typing import TypeVar

from pydantic import BaseModel

from ._env import env, log

T = TypeVar("T", bound=BaseModel)

DEFAULT_MODEL = "gemini-3.8-flash"  # override with GEMINI_MODEL in .env

_client = None


def client():
    global _client
    if _client is None:
        from google import genai

        key = env("GEMINI_API_KEY")
        if not key:
            raise RuntimeError("GEMINI_API_KEY is not set in backend/.env")
        _client = genai.Client(api_key=key)
    return _client


def model_name() -> str:
    return env("GEMINI_MODEL", DEFAULT_MODEL)


RETRY_STATUS = {429, 500, 502, 503, 504}  # busy or rate-limited: worth another try
RETRY_DELAYS = (1.5, 4.0)                  # seconds; 3 attempts in total, ~6 s worst case

_thinking_supported = True


def thinking():
    """Low thinking = much faster answers for our short, structured tasks. GEMINI_THINKING=off disables it;
    if a model rejects the setting we drop it automatically (see _call)."""
    from google.genai import types

    level = env("GEMINI_THINKING", "low").lower()
    if not _thinking_supported or level in {"off", "none", ""}:
        return None
    return types.ThinkingConfig(thinking_level=level)


def _models() -> list[str]:
    """The main model, then GEMINI_FALLBACK_MODEL (if set) for when the main one is out of quota or overloaded."""
    fallback = env("GEMINI_FALLBACK_MODEL")
    return [model_name()] + ([fallback] if fallback and fallback != model_name() else [])


def _is_daily_quota(err) -> bool:
    return getattr(err, "code", None) == 429 and "perday" in str(err).lower()


def _call(**kwargs):
    """generate_content with a short retry when Gemini is busy ("503 high demand") or rate-limits us.
    A DAILY quota error isn't retried (it won't clear for hours): we move straight to the fallback model."""
    global _thinking_supported
    from google.genai import errors

    last: Exception | None = None
    for model in _models():
        for attempt, delay in enumerate((*RETRY_DELAYS, None)):
            try:
                return client().models.generate_content(model=model, **kwargs)
            except errors.APIError as err:
                last = err
                code = getattr(err, "code", None)
                config = kwargs.get("config")
                if code == 400 and "thinking" in str(err).lower() and getattr(config, "thinking_config", None):
                    log.warning("%s rejected the thinking setting; continuing without it", model)
                    _thinking_supported = False
                    kwargs["config"] = config.model_copy(update={"thinking_config": None})
                    continue
                if _is_daily_quota(err):
                    log.error("Gemini daily quota used up for %s", model)
                    break
                if code not in RETRY_STATUS:
                    raise
                if delay is None:
                    break
                log.warning("Gemini %s on %s (attempt %d), retrying in %.1fs", code, model, attempt + 1, delay)
                time.sleep(delay)
        if len(_models()) > 1:
            log.warning("Switching from %s to the next model", model)
    raise last if last else RuntimeError("Gemini call failed")


def _strip_fences(text: str) -> str:
    text = (text or "").strip()
    match = re.match(r"^```(?:json)?\s*(.*?)\s*```$", text, re.S)
    return match.group(1) if match else text


def generate_json(parts: list, schema: type[T], system: str, temperature: float = 0.2) -> T:
    """Ask for JSON matching `schema`. Falls back to prompt-only JSON if the SDK rejects the schema."""
    from google.genai import types

    base = dict(system_instruction=system, temperature=temperature, response_mime_type="application/json",
                thinking_config=thinking())
    try:
        resp = _call(contents=parts, config=types.GenerateContentConfig(**base, response_schema=schema))
    except Exception as err:  # noqa: BLE001 - any SDK schema complaint
        if "schema" not in str(err).lower() and "default" not in str(err).lower():
            raise
        log.warning("Gemini rejected the response schema (%s); retrying without it", err)
        hint = f"\nReturn JSON matching this JSON Schema:\n{schema.model_json_schema()}"
        resp = _call(contents=parts, config=types.GenerateContentConfig(**{**base, "system_instruction": system + hint}))
    return schema.model_validate_json(_strip_fences(resp.text))


def generate_text(parts: list, system: str, temperature: float = 0.7, search: bool = False) -> str:
    """search=True turns on Google Search grounding, so the line can use a real, current fact."""
    from google.genai import types

    tools = [types.Tool(google_search=types.GoogleSearch())] if search else None
    resp = _call(contents=parts,
                 config=types.GenerateContentConfig(system_instruction=system, temperature=temperature, tools=tools,
                                                    thinking_config=thinking()))
    return (resp.text or "").strip()


def sniff_image_mime(data: bytes) -> str:
    if data[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "image/webp"
    if data[4:12] in (b"ftypheic", b"ftypheix", b"ftypmif1", b"ftyphevc"):
        return "image/heic"
    return "image/jpeg"


def sniff_audio_mime(data: bytes) -> str | None:
    if data[:4] == b"\x1a\x45\xdf\xa3":
        return "audio/webm"
    if data[:4] == b"RIFF" and data[8:12] == b"WAVE":
        return "audio/wav"
    if data[:4] == b"OggS":
        return "audio/ogg"
    if data[:4] == b"fLaC":
        return "audio/flac"
    if data[:3] == b"ID3" or data[:2] in (b"\xff\xfb", b"\xff\xf3", b"\xff\xf2"):
        return "audio/mp3"
    if data[4:8] == b"ftyp":
        return "audio/mp4"
    return None


# Formats Gemini accepts for audio input. Chrome's WebM and Safari's MP4 are not on the list,
# so those are converted to WAV first (see _audio.py).
GEMINI_AUDIO_MIMES = {"audio/wav", "audio/mp3", "audio/ogg", "audio/flac", "audio/aac", "audio/aiff"}


def image_part(data: bytes):
    from google.genai import types

    return types.Part.from_bytes(data=data, mime_type=sniff_image_mime(data))


def audio_part(data: bytes):
    """A Gemini audio part, converting WebM/MP4 to WAV when needed. None if it can't be made playable."""
    from google.genai import types

    from ._audio import to_wav

    mime = sniff_audio_mime(data)
    if mime not in GEMINI_AUDIO_MIMES:
        data = to_wav(data)
        if not data:
            return None
        mime = "audio/wav"
    return types.Part.from_bytes(data=data, mime_type=mime)
