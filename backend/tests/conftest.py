"""Tests never touch your real demo data: the care record goes to a temp file."""

import os
import tempfile

os.environ.setdefault("STEADY_DATA_FILE", os.path.join(tempfile.mkdtemp(prefix="steady-test-"), "steady.json"))
