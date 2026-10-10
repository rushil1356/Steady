"""Pre-generate every fixed line in the demo, so the demo plays audio with no network and no credits.

Run from backend/ with real keys:
    USE_MOCKS=0 python -m scripts.pregenerate_audio

Writes mp3s to static/demo-audio/ (committed). voice.say() finds them by the same content hash,
so nothing else needs to change. Lines Gemini writes live (replies, openers) still need the network;
offline they fall back to the phone's voice.
"""

from __future__ import annotations

import os
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.ai._env import AUDIO_DIR, DEMO_AUDIO_DIR, load_example, use_mocks  # noqa: E402
from app.ai.analyze import closing_line  # noqa: E402
from app.ai.opener import FALLBACK_LINES  # noqa: E402
from app.ai.reminders import reminder_text  # noqa: E402
from app.contracts import MedBrief  # noqa: E402
from app.prompts import CHECKIN_QUESTION  # noqa: E402
from app.voice import say  # noqa: E402

# Defaults come from the demo profile in contracts/examples/profile.json; override per run if the demo changes.
_PROFILE = load_example("profile")["patient"]
PATIENT = os.getenv("DEMO_PATIENT", _PROFILE["preferred_name"])
LANG = os.getenv("DEMO_LANG", _PROFILE["language"])  # run once per demo language


def demo_lines() -> list[str]:
    meds = load_example("extracted_meds")["medications"]
    lines: list[str] = []
    for i, m in enumerate(meds):
        brief = MedBrief(id=f"med_{i}", name=m["name"], dose=m["dose"], purpose=m["purpose"], look=m["look"])
        lines += [reminder_text(brief, 1, PATIENT), reminder_text(brief, 2, PATIENT)]
    lines += list(CHECKIN_QUESTION.values())
    lines += [closing_line(tier, PATIENT, part) for tier in ("green", "yellow", "red") for part in ("morning", "evening")]
    lines += [load_example("analysis")["patient_reply_en"]]
    lines += [line for group in FALLBACK_LINES.values() for line in group]
    return list(dict.fromkeys(lines))


def main() -> None:
    if use_mocks():
        sys.exit("Set USE_MOCKS=0 (and your ElevenLabs keys) to generate real audio.")
    DEMO_AUDIO_DIR.mkdir(parents=True, exist_ok=True)
    made = missing = 0
    for line in demo_lines():
        spoken = say(line, LANG)
        url = spoken.audio_url
        if not url:
            missing += 1
            print(f"  NO AUDIO  {line}")
            continue
        name = url.rsplit("/", 1)[-1]
        if url.startswith("/static/audio/"):
            shutil.move(str(AUDIO_DIR / name), str(DEMO_AUDIO_DIR / name))
        made += 1
        print(f"  ok  {name}  {line}")
    print(f"\n{made} lines ready in static/demo-audio/, {missing} without audio. Commit static/demo-audio/.")


if __name__ == "__main__":
    main()
