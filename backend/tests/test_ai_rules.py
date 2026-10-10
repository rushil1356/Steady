"""The deterministic parts of ai/: keyword safety net, time and color parsing, high-risk detection. No API."""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.ai.analyze import closing_line, rules_analysis, safe_reply  # noqa: E402
from app.ai.extract import is_high_risk, normalize_color, normalize_dose, normalize_name, normalize_time  # noqa: E402
from app.contracts import MedBrief, PastCheckin  # noqa: E402

MEDS = [MedBrief(id="med_a", name="Metoprolol"), MedBrief(id="med_b", name="Warfarin")]


@pytest.mark.parametrize("text,flag", [
    ("I fell in the kitchen this morning", "a fall"),
    ("My chest feels tight", "chest pain or tightness"),
    ("It's hard to breathe today", "trouble breathing"),
    ("I fainted after lunch", "fainting"),
])
def test_red_flags_are_red(text, flag):
    a = rules_analysis(text, MEDS, [], "Asha")
    assert a.suggested_tier == "red" and flag in a.red_flags
    assert a.patient_reply_en.startswith("Asha, please call 911")
    assert a.why


def test_first_mention_is_green_repeat_is_yellow():
    first = rules_analysis("I feel a little dizzy", MEDS, [])
    assert first.suggested_tier == "green" and "dizzy" in first.symptoms
    history = [PastCheckin(at="2026-10-06T20:00:00", transcript="dizzy after lunch", symptoms=["dizzy"])]
    again = rules_analysis("Light-headed again when I stand", MEDS, history)
    assert again.suggested_tier == "yellow"


@pytest.mark.parametrize("text", [
    "I feel a little dizzy", "I forgot my pills last night", "All good today", "My knee is sore",
])
def test_closing_line_never_mentions_reporting(text):
    reply = rules_analysis(text, MEDS, [], "Asha").patient_reply_en
    assert reply.startswith("Thank you") and "Have a good evening" in reply
    for word in ("Ravi", "know", "family", "alert", "report", "doctor", "911"):
        assert word.lower() not in reply.lower()


@pytest.mark.parametrize("model_reply", [
    "Thank you, Asha. I'll tell Ravi how you're feeling.",
    "Thank you, Asha. Ravi will call you soon.",
    "Rest well. I've shared this with your family.",
    "Thanks, Asha. Your doctor will hear about this.",
    "I'm alerting your caregiver now.",
])
def test_model_reply_that_mentions_reporting_is_replaced(model_reply):
    assert safe_reply(model_reply, "yellow", "Asha", "evening", caregiver_name="Ravi Patel") == \
        "Thank you for telling me, Asha. Take it easy and rest well. Have a good evening."


def test_good_model_reply_is_kept_and_red_is_fixed():
    assert safe_reply("Thank you, Asha. Sleep well tonight.", "green", "Asha", "evening", "Ravi Patel") == \
        "Thank you, Asha. Sleep well tonight."
    assert "911" in safe_reply("Thank you, have a good night.", "red", "Asha", "evening")


def test_no_name_means_no_name_and_no_pronouns():
    assert closing_line("green", "", "morning") == "Thank you. It was lovely talking with you. Have a good morning."
    assert closing_line("red", "").startswith("Please call 911")
    a = rules_analysis("dizzy again", MEDS, [PastCheckin(at="2026-10-06T20:00:00", symptoms=["dizzy"])])
    assert a.caregiver_summary.startswith("The patient said")
    for pronoun in (" she ", " her ", " he ", " his "):
        assert pronoun not in f" {a.caregiver_summary.lower()} "


def test_missed_dose_is_yellow():
    assert rules_analysis("I forgot to take my pills last night", MEDS, []).suggested_tier == "yellow"


def test_took_them_confirms_every_med():
    a = rules_analysis("I took them, feeling fine", MEDS, [])
    assert {d.med_id for d in a.dose_confirmations if d.taken} == {"med_a", "med_b"}


def test_fine_is_green():
    a = rules_analysis("All good, I went for a walk", MEDS, [])
    assert a.suggested_tier == "green" and not a.symptoms and not a.red_flags


@pytest.mark.parametrize("raw,expected", [
    ("8:00 PM", "20:00"), ("8pm", "20:00"), ("20:00", "20:00"), ("0800", "08:00"),
    ("12 am", "00:00"), ("12:30 pm", "12:30"), ("noonish", None), ("25:00", None),
])
def test_normalize_time(raw, expected):
    assert normalize_time(raw) == expected


def test_normalize_color():
    assert normalize_color("#f2c94c", None) == "#F2C94C"
    assert normalize_color(None, "light blue tablet") == "#A9C8F5"
    assert normalize_color(None, None) is None


def test_high_risk():
    assert is_high_risk("Warfarin Sodium")
    assert is_high_risk("Eliquis")
    assert not is_high_risk("Atorvastatin")


@pytest.mark.parametrize("raw,expected", [
    ("25MG", "25 mg"), ("25 mg.", "25 mg"), ("1,000 IU", "1000 IU"), ("5 mg", "5 mg"),
    ("0.5mg", "0.5 mg"), ("100 UNITS", "100 units"), ("1 tablet", "1 tablet"), (None, None),
])
def test_normalize_dose(raw, expected):
    assert normalize_dose(raw) == expected


def test_normalize_name():
    assert normalize_name("METOPROLOL") == "Metoprolol"
    assert normalize_name("VITAMIN D") == "Vitamin D"
    assert normalize_name("Eliquis") == "Eliquis"
    assert normalize_name("METFORMIN HCL") == "Metformin"
    assert normalize_name("ATORVASTATIN CAL") == "Atorvastatin"
    assert normalize_name("Metoprolol Tartrate ER") == "Metoprolol"
    assert normalize_name("WARFARIN SODIUM") == "Warfarin"
    assert normalize_name("HCL") == "Hcl"   # never strips the whole name


def test_gemini_retries_when_busy(monkeypatch):
    from google.genai import errors

    from app.ai import _gemini

    calls = {"n": 0}

    class FakeModels:
        def generate_content(self, **kwargs):
            calls["n"] += 1
            if calls["n"] < 3:
                raise errors.ServerError(503, {"error": {"code": 503, "message": "busy", "status": "UNAVAILABLE"}})
            return "ok"

    class FakeClient:
        models = FakeModels()

    monkeypatch.setattr(_gemini, "client", lambda: FakeClient())
    monkeypatch.setattr(_gemini, "RETRY_DELAYS", (0, 0))
    assert _gemini._call(contents=["x"]) == "ok" and calls["n"] == 3
