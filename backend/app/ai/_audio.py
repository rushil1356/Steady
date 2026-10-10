"""Convert phone recordings into a format Gemini can listen to.

Chrome/Android records WebM (Opus) and iPhone Safari records MP4 (AAC). Gemini's audio input doesn't take WebM, so we
convert to 16 kHz mono WAV with the ffmpeg binary that ships inside the imageio-ffmpeg wheel (no system install).
Returns None on any failure; the caller then analyzes the transcript only.
"""

from __future__ import annotations

import subprocess

from ._env import log

MAX_SECONDS = 90  # a check-in answer is short; cap it so a stuck recording can't blow up the request


def _ffmpeg() -> str | None:
    try:
        import imageio_ffmpeg

        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:  # noqa: BLE001 - not installed, or no binary for this platform
        log.warning("imageio-ffmpeg is not available; Gemini will read the transcript only")
        return None


def to_wav(data: bytes) -> bytes | None:
    exe = _ffmpeg()
    if not exe or not data:
        return None
    try:
        proc = subprocess.run(
            [exe, "-hide_banner", "-loglevel", "error", "-i", "pipe:0",
             "-t", str(MAX_SECONDS), "-ac", "1", "-ar", "16000", "-f", "wav", "pipe:1"],
            input=data, capture_output=True, timeout=20, check=True,
        )
        return proc.stdout or None
    except Exception:  # noqa: BLE001
        log.exception("Converting the recording to WAV failed")
        return None
