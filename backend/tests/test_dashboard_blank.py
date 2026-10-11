"""A new user's caregiver dashboard shows only what really happened; the example history is demo-only."""

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


def test_fresh_dashboard_is_empty():
    care_store.reset(full=True)
    d = client.get("/api/caregiver/dashboard").json()
    assert d["kpis"]["doses_30d"] == 0 and d["kpis"]["on_time_pct_30d"] == 0
    assert d["checkins"] == [] and d["mood_14d"] == [] and d["unprompted_by_week"] == []
    assert d["medications"] == []


def test_sample_history_loads_on_demand_and_start_fresh_clears_it():
    care_store.reset(full=True)
    assert client.post("/api/demo/load-sample").json() == {"ok": True}
    d = client.get("/api/caregiver/dashboard").json()
    assert d["kpis"]["doses_30d"] == 120 and len(d["checkins"]) == 1
    care_store.reset(full=True)
    assert client.get("/api/caregiver/dashboard").json()["kpis"]["doses_30d"] == 0
