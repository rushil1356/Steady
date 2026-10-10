"""transcribe(): ElevenLabs speech-to-text. Accepts Chrome's WebM and Safari's MP4 as-is."""

from __future__ import annotations

import io

from app.ai._env import env, load_example, log, use_mocks

DEFAULT_STT_MODEL = "scribe_v1"  # override with ELEVENLABS_STT_MODEL

EXTENSIONS = {"audio/webm": "webm", "audio/mp4": "m4a", "audio/x-m4a": "m4a", "audio/mpeg": "mp3",
              "audio/mp3": "mp3", "audio/wav": "wav", "audio/x-wav": "wav", "audio/ogg": "ogg"}


def transcribe(audio: bytes, mime: str = "audio/webm", lang: str | None = None) -> str:
    """Transcribes in the patient's language (lang = their preference; None = auto-detect).
    Returns "" if nothing could be transcribed. The route should then ask them to try again, or to type."""
    if use_mocks():
        return load_example("checkin_result")["transcript"]
    if not audio or not env("ELEVENLABS_API_KEY"):
        return ""
    try:
        from app.voice.tts import _eleven

        base_mime = (mime or "").split(";")[0].strip().lower()
        file = io.BytesIO(audio)
        file.name = f"answer.{EXTENSIONS.get(base_mime, 'webm')}"
        kwargs = {"file": file, "model_id": env("ELEVENLABS_STT_MODEL", DEFAULT_STT_MODEL)}
        if lang:
            kwargs["language_code"] = lang
        try:
            result = _eleven().speech_to_text.convert(**kwargs)
        except Exception:  # noqa: BLE001 - e.g. a language code the model rejects: retry with auto-detect
            if not lang:
                raise
            kwargs.pop("language_code")
            result = _eleven().speech_to_text.convert(**kwargs)
        return (getattr(result, "text", "") or "").strip()
    except Exception:  # noqa: BLE001
        log.exception("ElevenLabs speech-to-text failed")
        return ""
