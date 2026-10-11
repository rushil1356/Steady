"""The AI-wired routes, end to end with USE_MOCKS=1 (AI and voice return example data; storage is real)."""

import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app import care_store  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(autouse=True)
def fresh_store(tmp_path, monkeypatch):
    monkeypatch.setenv("USE_MOCKS", "1")
    monkeypatch.setattr(care_store, "DATA_FILE", tmp_path / "steady.json")
    monkeypatch.setattr(care_store, "_cache", None)
    yield


client = TestClient(app)

PROFILE = {
    "patient": {"full_name": "Asha Patel", "preferred_name": "Asha", "phone": "+15555550111", "language": "hi",
                "interests": ["cricket"]},
    "caregiver": {"name": "Ravi Patel", "relationship": "Son", "phone": "+15555550100"},
    "sharing_consent": True,
    "setup_complete": True,
}


def setup_profile():
    assert client.put("/api/profile", json=PROFILE).status_code == 200


def test_first_run_has_no_profile_and_no_medicines():
    p = client.get("/api/profile").json()
    assert p["setup_complete"] is False and p["patient"]["preferred_name"] == ""
    assert p["patient"]["language"] == "en"
    assert care_store.meds() == []


def test_profile_round_trip_and_consent_rule():
    setup_profile()
    p = client.get("/api/profile").json()
    p["patient"]["preferred_name"] = "Mr. Lee"
    assert client.put("/api/profile", json=p).json()["patient"]["preferred_name"] == "Mr. Lee"
    assert client.get("/api/profile").json()["patient"]["preferred_name"] == "Mr. Lee"
    p["sharing_consent"] = False
    assert client.put("/api/profile", json=p).status_code == 400


def test_language_change_updates_profile():
    setup_profile()
    client.put("/api/patient/language", json={"language": "es"})
    assert client.get("/api/profile").json()["patient"]["language"] == "es"


def test_checkin_text_creates_checkin_alert_and_shows_on_dashboard():
    setup_profile()
    before = client.get("/api/alerts/latest").json()
    assert before["alert"] is None and before["latest_checkin_id"] == 900      # the seeded earlier check-in

    r = client.post("/api/checkins", json={"text": "I feel dizzy again"})
    assert r.status_code == 200
    body = r.json()
    assert body["tier"] == "yellow" and body["alert"]["sms_sent"] is True     # mock analysis is yellow

    latest = client.get("/api/alerts/latest").json()
    assert latest["latest_checkin_id"] == body["checkin_id"]
    assert latest["alert"]["id"] == body["alert"]["id"] and latest["alert"]["why"]

    dash = client.get("/api/caregiver/dashboard").json()
    assert dash["status"]["tier"] == "yellow"
    assert dash["checkins"][0]["id"] == body["checkin_id"]

    assert client.post(f"/api/alerts/{body['alert']['id']}/handled").json()["ok"] is True
    assert client.get("/api/alerts/latest").json()["alert"] is None
    assert client.get("/api/caregiver/dashboard").json()["status"]["tier"] == "green"


def test_checkin_audio_upload():
    r = client.post("/api/checkins", files={"audio": ("answer.webm", b"\x1a\x45\xdf\xa3fake", "audio/webm")})
    assert r.status_code == 200 and r.json()["transcript"]


def test_empty_answer_is_422():
    assert client.post("/api/checkins", json={"text": "   "}).status_code == 422


def test_no_alert_without_consent():
    setup_profile()
    p = client.get("/api/profile").json()
    p["sharing_consent"], p["setup_complete"] = False, False
    client.put("/api/profile", json=p)
    assert client.post("/api/checkins", json={"text": "dizzy"}).json()["alert"] is None


def test_prompt_and_med_info_and_extract():
    assert client.get("/api/checkins/prompt").json()["question"]["text_en"]
    assert client.get("/api/meds/med_metoprolol/info").json()["med_name"] == "Metoprolol"
    r = client.post("/api/setup/extract", files=[("images", ("label.jpg", b"fake", "image/jpeg"))])
    assert len(r.json()["medications"]) == 4


def test_scheduling_engine_hook():
    from app.contracts import MedBrief

    care_store.set_meds([MedBrief(id="med_x", name="Lisinopril")])
    assert [m.name for m in care_store.meds()] == ["Lisinopril"]


def test_seeded_history_makes_dizziness_a_repeat():
    from app.ai.analyze import rules_analysis

    a = rules_analysis("I feel dizzy again", care_store.meds(), care_store.history(), "Asha")
    assert a.suggested_tier == "yellow"


def test_docs_show_checkin_body():
    body = app.openapi()["paths"]["/api/checkins"]["post"]["requestBody"]["content"]
    assert "application/json" in body and "multipart/form-data" in body


def test_reset_keeps_profile_start_fresh_clears_it():
    from app.contracts import MedBrief

    setup_profile()
    care_store.set_meds([MedBrief(id="med_x", name="Lisinopril")])
    client.post("/api/checkins", json={"text": "dizzy"})
    client.post("/api/demo/reset")
    assert client.get("/api/profile").json()["patient"]["preferred_name"] == "Asha"
    assert [c["id"] for c in care_store.checkins()] == [900]
    client.post("/api/demo/start-fresh")
    assert client.get("/api/profile").json()["setup_complete"] is False
    assert care_store.meds() == []
