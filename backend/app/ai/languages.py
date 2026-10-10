"""Languages Steady can talk in. Chosen at setup ("Which language should Steady speak?").

spoken: whether ElevenLabs reads this language aloud. If not, Steady shows captions in the language and speaks
English. Set TTS_SPOKEN_LANGS in .env after testing which languages sound right with your voice and model.
"""

from __future__ import annotations

from app.contracts import Language

from ._env import env

# code, English name, name in that language
LANGUAGES: list[tuple[str, str, str]] = [
    ("en", "English", "English"),
    ("es", "Spanish", "Español"),
    ("hi", "Hindi", "हिन्दी"),
    ("gu", "Gujarati", "ગુજરાતી"),
    ("bn", "Bengali", "বাংলা"),
    ("pa", "Punjabi", "ਪੰਜਾਬੀ"),
    ("ta", "Tamil", "தமிழ்"),
    ("te", "Telugu", "తెలుగు"),
    ("ur", "Urdu", "اردو"),
    ("zh", "Chinese", "中文"),
    ("ko", "Korean", "한국어"),
    ("ar", "Arabic", "العربية"),
    ("pt", "Portuguese", "Português"),
]
_BY_CODE = {code: (name, native) for code, name, native in LANGUAGES}

DEFAULT_SPOKEN = "en,es,hi,ta,zh,ko,ar,pt"


def is_supported(code: str) -> bool:
    return code in _BY_CODE


def language_name(code: str) -> str:
    return _BY_CODE.get(code, ("English", ""))[0]


def speaks_aloud(code: str) -> bool:
    spoken = {c.strip() for c in env("TTS_SPOKEN_LANGS", DEFAULT_SPOKEN).split(",") if c.strip()}
    return code == "en" or code in spoken


def list_languages() -> list[Language]:
    return [Language(code=c, name=n, native_name=nn, spoken=speaks_aloud(c)) for c, n, nn in LANGUAGES]
