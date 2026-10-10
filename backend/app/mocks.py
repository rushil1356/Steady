"""Loads the example JSON files from contracts/examples. Owner: Samarth."""

import json
from pathlib import Path

EXAMPLES = Path(__file__).resolve().parents[2] / "contracts" / "examples"


def load(name: str) -> dict:
    """load("today") reads contracts/examples/today.json."""
    return json.loads((EXAMPLES / f"{name}.json").read_text(encoding="utf-8"))
