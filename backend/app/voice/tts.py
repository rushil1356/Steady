"""say(): translate if needed, synthesize with ElevenLabs, cache the mp3 by content hash."""

from __future__ import annotations

import hashlib

from app.ai._env import AUDIO_DIR, DEMO_AUDIO_DIR, env, log, use_mocks
from app.ai.languages import speaks_aloud
from app.ai.translate import translate
from app.contracts import Spoken

DEFAULT_TTS_MODEL = "eleven_multilingual_v2"  # override with ELEVENLABS_TTS_MODEL
OUTPUT_FORMAT = "mp3_44100_128"

_client = None


def _eleven():
    global _client
    if _client is None:
        from elevenlabs.client import ElevenLabs

        _client = ElevenLabs(api_key=env("ELEVENLABS_API_KEY"))
    return _client


def audio_name(text: str, voice_id: str, model: str) -> str:
    """Same text + voice + model -> same file name, here and in scripts/pregenerate_audio.py."""
    return hashlib.sha1(f"{voice_id}|{model}|{text}".encode("utf-8")).hexdigest()[:20] + ".mp3"


def _audio_url(text: str, voice_id: str) -> str | None:
    model = env("ELEVENLABS_TTS_MODEL", DEFAULT_TTS_MODEL)
    name = audio_name(text, voice_id, model)

    # 1. pre-generated, committed demo audio (works offline)  2. runtime cache
    if (DEMO_AUDIO_DIR / name).exists():
        return f"/static/demo-audio/{name}"
    if (AUDIO_DIR / name).exists():
        return f"/static/audio/{name}"
    if use_mocks() or not env("ELEVENLABS_API_KEY") or not voice_id:
        return None

    try:
        chunks = _eleven().text_to_speech.convert(
            voice_id=voice_id, text=text, model_id=model, output_format=OUTPUT_FORMAT,
        )
        data = chunks if isinstance(chunks, (bytes, bytearray)) else b"".join(chunks)
        if not data:
            return None
        AUDIO_DIR.mkdir(parents=True, exist_ok=True)
        (AUDIO_DIR / name).write_bytes(data)
        return f"/static/audio/{name}"
    except Exception:  # noqa: BLE001
        log.exception("ElevenLabs TTS failed; the frontend will use the phone's voice")
        return None


def voice_for(lang: str) -> str:
    """ELEVENLABS_VOICE_ID_<LANG> if set (e.g. ELEVENLABS_VOICE_ID_HI), else the default multilingual voice."""
    return env(f"ELEVENLABS_VOICE_ID_{lang.upper()}") or env("ELEVENLABS_VOICE_ID")


def say(text_en: str, lang: str = "en") -> Spoken:
    """Speak to the patient in their chosen language.

    Non-English: text_local is always the translated caption. The audio is in that language if it is in
    TTS_SPOKEN_LANGS; otherwise the audio is English and the caption carries their language.
    audio_url is None when audio isn't available; the frontend then speaks the text itself."""
    text_en = " ".join(text_en.split())
    text_local = translate(text_en, lang) if lang != "en" else None

    speak_local = bool(text_local) and speaks_aloud(lang)
    spoken_text = text_local if speak_local else text_en
    voice_id = voice_for(lang if speak_local else "en")

    return Spoken(text_en=text_en, text_local=text_local, lang=lang, audio_url=_audio_url(spoken_text, voice_id))
