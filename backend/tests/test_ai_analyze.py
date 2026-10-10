"""LIVE eval of analyze_checkin against the 12 sample transcripts. Costs a few Gemini calls.

Run from backend/:  USE_MOCKS=0 pytest tests/test_ai_analyze.py -v
Skipped automatically in CI (no key or USE_MOCKS=1). Tune app/prompts until every case passes.
"""

import json
import os
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.ai._env import EXAMPLES_DIR, env  # noqa: E402

LIVE = env("GEMINI_API_KEY") and os.getenv("USE_MOCKS", env("USE_MOCKS", "1")) in {"0", "false", "no"}
pytestmark = pytest.mark.skipif(not LIVE, reason="live test: needs GEMINI_API_KEY and USE_MOCKS=0")

TRANSCRIPTS = EXAMPLES_DIR / "transcripts"
EXPECTED = {k: v for k, v in json.loads((TRANSCRIPTS / "expected.json").read_text()).items() if not k.startswith("_")}


@pytest.mark.parametrize("filename", sorted(EXPECTED))
def test_tier(filename):
    from app.ai import analyze_checkin
    from app.contracts import MedBrief, PastCheckin

    meds = [MedBrief(id="med_metoprolol", name="Metoprolol", dose="25 mg", purpose="Blood pressure"),
            MedBrief(id="med_warfarin", name="Warfarin", dose="5 mg", purpose="Blood thinner", high_risk=True)]
    case = EXPECTED[filename]
    history = [PastCheckin(at="2026-10-06T20:04:00", transcript="I felt a little dizzy after lunch.", symptoms=case["history_symptoms"])] \
        if case["history_symptoms"] else []

    analysis = analyze_checkin((TRANSCRIPTS / filename).read_text(encoding="utf-8").strip(), meds, history,
                               patient_name="Asha", lang=case.get("lang", "en"), caregiver_name="Ravi Patel")
    print(f"\n{filename}: {analysis.model_dump_json(indent=1)}")
    assert analysis.suggested_tier == case["tier"]
    assert analysis.caregiver_summary and analysis.transcript_en
    assert not any(p in f" {analysis.caregiver_summary.lower()} " for p in (" she ", " her ", " he ", " his "))
    if case["tier"] != "green":
        assert analysis.why, "the caregiver app needs at least one reason for a yellow or red tier"
    reply = analysis.patient_reply_en.lower()
    if case["tier"] == "red":
        assert "911" in reply
    else:  # the patient is never told that anyone is being informed
        assert not any(w in reply for w in ("ravi", "let him know", "family", "alert", "report", "doctor"))
