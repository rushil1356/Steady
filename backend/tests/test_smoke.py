"""Calls every endpoint once and checks for a 200 response.
Run from the backend folder with USE_MOCKS=1.  Everyone runs this before every backend PR."""

import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.main import app  # noqa: E402

client = TestClient(app)

# (method, path, kwargs for the request)
ENDPOINTS = [
    ("GET", "/api/profile", {}),
    ("PUT", "/api/profile", {"json": {
        "patient": {"full_name": "Test Patient", "preferred_name": "Test", "language": "en", "interests": []},
        "caregiver": {"name": "Test Caregiver", "phone": "+15550000000"},
        "sharing_consent": True,
        "setup_complete": True,
    }}),
    ("POST", "/api/setup/extract", {"files": [("images", ("label.jpg", b"fake", "image/jpeg"))]}),
    ("GET", "/api/languages", {}),
    ("PUT", "/api/patient/language", {"json": {"language": "hi"}}),
    ("POST", "/api/setup/confirm", {"json": {"medications": []}}),
    ("PUT", "/api/patient/interests", {"json": {"interests": ["cricket"]}}),
    ("GET", "/api/patient/today", {}),
    ("GET", "/api/meds/med_metoprolol/info", {}),
    ("POST", "/api/doses/103/confirm", {"json": {"prompted": True}}),
    ("GET", "/api/checkins/prompt", {}),
    ("POST", "/api/checkins", {"json": {"text": "I feel dizzy"}}),
    ("GET", "/api/caregiver/dashboard", {}),
    ("GET", "/api/alerts/latest", {}),
    ("POST", "/api/alerts/1/handled", {}),
    ("POST", "/api/demo/clock", {"json": {"time": "20:00"}}),
    ("POST", "/api/demo/two-weeks-later", {}),
    ("POST", "/api/demo/reset", {}),
]


@pytest.mark.parametrize("method,path,kwargs", ENDPOINTS, ids=[f"{m} {p}" for m, p, _ in ENDPOINTS])
def test_endpoint_returns_200(method, path, kwargs):
    response = client.request(method, path, **kwargs)
    assert response.status_code == 200, response.text


def test_all_18_endpoints_are_registered():
    paths = app.openapi()["paths"]
    count = sum(len(methods) for methods in paths.values())
    assert count == 18
