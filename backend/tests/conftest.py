"""Tests never touch your real demo data: the care record and the database go to a temp folder."""

import os
import tempfile

os.environ.setdefault("STEADY_DATA_FILE", os.path.join(tempfile.mkdtemp(prefix="steady-test-"), "steady.json"))
_tmp = tempfile.mkdtemp(prefix="steady-db-")
os.environ.setdefault("DATABASE_URL", "sqlite:///" + os.path.join(_tmp, "test.db").replace(os.sep, "/"))
