"""Settings, paths, example loading and a small file cache for ai/ and voice/.

Kept separate from Samarth's app/config.py so the two folders never edit each other's files.
"""

from __future__ import annotations

import json
import logging
import os
import threading
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parents[2]
REPO_DIR = BACKEND_DIR.parent
STATIC_DIR = BACKEND_DIR / "static"
AUDIO_DIR = STATIC_DIR / "audio"
DEMO_AUDIO_DIR = STATIC_DIR / "demo-audio"
CACHE_DIR = BACKEND_DIR / ".cache"
EXAMPLES_DIR = REPO_DIR / "contracts" / "examples"

# Doesn't override variables already set (tests and the shell win over .env).
load_dotenv(BACKEND_DIR / ".env", override=False)

log = logging.getLogger("steady.ai")


def env(name: str, default: str = "") -> str:
    value = os.getenv(name)
    return value.strip() if value and value.strip() else default


def use_mocks() -> bool:
    return env("USE_MOCKS", "1").lower() in {"1", "true", "yes", "on"}


def load_example(name: str) -> Any:
    return json.loads((EXAMPLES_DIR / f"{name}.json").read_text(encoding="utf-8"))


class JsonCache:
    """A tiny persistent key -> JSON value store in backend/.cache/<name>.json."""

    def __init__(self, name: str) -> None:
        self.path = CACHE_DIR / f"{name}.json"
        self._data: dict[str, Any] | None = None
        self._lock = threading.Lock()

    def _load(self) -> dict[str, Any]:
        if self._data is None:
            try:
                self._data = json.loads(self.path.read_text(encoding="utf-8"))
            except (OSError, ValueError):
                self._data = {}
        return self._data

    def get(self, key: str) -> Any:
        with self._lock:
            return self._load().get(key)

    def set(self, key: str, value: Any) -> None:
        with self._lock:
            data = self._load()
            data[key] = value
            try:
                CACHE_DIR.mkdir(parents=True, exist_ok=True)
                tmp = self.path.with_suffix(".tmp")
                tmp.write_text(json.dumps(data, ensure_ascii=False, indent=1), encoding="utf-8")
                tmp.replace(self.path)
            except OSError:
                log.warning("Could not write cache %s", self.path)
