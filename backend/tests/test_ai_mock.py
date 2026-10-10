"""Runs in CI with USE_MOCKS=1: no keys, no network.
Checks every ai/ and voice/ function returns the contract types, and every contract example still parses."""

import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import ai, contracts, voice  # noqa: E402
from app.ai._env import EXAMPLES_DIR  # noqa: E402
from app.contracts import Analysis, ExtractedMed, MedBrief, MedInfo, Spoken  # noqa: E402

MET = MedBrief(id="med_metoprolol", name="Metoprolol", dose="25 mg", purpose="Blood pressure", look="yellow pill")


@pytest.fixture(autouse=True)
def mocks_on(monkeypatch):
    monkeypatch.setenv("USE_MOCKS", "1")


EXAMPLE_MODELS = {
    "extracted_meds": contracts.ExtractResponse,
    "spoken": contracts.Spoken,
    "today": contracts.Today,
    "demo_clock": contracts.DemoClockResponse,
    "dose_confirm": contracts.DoseConfirmResponse,
    "checkin_prompt": contracts.CheckinPrompt,
    "analysis": contracts.Analysis,
    "checkin_result": contracts.CheckinResult,
    "med_info": contracts.MedInfo,
    "dashboard": contracts.Dashboard,
    "setup_confirm_request": contracts.ConfirmRequest,
    "setup_confirm": contracts.ConfirmResponse,
    "interests": contracts.InterestsBody,
    "ok": contracts.OkResponse,
    "languages": contracts.LanguagesResponse,
    "language": contracts.LanguageBody,
    "profile": contracts.Profile,
    "alerts_latest": contracts.AlertsLatest,
}


@pytest.mark.parametrize("name,model", EXAMPLE_MODELS.items())
def test_every_example_matches_its_contract(name, model):
    model.model_validate(json.loads((EXAMPLES_DIR / f"{name}.json").read_text(encoding="utf-8")))


def test_every_example_file_has_a_model():
    files = {p.stem for p in EXAMPLES_DIR.glob("*.json")}
    assert files == set(EXAMPLE_MODELS), f"Add a model mapping for: {files ^ set(EXAMPLE_MODELS)}"


def test_extract_schedule():
    meds = ai.extract_schedule([b"fake-image"])
    assert meds and all(isinstance(m, ExtractedMed) for m in meds)


def test_analyze_checkin():
    assert isinstance(ai.analyze_checkin("I feel dizzy", [MET], []), Analysis)


def test_write_opener():
    assert ai.write_opener(["clean jokes"], "evening")


def test_simplify_label():
    info = ai.simplify_label("Metoprolol")
    assert isinstance(info, MedInfo) and info.med_name == "Metoprolol"


def test_say_returns_hindi_caption_for_known_line():
    s = voice.say("Asha, it's time for your blood pressure pill, the yellow one.", "hi")
    assert isinstance(s, Spoken) and s.text_local and s.audio_url is None


def test_transcribe_and_sms():
    assert voice.transcribe(b"audio", "audio/webm")
    assert voice.send_sms("+15555550100", "test") is True


def test_list_languages():
    codes = [lang.code for lang in ai.list_languages()]
    assert codes[0] == "en" and {"hi", "gu", "es"} <= set(codes)
    assert ai.is_supported("hi") and not ai.is_supported("xx")


def test_english_has_no_caption():
    s = voice.say("How are you feeling this evening?", "en")
    assert s.text_local is None and s.lang == "en"


def test_reminder_text_levels():
    assert ai.reminder_text(MET, 1, "Asha") == "Asha, it's time for your blood pressure pill, the yellow one."
    assert ai.reminder_text(MET, 2, "Asha") == "Asha, your yellow pill."
    assert ai.reminder_text(MedBrief(id="x", name="Vitamin D"), 1, "Mr. Lee") == "Mr. Lee, it's time for your Vitamin D."


def test_reminder_text_without_a_name():
    assert ai.reminder_text(MET, 1) == "It's time for your blood pressure pill, the yellow one."
    assert ai.reminder_text(MET, 2) == "Time for your yellow pill."


def test_profile_example_has_no_defaults_baked_in():
    profile = contracts.Profile.model_validate(json.loads((EXAMPLES_DIR / "profile.json").read_text(encoding="utf-8")))
    assert profile.patient.preferred_name and profile.caregiver.phone and profile.sharing_consent


def test_audio_conversion_makes_wav():
    import io
    import wave

    from app.ai._audio import to_wav

    buf = io.BytesIO()
    with wave.open(buf, "wb") as w:
        w.setnchannels(1), w.setsampwidth(2), w.setframerate(8000), w.writeframes(b"\x00\x00" * 800)
    out = to_wav(buf.getvalue())
    if out is None:
        pytest.skip("imageio-ffmpeg not installed")
    assert out[:4] == b"RIFF" and out[8:12] == b"WAVE"
