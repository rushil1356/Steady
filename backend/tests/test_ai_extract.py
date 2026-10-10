"""LIVE eval of extract_schedule on real label photos.

Put photos in tests/fixtures/labels/ (jpg/png) and the right answer in tests/fixtures/labels/expected.json:
    {"medications": [{"name": "Metoprolol", "dose": "25 mg", "times": ["20:00"]}, ...]}
Run from backend/:  USE_MOCKS=0 pytest tests/test_ai_extract.py -v
"""

import json
import os
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.ai._env import env  # noqa: E402

FIXTURES = Path(__file__).parent / "fixtures" / "labels"
PHOTOS = sorted(p for p in FIXTURES.glob("*") if p.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp", ".heic"})
LIVE = env("GEMINI_API_KEY") and os.getenv("USE_MOCKS", env("USE_MOCKS", "1")) in {"0", "false", "no"}

pytestmark = pytest.mark.skipif(not (LIVE and PHOTOS and (FIXTURES / "expected.json").exists()),
                                reason="live test: needs GEMINI_API_KEY, USE_MOCKS=0, label photos and expected.json")


@pytest.mark.parametrize("run", [1, 2, 3])
def test_extracts_expected_schedule(run):
    from app.ai import extract_schedule

    expected = json.loads((FIXTURES / "expected.json").read_text())["medications"]
    got = {m.name.lower(): m for m in extract_schedule([p.read_bytes() for p in PHOTOS])}
    for want in expected:
        med = got.get(want["name"].lower())
        assert med, f"run {run}: missing {want['name']}; got {list(got)}"
        assert med.dose == want["dose"], f"run {run}: {want['name']} dose {med.dose!r}"
        assert med.times == want["times"], f"run {run}: {want['name']} times {med.times}"
