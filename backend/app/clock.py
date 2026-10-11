
from datetime import datetime
import re

_demo_time = None


def now():
    if _demo_time is not None:
        return _demo_time

    return datetime.now().astimezone()


def set_time(hh_mm: str):
    global _demo_time

    if not re.fullmatch(r"(?:[01]\d|2[0-3]):[0-5]\d", hh_mm):
        raise ValueError("Time must be HH:MM, from 00:00 to 23:59")

    hour, minute = map(int, hh_mm.split(":"))

    current = datetime.now().astimezone()

    _demo_time = current.replace(
        hour=hour,
        minute=minute,
        second=0,
        microsecond=0,
    )

    return _demo_time


def reset():
    global _demo_time
    _demo_time = None
