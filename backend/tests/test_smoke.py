
"""Smoke tests for all 19 Steady API endpoints."""

import sys
from datetime import datetime, timezone
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.main import app
from app.db import get_session
from app import models
from app.models import ProfileDB, PatientDB, MedicationDB, DoseDB


@pytest.fixture
def client(tmp_path):
    # Create a temporary database for this test
    test_db = tmp_path / "test.db"

    test_engine = create_engine(
        f"sqlite:///{test_db.as_posix()}",
        connect_args={"check_same_thread": False},
    )

    SQLModel.metadata.create_all(test_engine)

    # Add test records
    with Session(test_engine) as session:
        session.add(ProfileDB(id=1))
        session.add(PatientDB(id=1))

        session.add(
            MedicationDB(
                id="med_metoprolol",
                patient_id=1,
                name="Metoprolol",
                dose="25 mg",
                times=["08:00"],
                level=1,
                streak=0,
            )
        )

        session.add(
            DoseDB(
                id=103,
                medication_id="med_metoprolol",
                scheduled_at=datetime(
                    2026, 10, 10, 8, 0,
                    tzinfo=timezone.utc,
                ),
                status="due",
            )
        )

        session.commit()

    # Route database requests to our temporary database
    def override_get_session():
        with Session(test_engine) as session:
            yield session

    app.dependency_overrides[get_session] = override_get_session

    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.clear()
        test_engine.dispose()


ENDPOINTS = [
    ("GET", "/api/profile", {}),
    ("PUT", "/api/profile", {"json": {
        "patient": {
            "full_name": "Test Patient",
            "preferred_name": "Test",
            "language": "en",
            "interests": [],
        },
        "caregiver": {
            "name": "Test Caregiver",
            "phone": "+15550000000",
        },
        "sharing_consent": True,
        "setup_complete": True,
    }}),
    ("POST", "/api/setup/extract", {
        "files": [
            ("images", ("label.jpg", b"fake", "image/jpeg"))
        ]
    }),
    ("GET", "/api/languages", {}),
    ("PUT", "/api/patient/language", {
        "json": {"language": "hi"}
    }),
    ("POST", "/api/setup/confirm", {
        "json": {"medications": []}
    }),
    ("PUT", "/api/patient/interests", {
        "json": {"interests": ["cricket"]}
    }),
    ("GET", "/api/patient/today", {}),
    ("GET", "/api/meds/med_metoprolol/info", {}),
    ("POST", "/api/doses/103/confirm", {
        "json": {"prompted": True}
    }),
    ("GET", "/api/checkins/prompt", {}),
    ("POST", "/api/checkins", {
        "json": {"text": "I feel dizzy"}
    }),
    ("GET", "/api/caregiver/dashboard", {}),
    ("GET", "/api/alerts/latest", {}),
    ("POST", "/api/alerts/1/handled", {}),
    ("POST", "/api/demo/clock", {
        "json": {"time": "20:00"}
    }),
    ("POST", "/api/demo/two-weeks-later", {}),
    ("POST", "/api/demo/reset", {}),
    ("POST", "/api/demo/start-fresh", {}),
    ("POST", "/api/demo/load-sample", {}),
]


@pytest.mark.parametrize(
    "method,path,kwargs",
    ENDPOINTS,
    ids=[f"{m} {p}" for m, p, _ in ENDPOINTS],
)
def test_endpoint_returns_200(client, method, path, kwargs):
    response = client.request(method, path, **kwargs)
    assert response.status_code == 200, response.text


def test_all_20_endpoints_are_registered():
    paths = app.openapi()["paths"]
    count = sum(len(methods) for methods in paths.values())
    assert count == 20
